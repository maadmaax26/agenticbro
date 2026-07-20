/**
 * Twitter/X API Client
 *
 * Fetches profile data from Twitter API v2
 */
export declare class TwitterClient {
    private apiKey;
    private apiSecret;
    private bearerToken;
    private baseUrl;
    constructor(config: TwitterConfig);
    /**
     * Get user profile by username
     */
    getProfile(username: string, options?: ProfileOptions): Promise<TwitterProfile | null>;
    /**
     * Get recent tweets for a user
     */
    getRecentTweets(userId: string, limit?: number): Promise<Tweet[]>;
    /**
     * Get user's followers sample (for bot detection)
     */
    getFollowersSample(userId: string, limit?: number): Promise<TwitterUser[]>;
    /**
     * Calculate engagement rate from profile and tweets
     */
    private calculateEngagementRate;
    /**
     * Calculate posting frequency score
     */
    private calculatePostingFrequency;
    /**
     * Extract website from user entities
     */
    private extractWebsite;
    /**
     * Check if user is a likely bot based on profile signals
     */
    analyzeBotSignals(user: TwitterUser): Promise<BotSignals>;
}
interface TwitterConfig {
    apiKey: string;
    apiSecret: string;
    bearerToken: string;
}
interface ProfileOptions {
    includeTweets?: boolean;
    tweetLimit?: number;
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
    tweets: number;
    createdAt: string;
    profileImage?: string;
    bio?: string;
    location?: string;
    website?: string;
    engagementRate: number;
    postingFrequency: string;
    growthPattern: string;
    lastActive: string | null;
    tweets?: Tweet[];
    raw: any;
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
declare class TwitterApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number);
}
export { TwitterApiError };
export default TwitterClient;
//# sourceMappingURL=twitter.d.ts.map