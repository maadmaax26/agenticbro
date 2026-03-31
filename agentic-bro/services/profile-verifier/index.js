"use strict";
/**
 * Profile Verifier Service
 *
 * Verifies social media profiles for authenticity, detecting:
 * - Bot followers
 * - AI-generated/deepfake content
 * - Known scammers
 * - Impersonation attempts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileVerifier = void 0;
const twitter_1 = require("../clients/twitter");
const botometer_1 = require("../clients/botometer");
const deepfake_1 = require("../utils/deepfake");
const scammer_db_1 = require("../db/scammer-db");
const cache_1 = require("../utils/cache");
const scoring_1 = require("./scoring");
class ProfileVerifier {
    twitter;
    botometer;
    deepfake;
    scammerDb;
    cache;
    calculator;
    constructor(config) {
        this.twitter = new twitter_1.TwitterClient(config.twitterConfig);
        this.botometer = new botometer_1.BotometerClient(config.botometerApiKey);
        this.deepfake = new deepfake_1.DeepfakeDetector(config.deepfakeModelPath);
        this.scammerDb = new scammer_db_1.ScammerDatabase(config.databaseUrl);
        this.cache = new cache_1.Cache(config.redisUrl);
        this.calculator = new scoring_1.AuthenticityCalculator();
    }
    /**
     * Verify a social media profile
     */
    async verify(platform, username, options = {}) {
        const startTime = Date.now();
        const normalizedUsername = this.normalizeUsername(username);
        try {
            // Check cache first
            if (!options.forceRefresh) {
                const cached = await this.cache.get(`verify:${platform}:${normalizedUsername}`);
                if (cached) {
                    return { ...cached, cacheHit: true };
                }
            }
            // Fetch profile data
            const profileData = await this.fetchProfileData(platform, normalizedUsername, options);
            if (!profileData) {
                return {
                    success: false,
                    error: {
                        code: 'ACCOUNT_NOT_FOUND',
                        message: `Account @${normalizedUsername} not found on ${platform}`,
                    },
                };
            }
            // Run all verification checks in parallel
            const [verification, botAnalysis, deepfakeAnalysis, impersonation, activity] = await Promise.all([
                this.checkVerification(profileData),
                this.analyzeBots(profileData, options),
                this.analyzeDeepfake(profileData, options),
                this.checkImpersonation(profileData),
                this.analyzeActivity(profileData),
            ]);
            // Calculate overall authenticity score
            const categories = {
                verification,
                botDetection: botAnalysis,
                deepfake: deepfakeAnalysis,
                impersonation,
                activity,
            };
            const authenticityScore = this.calculator.calculateScore(categories);
            const riskLevel = this.determineRiskLevel(authenticityScore);
            // Build result
            const result = {
                success: true,
                data: {
                    profile: this.extractProfileInfo(profileData),
                    authenticityScore,
                    riskLevel,
                    categories,
                    redFlags: this.extractRedFlags(categories),
                    warnings: this.extractWarnings(categories),
                    recommendation: this.generateRecommendation(riskLevel, categories),
                    scanTime: new Date().toISOString(),
                    scanDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
                    cacheHit: false,
                },
            };
            // Cache based on risk level
            await this.cache.set(`verify:${platform}:${normalizedUsername}`, result, this.getCacheTTL(riskLevel));
            return result;
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: 'VERIFICATION_ERROR',
                    message: error instanceof Error ? error.message : 'An unexpected error occurred',
                },
            };
        }
    }
    /**
     * Fetch profile data from platform
     */
    async fetchProfileData(platform, username, options) {
        switch (platform) {
            case 'twitter':
                return this.twitter.getProfile(username, options);
            case 'telegram':
                return this.fetchTelegramProfile(username);
            case 'discord':
                return this.fetchDiscordProfile(username);
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
    }
    /**
     * Check verification status
     */
    async checkVerification(profileData) {
        const score = profileData.verified ? 30 :
            profileData.verifiedType === 'blue' ? 25 :
                profileData.followers > 10000 ? 15 : 5;
        return {
            score,
            maxScore: 30,
            status: score >= 30 ? 'VERIFIED' : score >= 20 ? 'SAFE' : 'LOW',
            weight: 0.30,
            details: {
                platformVerified: profileData.verified || false,
                verificationType: profileData.verifiedType || null,
                verifiedSince: profileData.verifiedDate || null,
                verificationConfidence: profileData.verified ? 100 : 0,
            },
        };
    }
    /**
     * Analyze follower authenticity for bot detection
     */
    async analyzeBots(profileData, options) {
        // Get bot score from Botometer or calculate internally
        let botScore = 0;
        let fakeFollowersPercent = 0;
        let engagementAuthenticity = 100;
        if (options.sampleFollowers && profileData.followers > 0) {
            const botometerResult = await this.botometer.getScore(profileData.username);
            botScore = botometerResult.botProbability * 100;
            fakeFollowersPercent = botometerResult.fakeFollowersPercent;
            engagementAuthenticity = botometerResult.engagementAuthenticity;
        }
        else {
            // Estimate based on engagement patterns
            const engagementRate = profileData.engagementRate || 0;
            fakeFollowersPercent = this.estimateFakeFollowers(profileData);
            engagementAuthenticity = this.calculateEngagementAuthenticity(profileData);
        }
        // Calculate score (25 points max, deduct for bot indicators)
        let score = 25;
        score -= fakeFollowersPercent * 0.2; // Up to -20 points
        score -= Math.min(botScore * 0.1, 10); // Up to -10 points
        score -= engagementAuthenticity < 50 ? 5 : 0; // -5 for low engagement authenticity
        return {
            score: Math.max(score, 0),
            maxScore: 25,
            status: score >= 20 ? 'SAFE' : score >= 15 ? 'LOW' : score >= 10 ? 'MEDIUM' : 'HIGH',
            weight: 0.25,
            details: {
                fakeFollowersPercent,
                botScore,
                suspiciousFollowersCount: Math.floor(profileData.followers * fakeFollowersPercent / 100),
                engagementAuthenticity,
                followerGrowthPattern: profileData.growthPattern || 'unknown',
                engagementRate: profileData.engagementRate || 0,
            },
        };
    }
    /**
     * Analyze profile media for deepfake detection
     */
    async analyzeDeepfake(profileData, options) {
        if (!options.includeMedia) {
            return {
                score: 0,
                maxScore: 20,
                status: 'SKIPPED',
                weight: 0.20,
                details: { reason: 'Media analysis not requested' },
            };
        }
        const profileImage = profileData.profileImage;
        if (!profileImage) {
            return {
                score: 20,
                maxScore: 20,
                status: 'SAFE',
                weight: 0.20,
                details: { reason: 'No profile image to analyze' },
            };
        }
        try {
            // Download and analyze image
            const imageData = await this.fetchImage(profileImage);
            const analysis = await this.deepfake.analyze(imageData);
            // Calculate score based on AI generation probability
            const aiProb = analysis.aiGeneratedProbability;
            let score = 20;
            if (aiProb > 0.9)
                score = 0;
            else if (aiProb > 0.7)
                score = 5;
            else if (aiProb > 0.5)
                score = 10;
            else if (aiProb > 0.3)
                score = 15;
            return {
                score,
                maxScore: 20,
                status: score >= 15 ? 'SAFE' : score >= 10 ? 'MEDIUM' : 'HIGH',
                weight: 0.20,
                details: {
                    profileImageAnalysis: score >= 15 ? 'authentic' : 'suspicious',
                    manipulationProbability: analysis.manipulationProbability,
                    faceMatch: analysis.faceMatch,
                    aiGeneratedProbability: aiProb,
                    deepfakeConfidence: Math.round((1 - aiProb) * 100),
                },
            };
        }
        catch (error) {
            return {
                score: 10,
                maxScore: 20,
                status: 'MEDIUM',
                weight: 0.20,
                details: {
                    error: 'Failed to analyze profile image',
                    reason: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }
    /**
     * Check for impersonation and known scammers
     */
    async checkImpersonation(profileData) {
        const username = profileData.username;
        const displayName = profileData.displayName;
        // Check if in known scammer database
        const scammerMatch = await this.scammerDb.findByUsername(username);
        if (scammerMatch) {
            return {
                score: 0,
                maxScore: 15,
                status: 'SCAM',
                weight: 0.15,
                details: {
                    isKnownImpersonator: true,
                    impersonatingAccount: scammerMatch.impersonating,
                    reportCount: scammerMatch.victimCount,
                    scammerDbMatch: true,
                    scammerId: scammerMatch.id,
                    scamType: scammerMatch.scamType,
                },
            };
        }
        // Find similar usernames
        const similarAccounts = await this.findSimilarUsernames(username, displayName);
        // Calculate impersonation risk
        const impersonationRisk = this.calculateImpersonationRisk(username, displayName, similarAccounts, profileData);
        const score = Math.max(15 - impersonationRisk.score, 0);
        return {
            score,
            maxScore: 15,
            status: impersonationRisk.score >= 10 ? 'SCAM' :
                impersonationRisk.score >= 5 ? 'UNSAFE' : 'SAFE',
            weight: 0.15,
            details: {
                isKnownImpersonator: false,
                impersonatingAccount: impersonationRisk.impersonating || null,
                similarAccounts: similarAccounts.slice(0, 5),
                reportCount: 0,
                scammerDbMatch: false,
                riskFactors: impersonationRisk.factors,
            },
        };
    }
    /**
     * Analyze account activity patterns
     */
    async analyzeActivity(profileData) {
        const now = new Date();
        const createdAt = new Date(profileData.createdAt);
        const accountAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        let score = 10; // Start with max
        // Penalize new accounts
        if (accountAgeDays < 7)
            score -= 5;
        else if (accountAgeDays < 30)
            score -= 3;
        else if (accountAgeDays < 90)
            score -= 1;
        // Check posting patterns
        const postingScore = this.analyzePostingPatterns(profileData);
        score -= Math.max(0, 5 - postingScore);
        // Check engagement rate
        const engagementRate = profileData.engagementRate || 0;
        if (engagementRate > 0.1)
            score -= 2; // Suspiciously high engagement
        if (engagementRate < 0.001)
            score -= 1; // Very low engagement
        // Check for suspicious patterns
        const suspiciousPatterns = this.detectSuspiciousPatterns(profileData);
        score -= suspiciousPatterns.length;
        return {
            score: Math.max(score, 0),
            maxScore: 10,
            status: score >= 8 ? 'SAFE' : score >= 5 ? 'LOW' : 'MEDIUM',
            weight: 0.10,
            details: {
                accountAge: this.formatAge(accountAgeDays),
                accountAgeDays,
                postingFrequency: profileData.postingFrequency || 'unknown',
                postingFrequencyScore: postingScore,
                engagementRate,
                suspiciousPatterns,
                lastActive: profileData.lastActive || null,
            },
        };
    }
    // Helper methods
    normalizeUsername(username) {
        return username.replace(/^@/, '').toLowerCase().trim();
    }
    determineRiskLevel(score) {
        if (score >= 95)
            return 'VERIFIED';
        if (score >= 80)
            return 'SAFE';
        if (score >= 60)
            return 'CAUTION';
        if (score >= 40)
            return 'UNSAFE';
        return 'SCAM';
    }
    extractProfileInfo(profileData) {
        return {
            platform: profileData.platform,
            username: profileData.username,
            displayName: profileData.displayName,
            verified: profileData.verified,
            verifiedType: profileData.verifiedType,
            followers: profileData.followers,
            following: profileData.following,
            tweets: profileData.tweets,
            createdAt: profileData.createdAt,
            profileImage: profileData.profileImage,
            bio: profileData.bio,
            location: profileData.location,
            website: profileData.website,
        };
    }
    extractRedFlags(categories) {
        const flags = [];
        if (categories.impersonation.status === 'SCAM') {
            flags.push('🚨 KNOWN SCAMMER - Account found in scammer database');
            if (categories.impersonation.details.victimCount > 10) {
                flags.push(`⚠️ ${categories.impersonation.details.victimCount} victims reported`);
            }
        }
        if (categories.botDetection.details.fakeFollowersPercent > 50) {
            flags.push(`🤖 ${categories.botDetection.details.fakeFollowersPercent}% fake followers detected`);
        }
        if (categories.deepfake.details.aiGeneratedProbability > 0.7) {
            flags.push('🎭 AI-generated profile image detected');
        }
        if (categories.activity.details.accountAgeDays < 7) {
            flags.push('⏰ Account created less than 7 days ago');
        }
        return flags;
    }
    extractWarnings(categories) {
        const warnings = [];
        if (categories.botDetection.details.fakeFollowersPercent > 20) {
            warnings.push(`${categories.botDetection.details.fakeFollowersPercent}% of followers appear to be bots`);
        }
        if (categories.activity.details.accountAgeDays < 30) {
            warnings.push(`Account is only ${categories.activity.details.accountAgeDays} days old - newer accounts carry higher risk`);
        }
        if (categories.verification.score < 20 && categories.verification.maxScore === 30) {
            warnings.push('Account is not platform verified');
        }
        if (categories.activity.details.engagementRate > 0.05) {
            warnings.push('Engagement rate is unusually high - may indicate fake engagement');
        }
        return warnings;
    }
    generateRecommendation(riskLevel, categories) {
        switch (riskLevel) {
            case 'VERIFIED':
                return '✅ VERIFIED ACCOUNT - Official account of a public figure. Safe to interact with.';
            case 'SAFE':
                return '✅ SAFE - Authentic profile with no significant red flags. Standard caution recommended.';
            case 'CAUTION':
                return '⚠️ CAUTION - Some concerns detected. Investigate further before trusting.';
            case 'UNSAFE':
                return '❌ UNSAFE - Significant red flags detected. Avoid sending funds or sharing personal information.';
            case 'SCAM':
                return '🛑 DO NOT INTERACT - Known scam account. Report and block immediately.';
            default:
                return 'Unable to determine risk level.';
        }
    }
    getCacheTTL(riskLevel) {
        const ttlMap = {
            VERIFIED: 7 * 24 * 60 * 60, // 7 days
            SAFE: 24 * 60 * 60, // 24 hours
            CAUTION: 12 * 60 * 60, // 12 hours
            UNSAFE: 1 * 60 * 60, // 1 hour
            SCAM: 30 * 60, // 30 minutes (always fresh for scammers)
        };
        return ttlMap[riskLevel];
    }
    estimateFakeFollowers(profileData) {
        // Simple heuristic: accounts with very high followers but low engagement
        // tend to have more fake followers
        if (profileData.followers < 1000)
            return 5;
        if (profileData.followers < 10000)
            return 10;
        const ratio = profileData.followers / (profileData.engagementRate || 0.01);
        if (ratio > 1000000)
            return 50;
        if (ratio > 100000)
            return 30;
        if (ratio > 10000)
            return 15;
        return 10;
    }
    calculateEngagementAuthenticity(profileData) {
        // Authentic engagement typically falls within 1-5% for normal accounts
        const rate = profileData.engagementRate || 0;
        if (rate < 0.001)
            return 50; // Very low = suspicious
        if (rate < 0.01)
            return 90; // 0.1-1% = normal
        if (rate < 0.05)
            return 85; // 1-5% = normal
        if (rate < 0.1)
            return 60; // 5-10% = somewhat suspicious
        return 30; // >10% = highly suspicious
    }
    async findSimilarUsernames(username, displayName) {
        // Implementation would check similarity with known entities
        return [];
    }
    calculateImpersonationRisk(username, displayName, similarAccounts, profileData) {
        let score = 0;
        const factors = [];
        // Check username patterns
        const commonPatterns = [
            { pattern: /_giveaway$/i, score: 8, factor: 'Username ends with "_giveaway"' },
            { pattern: /_airdrop$/i, score: 8, factor: 'Username ends with "_airdrop"' },
            { pattern: /_official$/i, score: 5, factor: 'Username ends with "_official"' },
            { pattern: /_real$/i, score: 5, factor: 'Username ends with "_real"' },
            { pattern: /^the_/i, score: 3, factor: 'Username starts with "the_"' },
        ];
        for (const { pattern, score: add, factor } of commonPatterns) {
            if (pattern.test(username)) {
                score += add;
                factors.push(factor);
            }
        }
        // Check if account is new
        const accountAgeDays = Math.floor((Date.now() - new Date(profileData.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (accountAgeDays < 30) {
            score += 3;
            factors.push(`Account is only ${accountAgeDays} days old`);
        }
        // Check for giveaway keywords in bio
        const giveawayKeywords = ['giveaway', 'airdrop', 'free', 'send', 'receive', 'bonus'];
        const bio = (profileData.bio || '').toLowerCase();
        for (const keyword of giveawayKeywords) {
            if (bio.includes(keyword)) {
                score += 2;
                factors.push(`Bio contains "${keyword}"`);
            }
        }
        // Check verification status
        if (!profileData.verified && profileData.followers < 10000) {
            score += 2;
            factors.push('Unverified account with low follower count');
        }
        return { score, factors };
    }
    analyzePostingPatterns(profileData) {
        // Score from 1-5 based on posting patterns
        if (!profileData.tweets || !profileData.accountAgeDays)
            return 3;
        const tweetsPerDay = profileData.tweets / profileData.accountAgeDays;
        // Very high posting frequency is suspicious
        if (tweetsPerDay > 50)
            return 1;
        if (tweetsPerDay > 20)
            return 2;
        if (tweetsPerDay > 10)
            return 3;
        if (tweetsPerDay > 1)
            return 4;
        return 5;
    }
    detectSuspiciousPatterns(profileData) {
        const patterns = [];
        // Check for mass following/followers imbalance
        if (profileData.following > profileData.followers * 2) {
            patterns.push('Mass following detected');
        }
        // Check for empty bio with high followers
        if (!profileData.bio && profileData.followers > 10000) {
            patterns.push('High followers with empty bio');
        }
        // Check for default profile image
        if (!profileData.profileImage || profileData.profileImage.includes('default')) {
            patterns.push('Default profile image');
        }
        return patterns;
    }
    formatAge(days) {
        if (days < 1)
            return 'less than 1 day';
        if (days < 7)
            return `${days} days`;
        if (days < 30)
            return `${Math.floor(days / 7)} weeks`;
        if (days < 365)
            return `${Math.floor(days / 30)} months`;
        const years = Math.floor(days / 365);
        return `${years} year${years > 1 ? 's' : ''}`;
    }
    async fetchImage(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    async fetchTelegramProfile(username) {
        // Implementation for Telegram profile fetching
        // Would use Telegram API or web scraping
        return null;
    }
    async fetchDiscordProfile(username) {
        // Implementation for Discord profile fetching
        return null;
    }
}
exports.ProfileVerifier = ProfileVerifier;
exports.default = ProfileVerifier;
//# sourceMappingURL=index.js.map