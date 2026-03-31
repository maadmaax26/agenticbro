"use strict";
/**
 * Rate Limiting Middleware
 *
 * Enforces rate limits based on user tier
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const ioredis_1 = require("ioredis");
const TIER_LIMITS = {
    free: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 5 }, // 5/day
    basic: { windowMs: 24 * 60 * 60 * 1000, maxRequests: 50 }, // 50/day
    pro: { windowMs: 60 * 60 * 1000, maxRequests: 30 }, // 30/hour
    team: { windowMs: 60 * 60 * 1000, maxRequests: 100 }, // 100/hour
    enterprise: { windowMs: 60 * 1000, maxRequests: 1000 }, // 1000/min (effectively unlimited)
};
class RateLimiter {
    redis;
    constructor() {
        this.redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    /**
     * Rate limit middleware for scan endpoints
     */
    scanLimit = async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'API key required',
                    },
                });
            }
            const tier = user.tier || 'free';
            const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
            const key = `ratelimit:scan:${user.id}`;
            const current = await this.redis.incr(key);
            if (current === 1) {
                // Set expiry on first request
                await this.redis.pexpire(key, limits.windowMs);
            }
            if (current > limits.maxRequests) {
                const ttl = await this.redis.pttl(key);
                const resetAt = new Date(Date.now() + ttl);
                return res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMITED',
                        message: 'Scan limit exceeded for your tier',
                        details: {
                            tier,
                            usedToday: current,
                            limitToday: limits.maxRequests,
                            resetAt: resetAt.toISOString(),
                            upgradeUrl: 'https://agenticbro.app/pricing',
                        },
                    },
                });
            }
            // Add rate limit headers
            res.set('X-RateLimit-Limit', limits.maxRequests.toString());
            res.set('X-RateLimit-Remaining', (limits.maxRequests - current).toString());
            res.set('X-RateLimit-Reset', (Date.now() + (await this.redis.pttl(key))).toString());
            next();
        }
        catch (error) {
            console.error('Rate limit error:', error);
            // Allow request through if Redis fails
            next();
        }
    };
    /**
     * Rate limit middleware for verify endpoints
     */
    verifyLimit = async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'API key required',
                    },
                });
            }
            const tier = user.tier || 'free';
            const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
            const key = `ratelimit:verify:${user.id}`;
            const current = await this.redis.incr(key);
            if (current === 1) {
                await this.redis.pexpire(key, limits.windowMs);
            }
            if (current > limits.maxRequests) {
                const ttl = await this.redis.pttl(key);
                const resetAt = new Date(Date.now() + ttl);
                return res.status(429).json({
                    success: false,
                    error: {
                        code: 'RATE_LIMITED',
                        message: 'Verification limit exceeded for your tier',
                        details: {
                            tier,
                            usedToday: current,
                            limitToday: limits.maxRequests,
                            resetAt: resetAt.toISOString(),
                        },
                    },
                });
            }
            res.set('X-RateLimit-Limit', limits.maxRequests.toString());
            res.set('X-RateLimit-Remaining', (limits.maxRequests - current).toString());
            next();
        }
        catch (error) {
            console.error('Rate limit error:', error);
            next();
        }
    };
    /**
     * Track API usage for analytics
     */
    trackUsage = async (userId, endpoint) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const key = `usage:${userId}:${today}`;
            await this.redis.hincrby(key, endpoint, 1);
            await this.redis.expire(key, 90 * 24 * 60 * 60); // Keep for 90 days
        }
        catch (error) {
            console.error('Usage tracking error:', error);
        }
    };
    /**
     * Get usage stats for a user
     */
    getUsageStats = async (userId, days = 30) => {
        const stats = {
            scans: 0,
            verifications: 0,
            byDay: {},
        };
        try {
            for (let i = 0; i < days; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const key = `usage:${userId}:${dateStr}`;
                const scans = await this.redis.hget(key, 'scan');
                const verifications = await this.redis.hget(key, 'verify');
                stats.byDay[dateStr] = {
                    scans: parseInt(scans || '0'),
                    verifications: parseInt(verifications || '0'),
                };
                stats.scans += parseInt(scans || '0');
                stats.verifications += parseInt(verifications || '0');
            }
        }
        catch (error) {
            console.error('Usage stats error:', error);
        }
        return stats;
    };
}
exports.RateLimiter = RateLimiter;
exports.default = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map