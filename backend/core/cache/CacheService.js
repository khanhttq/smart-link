// core/cache/CacheService.js
const redisConnection = require('../database/RedisConnection');

class CacheService {
  constructor() {
    this.redis = null;
    this.defaultTTL = 3600; // 1 hour
  }

  async initialize() {
    this.redis = await redisConnection.connect();
    return this.redis;
  }

  // Basic operations
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  async del(key) {
    try {
      return await this.redis.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error.message);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error.message);
      return false;
    }
  }

  // Advanced operations
  async getOrSet(key, fetcher, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value !== null) {
        return value;
      }

      // If not in cache, fetch the data
      value = await fetcher();
      
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }
      
      return value;
    } catch (error) {
      console.error(`Cache getOrSet error for key ${key}:`, error.message);
      // If cache fails, still return fetched data
      return await fetcher();
    }
  }

  // Link-specific cache methods
  async getLinkByShortCode(shortCode) {
    return await this.get(`link:${shortCode}`);
  }

  async setLinkCache(shortCode, linkData, ttl = 7200) { // 2 hours
    return await this.set(`link:${shortCode}`, linkData, ttl);
  }

  async deleteLinkCache(shortCode) {
    return await this.del(`link:${shortCode}`);
  }

  // User session cache
  async setUserSession(sessionId, userData, ttl = 86400) { // 24 hours
    return await this.set(`session:${sessionId}`, userData, ttl);
  }

  async getUserSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  async deleteUserSession(sessionId) {
    return await this.del(`session:${sessionId}`);
  }

  // Analytics cache
  async cacheAnalytics(key, data, ttl = 300) { // 5 minutes
    return await this.set(`analytics:${key}`, data, ttl);
  }

  async getAnalyticsCache(key) {
    return await this.get(`analytics:${key}`);
  }

  // Batch operations
  async mget(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error.message);
      return new Array(keys.length).fill(null);
    }
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const [key, value] of keyValuePairs) {
        const serialized = JSON.stringify(value);
        if (ttl) {
          pipeline.setex(key, ttl, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error.message);
      return false;
    }
  }

  // Cache statistics
  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      const stats = await this.redis.info('stats');
      
      return {
        memory: info,
        keyspace: keyspace,
        stats: stats,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      console.error('Cache stats error:', error.message);
      return null;
    }
  }

  // Clear cache by pattern
  async clearPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        return await this.redis.del(...keys);
      }
      return 0;
    } catch (error) {
      console.error(`Cache clear pattern error for ${pattern}:`, error.message);
      return 0;
    }
  }
}

module.exports = new CacheService();