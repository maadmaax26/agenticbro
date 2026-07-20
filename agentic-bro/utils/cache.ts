/**
 * Redis Cache Utility
 * 
 * Provides caching for scan results and user data
 */

import { Redis } from 'ioredis';

interface CacheOptions {
  ttl?: number;        // Time to live in seconds
  prefix?: string;     // Key prefix
}

export class Cache {
  private redis: Redis;
  private defaultTTL: number;
  private prefix: string;

  constructor(redisUrl: string = 'redis://localhost:6379', options: CacheOptions = {}) {
    this.redis = new Redis(redisUrl);
    this.defaultTTL = options.ttl || 3600; // Default 1 hour
    this.prefix = options.prefix || 'agenticbro:';
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.prefix + key;
      const data = await this.redis.get(fullKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;

    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const fullKey = this.prefix + key;
      const data = JSON.stringify(value);
      const expires = ttl || this.defaultTTL;

      await this.redis.setex(fullKey, expires, data);

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.prefix + key;
      await this.redis.del(fullKey);
      return true;

    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.prefix + key;
      const result = await this.redis.exists(fullKey);
      return result === 1;

    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.prefix + key;
      return await this.redis.ttl(fullKey);

    } catch (error) {
      console.error('Cache ttl error:', error);
      return -1;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = this.prefix + key;
      await this.redis.expire(fullKey, ttl);
      return true;

    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get or set (compute if missing)
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);

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
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.prefix + key;
      return await this.redis.incrby(fullKey, amount);

    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  /**
   * Get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(k => this.prefix + k);
      const results = await this.redis.mget(...fullKeys);

      return results.map(data => {
        if (!data) return null;
        try {
          return JSON.parse(data) as T;
        } catch {
          return null;
        }
      });

    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys
   */
  async mset<T>(items: { key: string; value: T }[], ttl?: number): Promise<boolean> {
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

    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.prefix + pattern;
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      return keys.length;

    } catch (error) {
      console.error('Cache deletePattern error:', error);
      return 0;
    }
  }

  /**
   * Flush all cache (use with caution)
   */
  async flush(): Promise<boolean> {
    try {
      await this.redis.flushdb();
      return true;

    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache stats
   */
  async stats(): Promise<{
    keys: number;
    memory: string;
    hits: number;
    misses: number;
  }> {
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

    } catch (error) {
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
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export default Cache;