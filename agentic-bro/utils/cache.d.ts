/**
 * Redis Cache Utility
 *
 * Provides caching for scan results and user data
 */
interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
export declare class Cache {
    private redis;
    private defaultTTL;
    private prefix;
    constructor(redisUrl?: string, options?: CacheOptions);
    /**
     * Get value from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set value in cache
     */
    set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
    /**
     * Delete key from cache
     */
    delete(key: string): Promise<boolean>;
    /**
     * Check if key exists
     */
    exists(key: string): Promise<boolean>;
    /**
     * Get TTL for key
     */
    ttl(key: string): Promise<number>;
    /**
     * Set TTL for existing key
     */
    expire(key: string, ttl: number): Promise<boolean>;
    /**
     * Get or set (compute if missing)
     */
    getOrSet<T>(key: string, compute: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Increment counter
     */
    increment(key: string, amount?: number): Promise<number>;
    /**
     * Decrement counter
     */
    decrement(key: string, amount?: number): Promise<number>;
    /**
     * Get multiple keys
     */
    mget<T>(keys: string[]): Promise<(T | null)[]>;
    /**
     * Set multiple keys
     */
    mset<T>(items: {
        key: string;
        value: T;
    }[], ttl?: number): Promise<boolean>;
    /**
     * Delete keys matching pattern
     */
    deletePattern(pattern: string): Promise<number>;
    /**
     * Flush all cache (use with caution)
     */
    flush(): Promise<boolean>;
    /**
     * Get cache stats
     */
    stats(): Promise<{
        keys: number;
        memory: string;
        hits: number;
        misses: number;
    }>;
    /**
     * Close connection
     */
    close(): Promise<void>;
}
export default Cache;
//# sourceMappingURL=cache.d.ts.map