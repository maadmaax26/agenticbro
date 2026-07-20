import { sleep } from '../../utils/sleep';
import { headlessBrowser, HeadlessBrowserFetcher } from './headless-browser';

export interface EtsyCandidateStore {
  url: string;
  name?: string;
  platform: 'etsy';
  imageUrls: string[];
  productNames: string[];
  description?: string;
}

// Simple fetch fallback for Etsy
async function searchEtsySimple(brandName: string): Promise<EtsyCandidateStore[]> {
  const candidates: EtsyCandidateStore[] = [];
  const searchQuery = encodeURIComponent(brandName);
  const searchUrl = `https://www.etsy.com/search/shops?q=${searchQuery}`;

  try {
    await sleep(500);
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return candidates;
    const html = await response.text();

    // Extract shop URLs from search results
    const shopUrlRegex = /https:\/\/www\.etsy\.com\/shop\/([a-zA-Z0-9]+)/g;
    const shopUrls = new Set<string>();
    let match;
    while ((match = shopUrlRegex.exec(html)) !== null) {
      shopUrls.add(`https://www.etsy.com/shop/${match[1]}`);
    }

    // Fetch each shop page
    for (const shopUrl of Array.from(shopUrls).slice(0, 10)) {
      await sleep(800);
      try {
        const shopResponse = await fetch(shopUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!shopResponse.ok) continue;

        const shopHtml = await shopResponse.text();
        const titleMatch = shopHtml.match(/<title>([^<]+)<\/title>/i);
        const shopName = titleMatch?.[1]?.split('|')[0]?.trim();

        // Extract listing images
        const imageUrls: string[] = [];
        const imgRegex = /https:\/\/i\.etsystatic\.com\/[^\s"']+\.(jpg|jpeg|png)/gi;
        while ((match = imgRegex.exec(shopHtml)) !== null) {
          if (!imageUrls.includes(match[0])) imageUrls.push(match[0]);
          if (imageUrls.length >= 30) break;
        }

        const productNames: string[] = [];
        const h3Regex = /<h3[^>]*>([^<]{3,80})<\/h3>/gi;
        while ((match = h3Regex.exec(shopHtml)) !== null) {
          productNames.push(match[1].trim());
        }

        candidates.push({
          url: shopUrl,
          name: shopName,
          platform: 'etsy',
          imageUrls,
          productNames,
        });
      } catch {
        continue;
      }
    }
  } catch {
    // Etsy search failed — return empty
  }

  return candidates;
}

// Headless browser version for Etsy (full JavaScript rendering)
async function searchEtsyHeadless(brandName: string, browser: HeadlessBrowserFetcher): Promise<EtsyCandidateStore[]> {
  const candidates: EtsyCandidateStore[] = [];
  const searchQuery = encodeURIComponent(brandName);
  const searchUrl = `https://www.etsy.com/search?q=${searchQuery}`;

  try {
    // First, render the Etsy search page to find shops
    const searchPage = await browser.renderPage(searchUrl, 6000);
    if (!searchPage) return [];

    // Extract shop links from rendered page
    const shopLinks = searchPage.links.filter(l => l.includes('etsy.com/shop/'));
    const shopSlugs = new Set<string>();
    for (const link of shopLinks) {
      const match = link.match(/etsy\.com\/shop\/([a-zA-Z0-9_-]+)/);
      if (match) shopSlugs.add(match[1]);
    }

    // Also check for listing pages that might indicate shops
    const listingLinks = searchPage.links.filter(l => l.includes('etsy.com/listing/'));
    // Extract seller names from listing pages
    for (const link of listingLinks.slice(0, 5)) {
      const listingPage = await browser.renderPage(link, 4000);
      if (listingPage) {
        const shopLinksOnListing = listingPage.links.filter(l => l.includes('etsy.com/shop/'));
        for (const sl of shopLinksOnListing) {
          const match = sl.match(/etsy\.com\/shop\/([a-zA-Z0-9_-]+)/);
          if (match) shopSlugs.add(match[1]);
        }
      }
      await sleep(1000);
    }

    // Visit each shop page
    for (const slug of Array.from(shopSlugs).slice(0, 10)) {
      const shopUrl = `https://www.etsy.com/shop/${slug}`;
      await sleep(1500); // rate limit

      const data = await browser.extractStoreData(shopUrl);
      if (data) {
        candidates.push({
          url: shopUrl,
          name: data.name,
          platform: 'etsy',
          imageUrls: data.imageUrls.slice(0, 30),
          productNames: data.productNames,
          description: data.description,
        });
      }
    }
  } catch (err) {
    console.error('[Etsy] Headless search error:', err);
  }

  return candidates;
}

export async function searchEtsy(
  brandName: string,
  _keywords: string[]
): Promise<EtsyCandidateStore[]> {
  const useHeadless = await headlessBrowser.isAvailable();
  console.log(`[Etsy] Searching for "${brandName}" (headless: ${useHeadless})`);

  if (useHeadless) {
    try {
      const results = await searchEtsyHeadless(brandName, headlessBrowser);
      if (results.length > 0) return results;
    } catch {
      // Fall back to simple fetch
    }
  }

  // Fallback to simple fetch
  return searchEtsySimple(brandName);
}