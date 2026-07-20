/**
 * Headless browser fetcher using Chrome DevTools Protocol (CDP)
 * 
 * Renders SPA pages with JavaScript, extracts images, and fetches full HTML
 * that simple HTTP requests miss (client-side rendered content).
 * 
 * Uses the existing Chrome CDP instance on port 18801.
 */

import { WebSocket } from 'ws';

export interface RenderedPage {
  url: string;
  title: string;
  html: string;
  imageUrls: string[];
  ogImage?: string;
  links: string[];
}

interface CDPResponse {
  id?: number;
  result?: any;
  error?: { message: string; code: number };
}

export class HeadlessBrowserFetcher {
  private cdpUrl: string;
  private timeout: number;

  constructor(cdpUrl: string = 'http://localhost:18801', timeout: number = 30000) {
    this.cdpUrl = cdpUrl;
    this.timeout = timeout;
  }

  /**
   * Check if Chrome CDP is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.cdpUrl}/json/version`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get available Chrome pages
   */
  async getPages(): Promise<Array<{ id: string; url: string; title: string; webSocketDebuggerUrl?: string }>> {
    try {
      const response = await fetch(`${this.cdpUrl}/json/list`);
      const pages = await response.json();
      return pages.filter((p: any) => p.type === 'page');
    } catch {
      return [];
    }
  }

