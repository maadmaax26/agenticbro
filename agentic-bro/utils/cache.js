"use strict";
/**
 * Redis Cache Utility
 *
 * Provides caching for scan results and user data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
const ioredis_1 = require("ioredis");
class Cache {
    redis;
    defaultTTL;
    prefix;
    constructor(redisUrl = 'redis://localhost:6379', options = {}) {
        this.redis = new ioredis_1.Redis(redisUrl);
        this.defaultTTL = options.ttl || 3600; // Default 1 hour
        this.prefix = options.prefix || 'agenticbro:';
    }
    /**
     * Get value from cache
     */
    async get(key) {
        try {
            const fullKey = this.prefix + key;
            const data = await this.redis.get(fullKey);
            if (!data) {
                return null;
            }
            return JSON.parse(data);
        }
        catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl) {
        try {
            const fullKey = this.prefix + key;
            const data = JSON.stringify(value);
            const expires = ttl || this.defaultTTL;
            await this.redis.setex(fullKey, expires, data);
            return true;
        }
        catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }
    /**
     * Delete key from cache
     */
    async delete(key) {
        try {
            const fullKey = this.prefix + key;
            await this.redis.del(fullKey);
            return true;
        }
        catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            const fullKey = this.prefix + key;
            const result = await this.redis.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }
    /**
     * Get TTL for key
     */
    async ttl(key) {
        try {
            const fullKey = this.prefix + key;
            return await this.redis.ttl(fullKey);
        }
        catch (error) {
            console.error('Cache ttl error:', error);
            return -1;
        }
    }
    /**
     * Set TTL for existing key
     */
    async expire(key, ttl) {
        try {
            const fullKey = this.prefix + key;
            await this.redis.expire(fullKey, ttl);
            return true;
        }
        catch (error) {
            console.error('Cache expire error:', error);
            return false;
        }
    }
    /**
     * Get or set (compute if missing)
     */
    async getOrSet(key, compute, ttl) {
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await compute();
        await this.set(key, value, ttl);
        return value;
    }
    /**
     * Increment counter
     */
    async increment(key, amount = 1) {
        try {
            const fullKey = this.prefix + key;
            return await this.redis.incrby(fullKey, amount);
        }
        catch (error) {
            console.error('Cache increment error:', error);
            return 0;
        }
    }
    /**
     * Decrement counter
     */
    async decrement(key, amount = 1) {
        return this.increment(key, -amount);
    }
    /**
     * Get multiple keys
     */
    async mget(keys) {
        try {
            const fullKeys = keys.map(k => this.prefix + k);
            const results = await this.redis.mget(...fullKeys);
            return results.map(data => {
                if (!data)
                    return null;
                try {
                    return JSON.parse(data);
                }
                catch {
                    return null;
                }
            });
        }
        catch (error) {
            console.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }
    /**
     * Set multiple keys
     */
    async mset(items, ttl) {
        try {
            const pipeline = this.redis.pipeline();
            const expires = ttl || this.defaultTTL;
            for (const { key, value } of items) {
                const fullKey = this.prefix + key;
                const data = JSON.stringify(value);
                pipeline.setex(fullKey, expires, data);
            }
            await pipeline.exec();
            return true;
        }
        catch (error) {
            console.error('Cache mset error:', error);
            return false;
        }
    }
    /**
     * Delete keys matching pattern
     */
    async deletePattern(pattern) {
        try {
            const fullPattern = this.prefix + pattern;
            const keys = await this.redis.keys(fullPattern);
            if (keys.length === 0) {
                return 0;
            }
            await this.redis.del(...keys);
            return keys.length;
        }
        catch (error) {
            console.error('Cache deletePattern error:', error);
            return 0;
        }
    }
    /**
     * Flush all cache (use with caution)
     */
    async flush() {
        try {
            await this.redis.flushdb();
            return true;
        }
        catch (error) {
            console.error('Cache flush error:', error);
            return false;
        }
    }
    /**
     * Get cache stats
     */
    async stats() {
        try {
            const info = await this.redis.info('memory');
            const keys = await this.redis.dbsize();
            // Parse memory usage
            const memoryMatch = info.match(/used_memory_human:(\S+)/);
            const memory = memoryMatch ? memoryMatch[1] : 'unknown';
            // Get hit/miss stats (if available)
            const statsInfo = await this.redis.info('stats');
            const hitsMatch = statsInfo.match(/keyspace_hits:(\d+)/);
            const missesMatch = statsInfo.match(/keyspace_misses:(\d+)/);
            return {
                keys,
                memory,
                hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
                misses: missesMatch ? parseInt(missesMatch[1]) : 0,
            };
        }
        catch (error) {
            console.error('Cache stats error:', error);
            return {
                keys: 0,
                memory: 'unknown',
                hits: 0,
                misses: 0,
            };
        }
    }
    /**
     * Close connection
     */
    async close() {
        await this.redis.quit();
    }
}
exports.Cache = Cache;
exports.default = Cache;
//# sourceMappingURL=cache.js.map