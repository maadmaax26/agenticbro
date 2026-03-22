# Agentic Bro — X Profile Browser Scraper

## Purpose

Browser-based X profile scraper that allows Agentic Bro to directly access and scan X/Twitter profiles for scam detection. Uses browser control automation to navigate to profiles, extract data, and analyze patterns.

**Created:** March 22, 2026

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│          Agentic Bro Website (React)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ├─ Scam Detection Service                  │ │
│  │  │  ├─ Token Verification                 │ │
│  │  │  │  │  - Risk scoring                  │ │
│  │  │  ├─ Evidence Collection               │ │
│  │  │  │  │  - Red flag detection          │ │
│  │  │  │  │  - Victim reports search          │ │ │
│  │  │  │ └─ Scam Database                │ │ │
│  │  │  -  Priority Scan API                │ │ │
│  │  │  -  Risk Score API                 │ │ │
│  │  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                       │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenClaw + Browser Control (Mac Studio)            │
│  ┌─────────────────────────────────────────────────┐ │
│  │  X Profile Scraper Service                    │ │
│  │  ├─ Navigation (navigate to profile)     │ │ │
│  │  ├─ Snapshot (capture profile data)        │ │ │
│  │  ├─ Analysis (extract key metrics)         │ │ │
│  │  ├─ Red Flag Detection                │ │ │
│  │  ├─ Risk Scoring (calculate score)        │ │ │
│  │  └─ Data Formatting (return JSON)            │ │ │
│  │  - Priority Scan endpoint                  │ │ │
│  │  - Risk Score API                       │ │ │
│  │  - Evidence API                         │ │ │
└  │  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Component: X Profile Scraper Service

### File: `aibro/src/services/XProfileScraper.ts`