  /**
   * Open a new tab and navigate to URL
   */
  private async openTab(url: string): Promise<{ id: string; webSocketDebuggerUrl: string } | null> {
    try {
      const response = await fetch(`${this.cdpUrl}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
      const tab = await response.json();
      return { id: tab.id, webSocketDebuggerUrl: tab.webSocketDebuggerUrl };
    } catch {
      return null;
    }
  }

  /**
   * Close a tab by ID
   */
  private async closeTab(tabId: string): Promise<void> {
    try {
      await fetch(`${this.cdpUrl}/json/close/${tabId}`, { method: 'PUT' });
    } catch { /* best effort */ }
  }

  /**
   * Send a CDP command via WebSocket and wait for response
   */
  private async sendCDPCommand(ws: WebSocket, method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const message = JSON.stringify({ id, method, params });

      const timeout = setTimeout(() => {
        reject(new Error(`CDP command timeout: ${method}`));
      }, this.timeout);

      const handler = (data: Buffer) => {
        try {
          const parsed = JSON.parse(data.toString()) as CDPResponse;
          if (parsed.id === id) {
            clearTimeout(timeout);
            ws.off('message', handler);
            if (parsed.error) {
              reject(new Error(`CDP error: ${parsed.error.message}`));
            } else {
              resolve(parsed.result);
            }
          }
        } catch { /* ignore non-matching messages */ }
      };

      ws.on('message', handler);
      ws.send(message);
    });
  }

  /**
   * Render a URL with headless Chrome and extract page data
   * 
   * This handles SPA/client-side rendered pages that simple fetch() misses.
   * It navigates to the URL, waits for JavaScript to execute, then extracts:
   * - Full rendered HTML
   * - All image URLs (including lazy-loaded ones)
   * - OG image meta tags
   * - Page links
   * - Page title
   */
  async renderPage(url: string, waitMs: number = 5000): Promise<RenderedPage | null> {
    let tab: { id: string; webSocketDebuggerUrl: string } | null = null;
    let ws: WebSocket | null = null;

    try {
      // Open new tab
      tab = await this.openTab(url);
      if (!tab) {
        console.error('[HeadlessBrowser] Failed to open tab for:', url);
        return null;
      }

      // Connect via WebSocket
      ws = new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise<void>((resolve, reject) => {
        ws!.on('open', () => resolve());
        ws!.on('error', reject);
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
      });

      // Wait for page to load + extra time for SPA rendering
      await new Promise(r => setTimeout(r, waitMs));

      // Try to wait for network idle, but cap at 8s
      try {
        await this.sendCDPCommand(ws, 'Network.enable', {});
        // Set up network idle detection
        const networkIdle = new Promise<void>(resolve => {
          let pendingRequests = 0;
          let idleTimer: NodeJS.Timeout;

          const resetTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => resolve(), 2000);
          };

          ws!.on('message', (data: Buffer) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.method === 'Network.requestWillBeSent') {
                pendingRequests++;
                clearTimeout(idleTimer);
              } else if (msg.method === 'Network.loadingFinished' || msg.method === 'Network.loadingFailed') {
                pendingRequests = Math.max(0, pendingRequests - 1);
                if (pendingRequests === 0) resetTimer();
              }
            } catch { /* ignore */ }
          });

          resetTimer(); // Start 2s timer
          setTimeout(() => resolve(), 8000); // Max 8s wait regardless
        });

        await networkIdle;
      } catch { /* Network.enable failed, continue anyway */ }

      // Extract page data using CDP Runtime.evaluate
      const extractResult = await this.sendCDPCommand(ws, 'Runtime.evaluate', {
        expression: `
          (() => {
            const imgs = Array.from(document.querySelectorAll('img[src]'));
            const ogImg = document.querySelector('meta[property="og:image"]');
            const links = Array.from(document.querySelectorAll('a[href]'));
            
            return {
              title: document.title || '',
              html: document.documentElement.outerHTML,
              imageUrls: imgs.map(img => {
                try { return new URL(img.getAttribute('src') || img.src, window.location.href).href; }
                catch { return img.src || img.getAttribute('src') || ''; }
              }).filter(u => u && !u.startsWith('data:') && !u.includes('pixel') && !u.includes('spacer') && !u.includes('blank')),
              ogImage: ogImg ? ogImg.getAttribute('content') || '' : '',
              links: links.map(a => {
                try { return new URL(a.getAttribute('href') || a.href, window.location.href).href; }
                catch { return ''; }
              }).filter(u => u && u.startsWith('http'))
            };
          })()
        `,
        returnByValue: true,
      });

      const pageData = extractResult?.result?.value;
      if (!pageData) {
        console.error('[HeadlessBrowser] Failed to extract page data from:', url);
        return null;
      }

      return {
        url,
        title: pageData.title || '',
        html: pageData.html || '',
        imageUrls: pageData.imageUrls || [],
        ogImage: pageData.ogImage || undefined,
        links: pageData.links || [],
      };

    } catch (err) {
      console.error('[HeadlessBrowser] Error rendering page:', url, err);
      return null;
    } finally {
      // Clean up
      if (ws) {
        try { ws.close(); } catch { /* ignore */ }
      }
      if (tab) {
        await this.closeTab(tab.id);
      }
    }
  }

  /**
   * Render a page and extract images suitable for fingerprinting
   * Returns deduplicated, filtered image URLs prioritizing logos and product images
   */
  async extractFingerprintImages(url: string): Promise<{ ogImage?: string; images: string[] }> {
    const page = await this.renderPage(url);
    if (!page) return { images: [] };

    // Deduplicate and filter
    const seen = new Set<string>();
    const images: string[] = [];

    // OG image first (likely the logo/brand image)
    if (page.ogImage && !seen.has(page.ogImage)) {
      seen.add(page.ogImage);
    }

    // Filter images: prefer larger ones, skip icons/spacers/tracking pixels
    const skipPatterns = [
      /\/icon[s]?[-_]/i, /favicon/i, /sprite/i, /pixel/i, /spacer/i, /blank/i,
      /tracking/i, /1x1/i, /transparent/i, /\.svg$/i,
      /avatar/i, /emoji/i, /flag/i,
    ];

    for (const imgUrl of page.imageUrls) {
      if (seen.has(imgUrl)) continue;
      // Skip tiny/irrelevant images
      if (skipPatterns.some(p => p.test(imgUrl))) continue;
      seen.add(imgUrl);
      images.push(imgUrl);
      if (images.length >= 25) break; // cap at 25
    }

    return { ogImage: page.ogImage, images };
  }

  /**
   * Render a Shopify/Etsy store page and extract product/store data
   * Similar to fetchStoreData but using headless browser for full rendering
   */
  async extractStoreData(storeUrl: string): Promise<{
    name?: string;
    description?: string;
    imageUrls: string[];
    productNames: string[];
    links: string[];
  } | null> {
    const page = await this.renderPage(storeUrl);
    if (!page) return null;

    // Extract product names from h2/h3 elements
    const productNames: string[] = [];
    // We already have the HTML, use regex to find product titles
    const h2Matches = page.html.match(/<h[23][^>]*>([^<]+)<\/h[23]>/gi) || [];
    for (const m of h2Matches) {
      const text = m.replace(/<[^>]+>/g, '').trim();
      if (text.length > 3 && text.length < 200 && !productNames.includes(text)) {
        productNames.push(text);
      }
      if (productNames.length >= 30) break;
    }

    // Extract store name from title
    const name = page.title?.split(/[–|—•·]/)[0]?.trim() || undefined;

    // Extract description from meta
    const descMatch = page.html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const description = descMatch?.[1] || undefined;

    return {
      name,
      description,
      imageUrls: page.imageUrls,
      productNames,
      links: page.links,
    };
  }
}

// Singleton instance
export const headlessBrowser = new HeadlessBrowserFetcher();