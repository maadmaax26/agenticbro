/**
 * LinkedIn Profile Client
 *
 * Fetches public LinkedIn profile data using Puppeteer browser automation.
 * Connects to a Chrome instance via Chrome DevTools Protocol (CDP).
 *
 * Only accesses public profile information visible without authentication.
 * Data extracted: name, headline, follower count, connection count, profile
 * photo, about section, work history signals, education, and verification status.
 *
 * Key signals for employment scam detection:
 * - Account age (LinkedIn shows join year in "LinkedIn Member Since")
 * - Headline keywords (e.g. "Recruiter at [company]")
 * - Work history consistency
 * - Connection count (low connections = newer/fake account)
 * - Recommendation count
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface LinkedInProfileData {
  platform: 'linkedin';
  username: string;         // LinkedIn vanity URL slug
  displayName: string;
  verified: boolean;        // LinkedIn "Top Voice" or verified company badge
  verifiedType?: string;
  followers: number;        // follower count
  following: number;        // connections as proxy
  tweets?: number;          // post count (kept as 'tweets' for interface compatibility)
  createdAt: string;        // estimated from "Member since" or earliest activity
  profileImage?: string;
  bio?: string;             // headline + about section
  location?: string;
  website?: string;
  engagementRate?: number;
  postingFrequency?: string;
  growthPattern?: string;
  lastActive?: string;
  // LinkedIn-specific
  headline?: string;
  connectionCount?: number;
  recommendationCount?: number;
  workHistoryCount?: number;
  educationCount?: number;
  isOpenToWork?: boolean;
  companyName?: string;
}

interface LinkedInClientOptions {
  deepScan?: boolean;
  includeMedia?: boolean;
  sampleFollowers?: boolean;
  forceRefresh?: boolean;
}

export class LinkedInClient {
  private puppeteerEndpoint: string;

  constructor(puppeteerEndpoint?: string) {
    this.puppeteerEndpoint = puppeteerEndpoint || 'http://localhost:18800';
  }

  /**
   * Fetch a public LinkedIn profile
   */
  async getProfile(
    username: string,
    options: LinkedInClientOptions = {}
  ): Promise<LinkedInProfileData | null> {
    try {
      return await this.scrapeProfile(username);
    } catch (error) {
      console.error(`[LinkedInClient] Failed to fetch profile for ${username}:`, error);
      return null;
    }
  }

  /**
   * Scrape LinkedIn public profile using Puppeteer
   */
  private async scrapeProfile(username: string): Promise<LinkedInProfileData | null> {
    let browser: Browser | null = null;

    try {
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

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );

      // Public profile URL format
      const url = `https://www.linkedin.com/in/${username}/`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check if profile exists or is private
      const currentUrl = page.url();
      if (currentUrl.includes('/authwall') || currentUrl.includes('/login')) {
        // LinkedIn redirects to auth wall for some profiles — extract what we can from JSON-LD
        return await this.extractFromMetaOnly(page, username);
      }

      // Check for 404
      const notFound = await page.$('.not-found__header');
      if (notFound) return null;

      return await this.extractFromDOM(page, username);

    } finally {
      if (browser) {
        const pages = await browser.pages();
        for (const p of pages) {
          if (p.url().includes('linkedin.com')) await p.close();
        }
      }
    }
  }

  /**
   * Extract profile from JSON-LD / Open Graph meta tags
   * (available even behind the auth wall for public profiles)
   */
  private async extractFromMetaOnly(page: Page, username: string): Promise<LinkedInProfileData | null> {
    try {
      const meta = await page.evaluate(() => {
        const getOgMeta = (property: string): string =>
          document.querySelector(`meta[property="og:${property}"]`)?.getAttribute('content') || '';

        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        let structured: any = null;
        if (jsonLd) {
          try { structured = JSON.parse(jsonLd.textContent || ''); } catch {}
        }

        return {
          title: getOgMeta('title'),
          description: getOgMeta('description'),
          image: getOgMeta('image'),
          structured,
        };
      });

      if (!meta.title && !meta.structured) return null;

      const displayName = meta.structured?.name ||
                         meta.title?.replace(' | LinkedIn', '').trim() ||
                         username;

      const headline = meta.structured?.jobTitle ||
                      meta.description?.split(' at ')[0] ||
                      '';

      const companyName = meta.structured?.worksFor?.[0]?.name || '';

      return {
        platform: 'linkedin',
        username,
        displayName,
        verified: false,
        followers: 0,
        following: 0,
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        profileImage: meta.image || undefined,
        bio: headline,
        headline,
        companyName,
        engagementRate: 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract profile data from public LinkedIn DOM
   */
  private async extractFromDOM(page: Page, username: string): Promise<LinkedInProfileData | null> {
    try {
      const profileData = await page.evaluate(() => {
        const getText = (selector: string): string =>
          document.querySelector(selector)?.textContent?.trim() || '';

        const getAttr = (selector: string, attr: string): string =>
          (document.querySelector(selector) as HTMLElement)?.getAttribute(attr) || '';

        const countElements = (selector: string): number =>
          document.querySelectorAll(selector).length;

        // Core identity
        const displayName = getText('h1.text-heading-xlarge') ||
                           getText('.pv-top-card--list > li:first-child');

        const headline = getText('.text-body-medium.break-words') ||
                        getText('.pv-top-card-section__headline');

        // Verification (LinkedIn Top Voice badge)
        const verified = !!document.querySelector('[aria-label*="Top Voice"]') ||
                         !!document.querySelector('.linked-in-badge--verified');

        // Profile photo
        const profileImage = getAttr('.pv-top-card-profile-picture__image', 'src') ||
                             getAttr('img.profile-photo-edit__preview', 'src') ||
                             getAttr('.presence-entity__image', 'src');

        // About / bio
        const about = getText('#about ~ .pvs-list__container .visually-hidden') ||
                     getText('.pv-about__summary-text');

        // Location
        const location = getText('.text-body-small.inline.t-black--light.break-words') ||
                        getText('.pv-top-card--list-bullet > li');

        // Follower / connection count
        const followerText = getText('.t-bold span[aria-hidden="true"]') ||
                            getText('.pv-top-card--list > li:nth-child(3)');

        // Work experience count
        const workHistoryCount = countElements('#experience ~ .pvs-list__container .pvs-list__item--line-separated');

        // Education count
        const educationCount = countElements('#education ~ .pvs-list__container .pvs-list__item--line-separated');

        // Recommendation count
        const recommendationText = getText('#recommendations ~ .pvs-list__container');

        // Website
        const website = (document.querySelector('a.pv-contact-info__contact-link') as HTMLAnchorElement)?.href || '';

        // Open to work badge
        const isOpenToWork = !!document.querySelector('[data-control-name="contact_see_more"]') ||
                             !!document.querySelector('.open-to-work-status');

        // Company name from experience
        const companyName = getText('.pv-entity__secondary-title') ||
                           getText('#experience ~ .pvs-list__container .t-14:first-child');

        return {
          displayName,
          headline,
          verified,
          profileImage,
          about,
          location,
          followerText,
          workHistoryCount,
          educationCount,
          website,
          isOpenToWork,
          companyName,
        };
      });

      const followers = this.parseCount(profileData.followerText);

      // LinkedIn connection count is a proxy for account establishment
      // <100 connections = very new / likely fake
      // 500+ connections = established account

      // Estimate account age from connection count as rough proxy
      // (LinkedIn doesn't expose join date on public profiles without auth)
      const estimatedAgeDays = this.estimateAccountAge(followers, profileData.workHistoryCount);

      return {
        platform: 'linkedin',
        username,
        displayName: profileData.displayName || username,
        verified: profileData.verified,
        verifiedType: profileData.verified ? 'top-voice' : undefined,
        followers,
        following: followers, // LinkedIn uses connections, not traditional follow
        createdAt: new Date(Date.now() - estimatedAgeDays * 24 * 60 * 60 * 1000).toISOString(),
        profileImage: profileData.profileImage || undefined,
        bio: `${profileData.headline}${profileData.about ? ` — ${profileData.about}` : ''}`.trim() || undefined,
        headline: profileData.headline || undefined,
        location: profileData.location || undefined,
        website: profileData.website || undefined,
        companyName: profileData.companyName || undefined,
        workHistoryCount: profileData.workHistoryCount,
        educationCount: profileData.educationCount,
        isOpenToWork: profileData.isOpenToWork,
        connectionCount: followers,
        engagementRate: 0.02, // LinkedIn average
        postingFrequency: 'unknown',
      };
    } catch (error) {
      console.error('[LinkedInClient] DOM extraction failed:', error);
      return null;
    }
  }

  /**
   * Estimate account age in days based on connection count and work history.
   * LinkedIn doesn't expose join date publicly, so we use proxies.
   *   - <50 connections + 0 work history = likely brand new (est. 30 days)
   *   - 100-200 connections + 1 job = est. 6 months
   *   - 500+ connections + 2+ jobs = est. 2+ years
   */
  private estimateAccountAge(connectionCount: number, workHistoryCount: number): number {
    if (connectionCount === 0 && workHistoryCount === 0) return 7;
    if (connectionCount < 50) return 30;
    if (connectionCount < 150) return 180;
    if (connectionCount < 500) {
      return workHistoryCount >= 2 ? 730 : 365;
    }
    return workHistoryCount >= 3 ? 1825 : 1095; // 5 years vs 3 years
  }

  /**
   * Parse count strings like "1.2K followers", "500+", "1,234" into numbers
   */
  private parseCount(raw: string): number {
    if (!raw) return 0;
    const cleaned = raw.replace(/,/g, '').replace(/\+/g, '').trim();
    const match = cleaned.match(/([\d.]+)([KkMm]?)/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();

    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1_000_000);
    return Math.round(num);
  }
}

export default LinkedInClient;
