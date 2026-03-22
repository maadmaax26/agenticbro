/**
 * Priority Scan API
 * API endpoint for Agentic Bro website to trigger X profile scans
 */

import { Browser } from '@openclaw/browser';
import { Page } from '@openclaw/page';
import { XProfileScraper, XProfileData, Tweet } from '../XProfileScraper';

/**
 * Priority Scan Request
 */
export interface PriorityScanRequest {
  username: string;
  scanType: 'quick' | 'full';
}

/**
 * Priority Scan Response
 */
export interface PriorityScanResponse {
  username: string;
  scanType: 'quick' | 'full';
  status: 'success' | 'error';
  data?: XProfileData | PriorityScanData;
  error?: string;
  scannedAt?: string;
}

/**
 * Priority Scan Data (for quick scans)
 */
export interface PriorityScanData {
  username: string;
  scanType: 'quick' | 'full';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  redFlagCount: number;
  redFlags: string[];
  followerCount: number;
  isVerified: boolean;
  engagementRate: number;
  recentTweetCount: number;
  recentTweets: { [tweetText: string, url: string}[], ... }[];
  pinnedTweets: { [tweetText: string, url: string}[], ... }[];
  summary: string;
}

/**
 * Priority Scan Service
 * API endpoint for triggering X profile scans via browser automation
 */
export class PriorityScanService {
  private scraper: XProfileScraper;
  private browser: Browser;

  constructor() {
    this.scraper = new XProfileScraper();
    this.browser = new Browser();
  }

  /**
   * Perform a priority scan on an X/Twitter profile
   */
  async scan(request: PriorityScanRequest): Promise<PriorityScanResponse> {
    const { username, scanType } = request;

    try {
      // Navigate to profile
      await this.scraper.navigateToProfile(username);

      // Take snapshot based on scan type
      const page = await this.browser.page('https://x.com/' + username);

      if (scanType === 'full') {
        // Full scan - extract all data
        const profileData = await this.scraper.getProfileSnapshot();
        return {
          username,
          scanType,
          status: 'success',
          data: this.formatPriorityScanData(profileData),
          scannedAt: new Date().toISOString()
        };
      } else {
        // Quick scan - extract basic data only
        const partialData = await this.scraper.quickScan(username);
        return {
          username,
          scanType,
          status: 'success',
          data: this.formatPriorityScanData(this.convertToFullData(partialData)),
          scannedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Priority scan failed:', error);
      return {
        username,
        scanType,
        status: 'error',
        error: `Failed to scan @${username}: ${error}`
      };
    }
  }

  /**
   * Convert partial data to full data format
   */
  private convertToFullData(partial: Partial<XProfileData>): XProfileData {
    return {
      username: partial.username,
      displayName: partial.displayName || '',
      bio: partial.bio || '',
      followerCount: partial.followerCount || 0,
      followingCount: partial.followingCount,
      isVerified: partial.isVerified || false,
      joinDate: partial.joinDate || '',
      tweetCount: partial.tweetCount || 0,
      engagementRate: partial.engagementRate || 0,
      location: partial.location || '',
      website: partial.website || '',
      pinnedTweets: [],
      recentTweets: [],
      links: [],
      riskScore: 0,
      riskLevel: 'LOW',
      redFlags: [],
      verified: false,
      confidence: 'LOW',
      notes: 'Quick scan - basic data only'
    };
  }

  /**
   * Format data for API response (priority scan)
   */
  private formatPriorityScanData(data: XProfileData): PriorityScanData {
    return {
      username: data.username,
      scanType: 'quick' | 'full',
      riskScore: data.riskScore,
      riskLevel: data.riskLevel,
      confidence: data.confidence,
      redFlagCount: data.redFlags.length,
      redFlags: data.redFlags.map(flag => flag.type),
      followerCount: data.followerCount,
      isVerified: data.isVerified,
      engagementRate: data.engagementRate,
      recentTweetCount: data.tweetCount,
      recentTweets: {
        sample10: data.recentTweets.slice(0, 10).map(t => ({
          tweetText: t.text,
          url: t.url
        }))
      },
      pinnedTweets: {
        sample5: data.pinnedTweets.slice(0, 5).map(t => ({
          tweetText: t.text,
          url: t.url
        }))
      },
      summary: this.generateSummary(data),
      scannedAt: new Date().toISOString()
    };
  }

  /**
   * Generate text summary of scan results
   */
  private generateSummary(data: XProfileData): string {
    const { username, followerCount, isVerified, riskScore, redFlags } = data;

    if (riskScore === 0 && isVerified) {
      return `@${username} (${followerCount.toLocaleString()} verified) — Low risk profile. No red flags detected. Professional presence, clear purpose, legitimate track record. Recommended for engagement.`;
    } else if (riskScore >= 7) {
      return `@${username} (${followerCount.toLocaleString()}) — HIGH RISK (${riskScore.toFixed(1)}/10). Multiple red flags: ${redFlags.map(f => f.type). ${isVerified ? 'Verified' : 'Unverified'}). Caution advised. DO NOT send crypto or share private keys.`;
    } else if (riskScore >= 5) {
      return `@${username} (${followerCount.toLocaleString()}) — MEDIUM RISK (${riskScore.toFixed(1)}/10). Red flags: ${redFlags.map(f => f.type). Proceed with caution. Verify track record before engagement.`;
    } else if (riskScore >= 3) {
      return `@${username} (${followerCount.toLocaleString()}) — LOW-MEDIUM RISK (${riskScore.toFixed(1)}/10). Minor red flags: ${redFlags.map(f => f.type)}. Verify track record and engagement metrics before trusting signals.`;
    } else {
      return `@${username} — VERY LOW RISK (${riskScore.toFixed(1)}/10). Minimal red flags. Appears legitimate. Use for research and analysis.`;
    }
  }

  /**
   * Convert follower count to formatted string
   */
  private formatFollowerCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toLocaleString();
    }
  }
}

// Example API response
/*
PriorityScanResponse {
  username: "Crypto_Genius09",
  scanType: "full",
  status: "success",
  data: {
    username: "Crypto_Genius09",
    riskScore: 8.5,
    riskLevel: "HIGH",
    confidence: "HIGH",
    redFlagCount: 10,
    redFlags: ["guaranteed returns", "private alpha", "500% promises", "new account"],
    followerCount: 14342,
    isVerified: false,
    engagementRate: 2.5,
    recentTweetCount: 145,
    recentTweets: {...},
    pinnedTweets: {...},
    summary: "@Crypto_Genius09 (14,342 followers, unverified, HIGH RISK (8.5/10). Multiple red flags: guaranteed returns, private alpha, 500% promises, new account, unrealistic claims. 0 victim reports found. WARNING: High confidence scam pattern match. DO NOT send crypto or provide sensitive information.",
    scannedAt: "2026-03-22T22:45:00Z"
  },
  scannedAt: "2026-06-10T10:00:00Z"
}
*/