/**
 * Twitter/X API Client
 * 
 * Fetches profile data from:
 * 1. Puppeteer (Chrome CDP) - Priority (no API key needed)
 * 2. Twitter API v2 (if credentials available)
 * 3. Mock data (fallback)
 */

import { PuppeteerProfileFetcher } from './puppeteer-fetcher';

export class TwitterClient {
  private apiKey: string;
  private apiSecret: string;
  private bearerToken: string;
  private baseUrl = 'https://api.twitter.com/2';
  private puppeteerFetcher: PuppeteerProfileFetcher;
  private useBrowser: boolean;

  constructor(config: TwitterConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.bearerToken = config.bearerToken;
    this.puppeteerFetcher = new PuppeteerProfileFetcher(config.cdpUrl || 'http://localhost:18800');
    this.useBrowser = config.useBrowser !== false; // Default to true
  }

  /**
   * Get user profile by username
   */
  async getProfile(username: string, options: any = {}): Promise<TwitterProfile | null> {
    // Priority: Browser (Puppeteer) > Twitter API > Mock
    if (this.useBrowser) {
      try {
        console.log('Attempting to fetch profile using Puppeteer...');
        const browserProfile = await this.getProfileFromBrowser(username);
        if (browserProfile) {
          console.log('✅ Successfully fetched profile from Puppeteer');
          return browserProfile;
        }
        console.log('Puppeteer fetch failed, falling back to API/mock...');
      } catch (error) {
        console.log(`Puppeteer fetch error: ${error}, falling back to API/mock...`);
      }
    }
    
    // Check if API credentials are configured
    if (!this.bearerToken || this.bearerToken.length < 10) {
      console.log('Twitter API not configured, returning mock data');
      return this.getMockProfile(username);
    }
    
    try {
      // Remove @ if present
      const cleanUsername = username.replace(/^@/, '');

      // Build user fields to request
      const userFields = [
        'id',
        'name',
        'username',
        'created_at',
        'description',
        'location',
        'profile_image_url',
        'protected',
        'public_metrics',
        'verified',
        'verified_type',
        'withheld',
      ].join(',');

      const url = `${this.baseUrl}/users/by/username/${cleanUsername}?user.fields=${userFields}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new TwitterApiError(`Twitter API error: ${response.status}`, response.status);
      }

      const data = await response.json() as { data?: TwitterUser };
      const user = data.data;

      if (!user) {
        return null;
      }

      // Get recent tweets if requested
      let tweets: Tweet[] = [];
      if (options.includeTweets) {
        tweets = await this.getRecentTweets(user.id, options.tweetLimit || 100);
      }

      // Calculate engagement rate
      const engagementRate = this.calculateEngagementRate(user, tweets);

      return {
        platform: 'twitter',
        username: user.username,
        displayName: user.name,
        verified: user.verified || false,
        verifiedType: user.verified_type || null,
        verifiedDate: user.verified ? new Date().toISOString() : null,
        followers: user.public_metrics?.followers_count || 0,
        following: user.public_metrics?.following_count || 0,
        tweetCount: user.public_metrics?.tweet_count || 0,
        createdAt: user.created_at,
        profileImage: user.profile_image_url,
        bio: user.description,
        location: user.location,
        website: this.extractWebsite(user),
        engagementRate,
        postingFrequency: this.calculatePostingFrequency(user, tweets),
        growthPattern: 'organic',
        lastActive: tweets.length > 0 ? tweets[0].created_at : null,
        recentTweets: tweets,
        raw: user,
      };

    } catch (error) {
      if (error instanceof TwitterApiError) {
        throw error;
      }
      throw new Error(`Failed to fetch Twitter profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get profile data using Puppeteer
   * Fetches live data from X.com without needing API keys
   */
  private async getProfileFromBrowser(username: string): Promise<TwitterProfile | null> {
    try {
      const profileData = await this.puppeteerFetcher.fetchProfile(username);
      
      if (!profileData) {
        return null;
      }

      return {
        platform: 'twitter',
        username: profileData.username,
        displayName: profileData.displayName,
        verified: profileData.verified,
        verifiedType: profileData.verifiedType,
        verifiedDate: profileData.verified ? new Date().toISOString() : null,
        followers: profileData.followers,
        following: profileData.following,
        tweetCount: profileData.tweets,
        createdAt: profileData.createdAt || new Date().toISOString(),
        profileImage: profileData.profileImage,
        bio: profileData.bio,
        location: profileData.location,
        website: profileData.website,
        engagementRate: 0.05,
        postingFrequency: 'unknown',
        growthPattern: 'organic',
        lastActive: new Date().toISOString(),
        raw: profileData,
      };

    } catch (error) {
      console.log(`Puppeteer fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Get recent tweets for a user
   */
  async getRecentTweets(userId: string, limit: number = 100): Promise<Tweet[]> {
    try {
      const tweetFields = [
        'id',
        'text',
        'created_at',
        'public_metrics',
        'entities',
        'attachments',
      ].join(',');

      const url = `${this.baseUrl}/users/${userId}/tweets?tweet.fields=${tweetFields}&max_results=${limit}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { data?: Tweet[] };
      return data.data || [];

    } catch {
      return [];
    }
  }

  /**
   * Get user's followers sample (for bot detection)
   */
  async getFollowersSample(userId: string, limit: number = 100): Promise<TwitterUser[]> {
    try {
      const userFields = [
        'id',
        'name',
        'username',
        'created_at',
        'public_metrics',
        'verified',
      ].join(',');

      const url = `${this.baseUrl}/users/${userId}/followers?user.fields=${userFields}&max_results=${limit}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { data?: TwitterUser[] };
      return data.data || [];

    } catch {
      return [];
    }
  }

  /**
   * Calculate engagement rate from profile and tweets
   */
  private calculateEngagementRate(user: any, tweets: Tweet[]): number {
    if (!user.public_metrics || tweets.length === 0) {
      return 0;
    }

    const followers = user.public_metrics.followers_count || 1;
    
    const totalEngagement = tweets.reduce((sum, tweet) => {
      const metrics = tweet.public_metrics || {};
      return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
    }, 0);

    const avgEngagement = totalEngagement / tweets.length;
    return avgEngagement / followers;
  }

  /**
   * Calculate posting frequency score
   */
  private calculatePostingFrequency(user: any, tweets: Tweet[]): string {
    if (!user.created_at || !user.public_metrics?.tweet_count) {
      return 'unknown';
    }

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (accountAgeDays === 0) return 'unknown';

    const tweetsPerDay = user.public_metrics.tweet_count / accountAgeDays;

    if (tweetsPerDay > 20) return 'very_high';
    if (tweetsPerDay > 10) return 'high';
    if (tweetsPerDay > 5) return 'moderate';
    if (tweetsPerDay > 1) return 'regular';
    if (tweetsPerDay > 0.1) return 'occasional';
    return 'rare';
  }

  /**
   * Extract website from user entities
   */
  private extractWebsite(user: any): string | null {
    if (user.entities?.url?.urls?.[0]?.expanded_url) {
      return user.entities.url.urls[0].expanded_url;
    }
    return null;
  }

  /**
   * Get mock profile for testing without API credentials
   */
  private getMockProfile(username: string): TwitterProfile | null {
    const cleanUsername = username.replace(/^@/, '').toLowerCase();
    const mock = MOCK_PROFILES[cleanUsername];
    
    if (!mock) {
      return {
        platform: 'twitter',
        username: cleanUsername,
        displayName: cleanUsername,
        verified: false,
        verifiedType: null,
        verifiedDate: null,
        followers: Math.floor(Math.random() * 10000),
        following: Math.floor(Math.random() * 1000),
        tweetCount: Math.floor(Math.random() * 500),
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        engagementRate: Math.random() * 0.1,
        postingFrequency: 'unknown',
        growthPattern: 'unknown',
        lastActive: new Date().toISOString(),
        raw: { username: cleanUsername },
      };
    }
    
    return {
      ...mock,
      verifiedDate: mock.verified ? new Date().toISOString() : null,
      growthPattern: 'organic',
      lastActive: new Date().toISOString(),
      raw: mock,
    } as TwitterProfile;
  }

  /**
   * Check if user is a likely bot based on profile signals
   */
  async analyzeBotSignals(user: TwitterUser): Promise<BotSignals> {
    const signals: BotSignals = {
      hasProfileImage: !!user.profile_image_url,
      hasDescription: !!user.description,
      accountAgeDays: Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      followersCount: user.public_metrics?.followers_count || 0,
      followingCount: user.public_metrics?.following_count || 0,
      tweetsCount: user.public_metrics?.tweet_count || 0,
    };

    let botProbability = 0;

    if (!signals.hasProfileImage) botProbability += 0.2;
    if (!signals.hasDescription) botProbability += 0.15;
    if (signals.accountAgeDays < 7) botProbability += 0.25;
    else if (signals.accountAgeDays < 30) botProbability += 0.1;

    const ratio = signals.followingCount / Math.max(signals.followersCount, 1);
    if (ratio > 10) botProbability += 0.2;
    else if (ratio > 5) botProbability += 0.1;

    if (signals.tweetsCount < 10 && signals.accountAgeDays > 30) {
      botProbability += 0.15;
    }

    signals.botProbability = Math.min(botProbability, 1);

    return signals;
  }
}

// Type definitions
interface TwitterConfig {
  apiKey: string;
  apiSecret: string;
  bearerToken: string;
  cdpUrl?: string;
  useBrowser?: boolean;
}

interface TwitterProfile {
  platform: string;
  username: string;
  displayName: string;
  verified: boolean;
  verifiedType: string | null;
  verifiedDate: string | null;
  followers: number;
  following: number;
  tweetCount: number;
  createdAt: string;
  profileImage?: string;
  bio?: string;
  location?: string;
  website?: string;
  engagementRate: number;
  postingFrequency: string;
  growthPattern: string;
  lastActive: string | null;
  recentTweets?: Tweet[];
  raw: any;
  deepfakeSuspected?: boolean;
  botSuspected?: boolean;
  impersonating?: string;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
    impression_count?: number;
  };
  entities?: any;
  attachments?: any;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  created_at: string;
  description?: string;
  location?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
  verified?: boolean;
  verified_type?: string;
}

interface BotSignals {
  hasProfileImage: boolean;
  hasDescription: boolean;
  accountAgeDays: number;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  botProbability?: number;
}

class TwitterApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'TwitterApiError';
  }
}

const MOCK_PROFILES: Record<string, Partial<TwitterProfile>> = {
  agenticbro11: {
    platform: 'twitter',
    username: 'agenticbro11',
    displayName: 'Agentic Bro 🔐',
    verified: true,
    verifiedType: 'blue',
    followers: 9070,
    following: 650,
    tweetCount: 350,
    createdAt: '2025-07-02T15:37:06.869Z',
    bio: 'AI-powered scam detection for crypto. Protecting your $SOL from rug pulls and scams. Scan first, ape later! 🔐 | $AGNTCBRO | agenticbro.app',
    location: 'Solana',
    engagementRate: 0.067,
    postingFrequency: '3-5 per day',
    website: 'https://agenticbro.app',
  },
};

export { TwitterApiError };
export default TwitterClient;