"use strict";
/**
 * Authentication Middleware
 *
 * Validates API keys and manages user sessions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auth = void 0;
const pg_1 = require("pg");
const ioredis_1 = require("ioredis");
class Auth {
    db;
    redis;
    constructor() {
        this.db = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
        });
        this.redis = new ioredis_1.Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    }
    /**
     * Require valid API key
     */
    requireApiKey = async (req, res, next) => {
        try {
            const apiKey = this.extractApiKey(req);
            if (!apiKey) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'MISSING_API_KEY',
                        message: 'API key is required. Include it in the Authorization header or X-API-Key header.',
                    },
                });
            }
            // Validate API key
            const user = await this.validateApiKey(apiKey);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'INVALID_API_KEY',
                        message: 'Invalid or revoked API key',
                    },
                });
            }
            // Attach user to request
            req.user = user;
            // Update last used
            await this.updateLastUsed(apiKey);
            next();
        }
        catch (error) {
            console.error('Auth error:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'AUTH_ERROR',
                    message: 'Authentication failed',
                },
            });
        }
    };
    /**
     * Optional API key (doesn't fail if missing)
     */
    optionalApiKey = async (req, res, next) => {
        try {
            const apiKey = this.extractApiKey(req);
            if (apiKey) {
                const user = await this.validateApiKey(apiKey);
                if (user) {
                    req.user = user;
                    await this.updateLastUsed(apiKey);
                }
            }
            next();
        }
        catch (error) {
            // Silently continue without user
            next();
        }
    };
    /**
     * Require specific tier
     */
    requireTier = (...tiers) => {
        return async (req, res, next) => {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required',
                    },
                });
            }
            if (!tiers.includes(user.tier)) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_TIER',
                        message: `This feature requires ${tiers.join(' or ')} tier`,
                        currentTier: user.tier,
                        upgradeUrl: 'https://agenticbro.app/pricing',
                    },
                });
            }
            next();
        };
    };
    /**
     * Extract API key from request
     */
    extractApiKey(req) {
        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        // Check X-API-Key header
        const apiKeyHeader = req.headers['x-api-key'];
        if (apiKeyHeader && typeof apiKeyHeader === 'string') {
            return apiKeyHeader;
        }
        // Check query parameter
        const apiKeyQuery = req.query.api_key;
        if (apiKeyQuery && typeof apiKeyQuery === 'string') {
            return apiKeyQuery;
        }
        return null;
    }
    /**
     * Validate API key and return user
     */
    async validateApiKey(apiKey) {
        // Check cache first
        const cacheKey = `apikey:${apiKey}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        // Hash the API key
        const keyHash = this.hashApiKey(apiKey);
        // Look up in database
        const query = `
      SELECT 
        u.id, u.telegram_id, u.email, u.tier, u.scans_used_today, u.scans_reset_at, u.created_at,
        k.last_used
      FROM users u
      JOIN api_keys k ON u.id = k.user_id
      WHERE k.key_hash = $1 
        AND k.revoked_at IS NULL
    `;
        const result = await this.db.query(query, [keyHash]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        const user = {
            id: row.id,
            telegramId: row.telegram_id,
            email: row.email,
            tier: row.tier || 'free',
            scansUsedToday: row.scans_used_today,
            scansResetAt: row.scans_reset_at,
            createdAt: row.created_at,
        };
        // Check if we need to reset daily scans
        const resetAt = new Date(row.scans_reset_at);
        const now = new Date();
        if (now > resetAt) {
            // Reset scans for new day
            await this.resetDailyScans(user.id);
            user.scansUsedToday = 0;
            user.scansResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
        // Cache for 5 minutes
        await this.redis.setex(cacheKey, 300, JSON.stringify(user));
        return user;
    }
    /**
     * Update last used timestamp
     */
    async updateLastUsed(apiKey) {
        const keyHash = this.hashApiKey(apiKey);
        const query = `
      UPDATE api_keys 
      SET last_used = NOW() 
      WHERE key_hash = $1
    `;
        await this.db.query(query, [keyHash]);
    }
    /**
     * Reset daily scan count
     */
    async resetDailyScans(userId) {
        const query = `
      UPDATE users 
      SET scans_used_today = 0, scans_reset_at = NOW() + INTERVAL '1 day'
      WHERE id = $1
    `;
        await this.db.query(query, [userId]);
    }
    /**
     * Hash API key for storage
     */
    hashApiKey(apiKey) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }
    /**
     * Generate new API key
     */
    generateApiKey() {
        const crypto = require('crypto');
        return `ab_${crypto.randomBytes(32).toString('base64url')}`;
    }
    /**
     * Create API key for user
     */
    async createApiKey(userId, name = 'Default') {
        const apiKey = this.generateApiKey();
        const keyHash = this.hashApiKey(apiKey);
        const query = `
      INSERT INTO api_keys (user_id, key_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
        await this.db.query(query, [userId, keyHash, name]);
        return apiKey;
    }
    /**
     * Revoke API key
     */
    async revokeApiKey(apiKeyId) {
        const query = `
      UPDATE api_keys 
      SET revoked_at = NOW() 
      WHERE id = $1
    `;
        await this.db.query(query, [apiKeyId]);
        // Clear from cache
        const keys = await this.redis.keys('apikey:*');
        for (const key of keys) {
            await this.redis.del(key);
        }
    }
    /**
     * Create new user
     */
    async createUser(data) {
        const query = `
      INSERT INTO users (telegram_id, email, tier)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const result = await this.db.query(query, [
            data.telegramId,
            data.email,
            data.tier || 'free',
        ]);
        return result.rows[0];
    }
    /**
     * Get user by ID
     */
    async getUser(userId) {
        const query = `SELECT * FROM users WHERE id = $1`;
        const result = await this.db.query(query, [userId]);
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    }
    /**
     * Update user tier
     */
    async updateTier(userId, tier) {
        const query = `UPDATE users SET tier = $1 WHERE id = $2`;
        await this.db.query(query, [tier, userId]);
        // Clear from cache
        await this.redis.del(`user:${userId}`);
    }
}
exports.Auth = Auth;
exports.default = Auth;
//# sourceMappingURL=auth.js.map