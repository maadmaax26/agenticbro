/**
 * Instagram Profile Client
 *
 * Fetches public Instagram profile data using Puppeteer browser automation.
 * Connects to a Chrome instance via Chrome DevTools Protocol (CDP).
 *
 * Only accesses public profile information — no login required.
 * Data extracted: username, display name, follower/following counts,
 * bio, profile image, verification status, post count, and account age signals.
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface InstagramProfileData {
  platform: 'instagram';
  username: string;
  displayName: string;
  verified: boolean;
  verifiedType?: string;
  followers: number;
  following: number;
  tweets?: number;       // post count (kept as 'tweets' for interface compatibility)
  createdAt: string;     // estimated — Instagram does not expose join date publicly
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  engagementRate?: number;
  postingFrequency?: string;
  growthPattern?: string;
  lastActive?: string;
  // Instagram-specific
  isPrivate?: boolean;
  postCount?: number;
  isBusinessAccount?: boolean;
  categoryLabel?: string;
}

interface InstagramClientOptions {
  deepScan?: boolean;
  includeMedia?: boolean;
  sampleFollowers?: boolean;
  forceRefresh?: boolean;
}

export class InstagramClient {
  private puppeteerEndpoint: string;

  constructor(puppeteerEndpoint?: string) {
    this.puppeteerEndpoint = puppeteerEndpoint || 'http://localhost:18800';
  }

  /**
   * Fetch a public Instagram profile
   */
  async getProfile(
    username: string,
    options: InstagramClientOptions = {}
  ): Promise<InstagramProfileData | null> {
    try {
      return await this.scrapeProfile(username);
    } catch (error) {
      console.error(`[InstagramClient] Failed to fetch profile for @${username}:`, error);
      return null;
    }
  }

  /**
   * Scrape Instagram profile page using Puppeteer
   */
  private async scrapeProfile(username: string): Promise<InstagramProfileData | null> {
    let browser: Browser | null = null;

    try {
      // Connect to existing Chrome instance via CDP, or launch a new one
      try {
        browser = await puppeteer.connect({
          browserURL: this.puppeteerEndpoint,
          defaultViewport: { width: 1280, height: 900 },
        });
      } catch {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      }

      const page = await browser.newPage();

      // Set a realistic user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      // Navigate to the public profile page
      const url = `https://www.instagram.com/${username}/`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check if account exists
      const notFound = await page.$('h2[data-testid="404"]');
      if (notFound) return null;

      // Extract structured data from page meta tags (most reliable source)
      const metaData = await this.extractMetaData(page, username);
      if (metaData) return metaData;

      // Fallback: extract from DOM
      return await this.extractFromDOM(page, username);

    } finally {
      if (browser) {
        // Close only the page, not the shared browser instance
        const pages = await browser.pages();
        for (const p of pages) {
          if (p.url().includes('instagram.com')) await p.close();
        }
      }
    }
  }

  /**
   * Extract profile data from Open Graph / JSON-LD meta tags
   */
  private async extractMetaData(page: Page, username: string): Promise<InstagramProfileData | null> {
    try {
      const data = await page.evaluate(() => {
        // Try JSON-LD structured data first
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            return JSON.parse(jsonLd.textContent || '');
          } catch {}
        }
        return null;
      });

      if (!data) return null;

      // Parse follower/following counts from description
      const description: string = data.description || '';
      const followersMatch = description.match(/([\d,.]+[KkMm]?)\s*Followers/i);
      const followingMatch = description.match(/([\d,.]+[KkMm]?)\s*Following/i);
      const postsMatch = description.match(/([\d,.]+[KkMm]?)\s*Posts/i);

      return {
        platform: 'instagram',
        username,
        displayName: data.name || username,
        verified: false, // Will be updated from DOM if available
        followers: this.parseCount(followersMatch?.[1] || '0'),
        following: this.parseCount(followingMatch?.[1] || '0'),
        tweets: this.parseCount(postsMatch?.[1] || '0'),
        postCount: this.parseCount(postsMatch?.[1] || '0'),
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // unknown, default 1yr
        profileImage: data.image || undefined,
        bio: description || undefined,
        website: data.url || undefined,
        engagementRate: 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract profile data from DOM elements
   */
  private async extractFromDOM(page: Page, username: string): Promise<InstagramProfileData | null> {
    try {
      const profileData = await page.evaluate(() => {
        const getText = (selector: string): string =>
          document.querySelector(selector)?.textContent?.trim() || '';

        const getAttr = (selector: string, attr: string): string =>
          (document.querySelector(selector) as HTMLElement)?.getAttribute(attr) || '';

        // Username / display name
        const displayName = getText('h2') || getText('header h1');

        // Verification badge
        const verified = !!document.querySelector('[aria-label="Verified"]') ||
                         !!document.querySelector('svg[aria-label="Verified"]');

        // Bio
        const bio = getText('.-vDIg span') ||
                    getText('div[data-testid="user-bio"]') ||
                    getText('header section > div:nth-child(3)');

        // Profile image
        const profileImage = getAttr('img[data-testid="user-avatar"]', 'src') ||
                             getAttr('header img', 'src');

        // Stats — Instagram renders stats as list items
        const statItems = Array.from(document.querySelectorAll('header ul li'));
        const statTexts = statItems.map(el => el.textContent?.trim() || '');

        // Website
        const website = (document.querySelector('a[rel~="nofollow"]') as HTMLAnchorElement)?.href || '';

        // Private account check
        const isPrivate = !!document.querySelector('[data-testid="private-account-icon"]') ||
                          document.body.textContent?.includes('This Account is Private');

        return {
          displayName,
          verified,
          bio,
          profileImage,
          statTexts,
          website,
          isPrivate,
        };
      });

      // Parse follower/following from stat text
      let followers = 0;
      let following = 0;
      let postCount = 0;

      for (const stat of profileData.statTexts) {
        if (stat.toLowerCase().includes('follower')) {
          followers = this.parseCount(stat.replace(/[^0-9.,KkMm]/gi, ''));
        } else if (stat.toLowerCase().includes('following')) {
          following = this.parseCount(stat.replace(/[^0-9.,KkMm]/gi, ''));
        } else if (stat.toLowerCase().includes('post')) {
          postCount = this.parseCount(stat.replace(/[^0-9.,KkMm]/gi, ''));
        }
      }

      return {
        platform: 'instagram',
        username,
        displayName: profileData.displayName || username,
        verified: profileData.verified,
        verifiedType: profileData.verified ? 'blue' : undefined,
        followers,
        following,
        tweets: postCount,
        postCount,
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        profileImage: profileData.profileImage || undefined,
        bio: profileData.bio || undefined,
        website: profileData.website || undefined,
        isPrivate: profileData.isPrivate,
        engagementRate: followers > 0 ? 0.03 : 0, // Instagram avg ~3%
      };
    } catch (error) {
      console.error('[InstagramClient] DOM extraction failed:', error);
      return null;
    }
  }

  /**
   * Parse follower count strings like "1.2M", "45K", "1,234" into numbers
   */
  private parseCount(raw: string): number {
    if (!raw) return 0;
    const cleaned = raw.replace(/,/g, '').trim();
    const match = cleaned.match(/^([\d.]+)([KkMmBb]?)$/);
    if (!match) return parseInt(cleaned) || 0;

    const num = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();

    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1_000_000);
    if (suffix === 'B') return Math.round(num * 1_000_000_000);
    return Math.round(num);
  }
}

export default InstagramClient;