```typescript
/**
 * X Profile Browser Scraper
 * Browser-based X/Twitter profile scraper for Agentic Bro scam detection
 * Uses OpenClaw browser control to navigate to profiles and extract data
 */

import { Browser } from '@openclaw/browser';
import { Page } from '@openclaw/page';

// Risk indicators
const RED_FLAGS = {
  GUARANTEED_RETURNS: {
    weight: 9,
    keywords: ['guaranteed', 'guarantee', 'risk-free', '100% win', 'riskless profit'],
    patterns: [/guaranteed returns/gi, /100% win/gi]
  },
  PRIVATE_ALPHA: {
    weight: 9,
    keywords: ['private alpha', 'insider', 'insider information', 'exclusive access', 'private signals'],
    patterns: [/private alpha/gi, /insider.*access/gi, /exclusive.*access/gi]
  },
  UNREALISTIC_CLAIMS: {
    weight: 9,
    keywords: ['x10', 'x100', 'x500', 'x1000', '500%', '1000%'],
    patterns: [/\d+x/gi, /\d+%/gi]
  },
  URGENCY_TACTICS: {
    weight: 8,
    keywords: ['act now', 'limited spots', 'act fast', 'last chance', 'ending soon'],
    patterns: [/act now/gi, /limited spots/gi, /act fast/gi]
  },
  NO_TRACK_RECORD: {
    weight: 8,
    keywords: ['no track record', 'no pnl', 'no performance', 'no timestamp', 'no proof'],
    patterns: [/no track record/gi, /no pnl/gi, /no performance/gi]
  },
  NO_VERIFICATION: {
    weight: 5,
    keywords: ['not verified', 'unverified', 'no blue check', 'no check'],
    patterns: [/not verified/gi, /unverified/gi, /no.*check/gi]
  },
  FAKE_FOLLOWERS: {
    weight: 6,
    keywords: ['bot farm', 'fake followers', 'bought followers', 'fake accounts'],
    patterns: [/bought followers/gi, /fake.*followers/gi]
  },
  NEW_ACCOUNT: {
    weight: 7,
    keywords: ['joined', 'joined today', 'new account', 'recently joined'],
    patterns: [/joined.*\d+ (?:year|month|day)/gi, /joined today/gi]
  },
  VIP_UPSELL: {
    weight: 6,
    keywords: ['vip tier', 'exclusive access', 'membership', 'subscribe', 'premium'],
    patterns: [/vip.*tier/gi, /exclusive.*access/gi, /subscription/gi]
  }
};

// Risk level thresholds
const RISK_THRESHOLDS = {
  HIGH: 7,
  MEDIUM: 5,
  LOW: 3
};

/**
 * Scan an X/Twitter profile and extract key data for scam detection
 */
export interface XProfileData {
  username: string;
  displayName: string;
  bio: string;
  followerCount: number;
  followingCount: | null;
  isVerified: boolean;
  joinDate: string;
  tweetCount: number;
  engagementRate: number;
  location: string;
  website: string;
  profileImage?: string;
  pinnedTweets: Tweet[];
  recentTweets: Tweet[];
  links: string[];
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  redFlags: RedFlag[];
  verified: boolean;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  notes: string;
}

/**
 * Tweet interface
 */
export interface Tweet {
  id: string;
  text: string;
  timestamp: string;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
}

/**
 * X Profile Scraper service
 */
export class XProfileScraper {
  private browser: Browser;
  private currentUrl: string = 'https://x.com';

  constructor() {
    this.browser = new Browser();
  }

  /**
   * Navigate to a specific X profile
   */
  async navigateToProfile(username: string): Promise<void> {
    try {
      await this.browser.goto(`https://x.com/${username}`);
      this.currentUrl = `https://x.com/${username}`;
      console.log(`Navigated to @${username}`);
    } catch (error) {
      console.error(`Failed to navigate to @${username}:`, error);
      throw error;
    }
  }

  /**
   * Take a snapshot of the profile page
   */
  async getProfileSnapshot(): Promise<XProfileData> {
    try {
      const page = await this.browser.page(this.currentUrl);
      const snapshot = await page.snapshot();

      // Extract profile data from snapshot
      const profileData = this.extractProfileData(snapshot);

      // Navigate away to go back to previous page
      await this.browser.goBack();

      return profileData;
    } catch (error) {
      console.error('Failed to take snapshot:', error);
      throw error;
    }
  }

  /**
   * Extract profile data from page snapshot
   */
  private extractProfileData(snapshot: Page): XProfileData {
    const profileData: Partial<XProfileData> = {
      username: '',
      displayName: '',
      bio: '',
      followerCount: 0,
      followingCount: null,
      isVerified: false,
      joinDate: '',
      tweetCount: 0,
      engagementRate: 0,
      location: '',
      website: '',
      pinnedTweets: [],
      recentTweets: [],
      links: [],
      redFlags: [],
      riskScore: 0,
      riskLevel: 'LOW',
      verified: false,
      confidence: 'LOW',
      notes: ''
    };

    try {
      // Extract username from URL
      const url = snapshot.url();
      const usernameMatch = url.match(/x\.com\/([^/?]+)/);
      if (usernameMatch) {
        profileData.username = usernameMatch[1];
      }

      // Extract display name (from meta title)
      const title = snapshot.title();
      if (title && !title.includes('Sign up')) {
        profileData.displayName = title.replace(' / X', '');
      }

      // Extract follower count
      const meta = snapshot.metadata;
      if (meta && meta['og:description']) {
        const desc = meta['og:description'];
        const followerMatch = /Followers · ([\d,]+) followers?/.exec(desc);
        if (followerMatch) {
          profileData.followerCount = parseInt(followerMatch[1].replace(/,/g, ''));
        }
      }

      // Extract bio/description
      const bioElement = snapshot.querySelector('[data-testid="user-description"]') ||
                        snapshot.querySelector('[data-testid="DescriptionLine"]') ||
                        snapshot.querySelector('.bio');

      if (bioElement) {
        profileData.bio = bioElement.textContent.trim();
      }

      // Extract verification status
      const verifiedElement = snapshot.querySelector('[data-testid="user-actions"] .verified');
      profileData.isVerified = verifiedElement !== null;

      // Extract join date
      const metaElement = snapshot.querySelector('meta[property="og:title"]');
      if (metaElement) {
        const content = metaElement.content || metaElement.getAttribute('content');
        // Try to extract join date from meta data
        // Can be in format like "X (Joined [date]" or similar
      }

      // Extract tweet count
      const statsElement = snapshot.querySelector('[data-testid="user-actions"]');
      if (statsElement) {
        const tweetsElement = statsElement.querySelectorAll('[data-testid="Tweet-User"]');
        profileData.tweetCount = tweetsElement.length;
      }

      // Calculate engagement rate (likes + retweets ÷ tweets)
      // Rough approximation from visible likes/retweets
      const engagementElements = [
        ...snapshot.querySelectorAll('[data-testid="like"]'),
        ...snapshot.querySelectorAll('[data-testid="retweet"]')
      ];
      let totalEngagement = 0;
      engagementElements.forEach(el => {
        const countText = el.textContent;
        const countMatch = /(\d+(?:[.,]?\d*)?) ?/.exec(countText);
        if (countMatch) {
          totalEngagement += parseInt(countMatch[1].replace(/,/g, ''));
        }
      });
      if (profileData.tweetCount > 0) {
        profileData.engagementRate = totalEngagement / profileData.tweetCount;
      }

      // Extract location
      const locationElement = snapshot.querySelector('[data-testid="user-location"]');
      if (locationElement) {
        profileData.location = locationElement.textContent.trim();
      }

      // Extract website
      const websiteElement = snapshot.querySelector('[data-testid="user-website"]');
      if (websiteElement) {
        const linkElement = websiteElement.querySelector('a');
        if (linkElement) {
          profileData.website = linkElement.href;
        }
      }

    } catch (error) {
      console.error('Error extracting profile data:', error);
    }

    // Analyze red flags
    const redFlags = this.analyzeRedFlags(profileData);

    // Calculate risk score
    const { score, level, confidence } = this.calculateRiskScore(redFlags, profileData);

    profileData.redFlags = redFlags;
    profileData.riskScore = score;
    profileData.riskLevel = level;
    profileData.confidence = confidence;

    return profileData;
  }

  /**
   * Analyze red flags in profile
   */
  private analyzeRedFlags(profileData: XProfileData): RedFlag[] {
    const redFlags: RedFlag[] = [];

    try {
      const textToAnalyze = [
        profileData.displayName || '',
        profileData.bio || '',
        profileData.location || ''
      ].join(' ');

      for (const [flagName, flag] of Object.entries(RED_FLAGS)) {
        const { weight, keywords, patterns } = flag;

        // Check if any keyword matches
        const keywordMatch = keywords.some(keyword =>
          textToAnalyze.toLowerCase().includes(keyword.toLowerCase())
        );

        // Check if any pattern matches
        const patternMatch = patterns.some(pattern =>
          pattern.test(textToAnalyze)
        );

        if (keywordMatch || patternMatch) {
          redFlags.push({
            type: flagName,
            weight: weight,
            evidence: keywordMatch ? `Found keyword: ${keywordMatch}` : `Found pattern match`
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing red flags:', error);
    }

    return redFlags;
  }

  /**
   * Calculate risk score based on red flags
   */
  private calculateRiskScore(redFlags: RedFlag[], profileData: XProfileData):
    let totalWeight = 0;
    let maxWeight = 0;

    // Calculate maximum possible weight
    for (const flag of Object.values(RED_FLAGS)) {
      maxWeight += flag.weight;
    }

    // Sum up weights of present red flags
    for (const flag of redFlags) {
      totalWeight += flag.weight;
    }

    // Calculate risk score (0-10)
    const riskScore = maxWeight > 0 ? (totalWeight / maxWeight * 10) : 0;

    // Determine risk level
    let level: 'LOW';
    if (riskScore >= RISK_THRESHOLDS.HIGH) {
      level = 'HIGH';
    } else if (riskScore >= RISK_THRESHOLDS.MEDIUM) {
      level = 'MEDIUM';
    } else if (riskScore >= RISK_THRESHOLDS.LOW) {
      level = 'LOW';
    }

    // Determine confidence level
    let confidence = 'LOW';
    if (profileData.followerCount > 100000) {
      confidence = 'HIGH';
    } else if (profileData.followerCount > 10000) {
      confidence = 'MEDIUM';
    } else if (profileData.isVerified) {
      confidence = 'HIGH';
    } else {
      confidence = 'LOW';
    }

    return { score, level, confidence };
  }

  /**
   * Extract tweets from profile page
   */
  private extractTweets(snapshot: Page): Tweet[] {
    const tweets: Tweet[] = [];

    try {
      // Extract recent tweets
      const tweetElements = snapshot.querySelectorAll('[data-testid="tweet"]');
      const limitedTweets = Array.from(tweetElements).slice(0, 20); // Last 20 tweets

      for (let i = 0; i < limitedTweets.length; i++) {
        const tweetElement = limitedTweets[i];

        // Extract tweet content
        const tweetContent = tweetElement.querySelector('[data-testid="tweetText"]');
        const tweetId = tweetElement.getAttribute('data-testid') || tweetElement.getAttribute('data-testid');

        const text = tweetContent ? tweetContent.textContent.trim() : '';
        const id = tweetId || '';

        // Extract engagement metrics (likes, retweets, replies)
        const likesElement = tweetElement.querySelector('[data-testid="like"]');
        const likes = likesElement ? parseInt(likesElement?.textContent || '0') : 0;

        const retweetsElement = tweetElement.querySelector('[data-testid="retweet"]');
        const retweets = retweetsElement ? parseInt(retweetsElement?.textContent || '0') : 0;

        const repliesElement = tweetElement.querySelector('[data-testid="reply"]');
        const replies = repliesElement ? parseInt(repliesElement?.textContent || '0') : 0;

        if (text) {
          tweets.push({
            id: id,
            text: text,
            timestamp: '', // Can extract from tweet data attributes
            likes: likes,
            retweets: retweets,
            replies: replies,
            url: `https://x.com/${id}` // Not accessible from this environment
          });
        }
      }

    } catch (error) {
      console.error('Error extracting tweets:', error);
    }

    return tweets;
  }

  /**
   * Extract links from profile page
   */
  private extractLinks(snapshot: Page): string[] {
    const links: string[] = [];

    try {
      // Find all links in bio and website elements
      const linkElements = [
        ...snapshot.querySelectorAll('[class*="ProfileHeader__BioContainer"] a'),
        ...snapshot.querySelectorAll('[class*="ProfileHeader__BioContainer"] a'),
        ...snapshot.querySelectorAll('[data-testid="user-website"] a'),
        ...snapshot.querySelectorAll('.bio a')
      ];

      linkElements.forEach(linkElement => {
        const href = linkElement.getAttribute('href');
        if (href && href.startsWith('https://')) {
          links.push(href);
        }
      });
    } catch (error) {
      console.error('Error extracting links:', error);
    }

    return [...new Set(links)]; // Remove duplicates
  }

  /**
   * Extract pinned tweets
   */
  private extractPinnedTweets(snapshot: Page): Tweet[] {
    const pinnedTweets: Tweet[] = [];

    try {
      const pinnedContainer = snapshot.querySelector('[aria-label="Pinned"]') ||
                            snapshot.querySelector('[data-testid="PinnedTweet"]');
      if (pinnedContainer) {
        const tweets = pinnedContainer.querySelectorAll('[data-testid="tweet"]');

        for (const tweet of Array.from(tweets)) {
          const tweetElement = tweet.querySelector('[data-testid="tweetText"]');
          const tweetContent = tweetElement ? tweetElement.textContent.trim() : '';
          const tweetId = tweetElement.getAttribute('data-testid') || '';

          if (tweetContent) {
            pinnedTweets.push({
              id: tweetId,
              text: tweetContent,
              timestamp: '', // Not accessible here
              likes: 0,
              retweets: 0,
              replies: 0,
              url: `https://x.com/${tweetId}`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error extracting pinned tweets:', error);
    }

    return pinnedTweets;
  }

  /**
   * Quick scan: Get basic profile data for risk assessment
   */
  async quickScan(username: string): Promise<Partial<XProfileData>> {
    try {
      await this.navigateToProfile(username);

      const page = await this.browser.page(this.currentUrl);
      const snapshot = await page.snapshot();

      const partialData: Partial<XProfileData> = {
        username: username,
        displayName: '',
        bio: '',
        followerCount: 0,
        isVerified: false,
        tweetCount: 0
      };

      // Extract display name
      const title = snapshot.title();
      if (title && !title.includes('Sign up')) {
        partialData.displayName = title.replace(' / X', '');
      }

      // Extract bio/description
      const bioElement = snapshot.querySelector('[data-testid="user-description"]') ||
                        snapshot.querySelector('[data-testid="DescriptionLine"]') ||
                        snapshot.querySelector('.bio');
      if (bioElement) {
        partialData.bio = bioElement.textContent.trim();
      }

      // Extract follower count
      const meta = snapshot.metadata;
      if (meta && meta['og:description']) {
        const desc = meta['og:description'];
        const followerMatch = /Followers · ([\d,]+) followers?/.exec(desc);
        if (followerMatch) {
          partialData.followerCount = parseInt(followerMatch[1].replace(/,/g, ''));
        }
      }

      // Extract verification status
      const verifiedElement = snapshot.querySelector('[data-testid="user-actions"] .verified');
      partialData.isVerified = verifiedElement !== null;

      return partialData;
    } catch (error) {
      console.error('Quick scan failed:', error);
      throw error;
    }
  }

  /**
   * Full scan: Complete profile data extraction
   */
  async fullScan(username: string): Promise<XProfileData> {
    try {
      await this.navigateToProfile(username);
      const page = await this.browser.page(this.currentUrl);
      const snapshot = await page.snapshot();

      const profileData: XProfileData = this.extractProfileData(snapshot);

      // Additional data extraction
      const tweets = this.extractTweets(snapshot);
      const links = this.extractLinks(snapshot);

      profileData.recentTweets = tweets.slice(0, 10); // Keep last 10 recent tweets
      profileData.links = links;
      profileData.pinnedTweets = this.extractPinnedTweets(tweetId => snapshot);

      // Get tweet count
      const statsElement = snapshot.querySelector('[data-testid="user-actions"]');
      if (statsElement) {
        const tweetsElement = statsElement.querySelectorAll('[data-testid="Tweet-User"]');
        profileData.tweetCount = tweetsElement.length;
      }

      return profileData;
    } catch (error) {
      console.error('Full scan failed:', error);
      throw error;
    }
  }
}

// Type alias for compatibility
export type { Tweet as Tweet };
export { XProfileData as XProfileData };
export { RedFlag as RedFlag };