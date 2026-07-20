"use strict";
/**
 * Twitter/X API Client
 *
 * Fetches profile data from Twitter API v2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterApiError = exports.TwitterClient = void 0;
class TwitterClient {
    apiKey;
    apiSecret;
    bearerToken;
    baseUrl = 'https://api.twitter.com/2';
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.bearerToken = config.bearerToken;
    }
    /**
     * Get user profile by username
     */
    async getProfile(username, options = {}) {
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
            const data = await response.json();
            const user = data.data;
            if (!user) {
                return null;
            }
            // Get recent tweets if requested
            let tweets = [];
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
                verifiedDate: user.verified ? new Date().toISOString() : null, // Twitter doesn't provide this
                followers: user.public_metrics?.followers_count || 0,
                following: user.public_metrics?.following_count || 0,
                tweets: user.public_metrics?.tweet_count || 0,
                createdAt: user.created_at,
                profileImage: user.profile_image_url,
                bio: user.description,
                location: user.location,
                website: this.extractWebsite(user),
                engagementRate,
                postingFrequency: this.calculatePostingFrequency(user, tweets),
                growthPattern: 'organic', // Would need historical data to determine
                lastActive: tweets.length > 0 ? tweets[0].created_at : null,
                tweets,
                raw: user,
            };
        }
        catch (error) {
            if (error instanceof TwitterApiError) {
                throw error;
            }
            throw new Error(`Failed to fetch Twitter profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get recent tweets for a user
     */
    async getRecentTweets(userId, limit = 100) {
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
            const data = await response.json();
            return data.data || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Get user's followers sample (for bot detection)
     */
    async getFollowersSample(userId, limit = 100) {
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
            const data = await response.json();
            return data.data || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Calculate engagement rate from profile and tweets
     */
    calculateEngagementRate(user, tweets) {
        if (!user.public_metrics || tweets.length === 0) {
            return 0;
        }
        const followers = user.public_metrics.followers_count || 1;
        // Calculate average engagement per tweet
        const totalEngagement = tweets.reduce((sum, tweet) => {
            const metrics = tweet.public_metrics || {};
            return sum + (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0);
        }, 0);
        const avgEngagement = totalEngagement / tweets.length;
        // Engagement rate = avg engagement / followers
        return avgEngagement / followers;
    }
    /**
     * Calculate posting frequency score
     */
    calculatePostingFrequency(user, tweets) {
        if (!user.created_at || !user.public_metrics?.tweet_count) {
            return 'unknown';
        }
        const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (accountAgeDays === 0)
            return 'unknown';
        const tweetsPerDay = user.public_metrics.tweet_count / accountAgeDays;
        if (tweetsPerDay > 20)
            return 'very_high';
        if (tweetsPerDay > 10)
            return 'high';
        if (tweetsPerDay > 5)
            return 'moderate';
        if (tweetsPerDay > 1)
            return 'regular';
        if (tweetsPerDay > 0.1)
            return 'occasional';
        return 'rare';
    }
    /**
     * Extract website from user entities
     */
    extractWebsite(user) {
        if (user.entities?.url?.urls?.[0]?.expanded_url) {
            return user.entities.url.urls[0].expanded_url;
        }
        return null;
    }
    /**
     * Check if user is a likely bot based on profile signals
     */
    async analyzeBotSignals(user) {
        const signals = {
            hasProfileImage: !!user.profile_image_url,
            hasDescription: !!user.description,
            accountAgeDays: Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)),
            followersCount: user.public_metrics?.followers_count || 0,
            followingCount: user.public_metrics?.following_count || 0,
            tweetsCount: user.public_metrics?.tweet_count || 0,
        };
        // Calculate bot probability
        let botProbability = 0;
        // No profile image
        if (!signals.hasProfileImage)
            botProbability += 0.2;
        // No description
        if (!signals.hasDescription)
            botProbability += 0.15;
        // Very new account
        if (signals.accountAgeDays < 7)
            botProbability += 0.25;
        else if (signals.accountAgeDays < 30)
            botProbability += 0.1;
        // Following/followers ratio (bots often follow many, have few followers)
        const ratio = signals.followingCount / Math.max(signals.followersCount, 1);
        if (ratio > 10)
            botProbability += 0.2;
        else if (ratio > 5)
            botProbability += 0.1;
        // Very low tweet count
        if (signals.tweetsCount < 10 && signals.accountAgeDays > 30) {
            botProbability += 0.15;
        }
        signals.botProbability = Math.min(botProbability, 1);
        return signals;
    }
}
exports.TwitterClient = TwitterClient;
class TwitterApiError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'TwitterApiError';
    }
}
exports.TwitterApiError = TwitterApiError;
exports.default = TwitterClient;
//# sourceMappingURL=twitter.js.map