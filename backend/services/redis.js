// backend/services/redis.js
const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      console.log('🔌 Connecting to Redis at localhost:6379...');

      // Use URL format for Redis v4+
      this.client = redis.createClient({
        url: 'redis://localhost:6379',
      });

      this.client.on('error', err => {
        console.error('❌ Redis Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔌 Redis Connected');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis Ready');
        this.isConnected = true;
      });

      // Connect to Redis
      await this.client.connect();

      // Test ping
      const pong = await this.client.ping();
      console.log('🏓 Redis ping result:', pong);

      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Redis disconnected');
    }
  }

  // =================== LINK CACHING ===================

  // Cache shortlink data for fast lookups
  async cacheLink(shortCode, linkData, ttl = 3600) {
    if (!this.isConnected) return false;

    try {
      const key = `link:${shortCode}`;
      await this.client.setEx(key, ttl, JSON.stringify(linkData));
      console.log(`💾 Cached link: ${shortCode}`);
      return true;
    } catch (error) {
      console.error('Cache link error:', error);
      return false;
    }
  }

  // Get cached link data
  async getCachedLink(shortCode) {
    if (!this.isConnected) return null;

    try {
      const key = `link:${shortCode}`;
      const cached = await this.client.get(key);

      if (cached) {
        console.log(`⚡ Cache hit: ${shortCode}`);
        return JSON.parse(cached);
      }

      console.log(`💔 Cache miss: ${shortCode}`);
      return null;
    } catch (error) {
      console.error('Get cached link error:', error);
      return null;
    }
  }

  // Remove cached link
  async removeCachedLink(shortCode) {
    if (!this.isConnected) return false;

    try {
      const key = `link:${shortCode}`;
      await this.client.del(key);
      console.log(`🗑️ Removed cache: ${shortCode}`);
      return true;
    } catch (error) {
      console.error('Remove cached link error:', error);
      return false;
    }
  }

  // =================== CLICK TRACKING ===================

  // Increment click count in real-time
  async incrementClickCount(shortCode) {
    if (!this.isConnected) return 0;

    try {
      const key = `clicks:${shortCode}`;
      const newCount = await this.client.incr(key);

      // Set expiration for cleanup (30 days)
      await this.client.expire(key, 30 * 24 * 3600);

      console.log(`📈 Click count for ${shortCode}: ${newCount}`);
      return newCount;
    } catch (error) {
      console.error('Increment click count error:', error);
      return 0;
    }
  }

  // Get real-time click count
  async getClickCount(shortCode) {
    if (!this.isConnected) return 0;

    try {
      const key = `clicks:${shortCode}`;
      const count = await this.client.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      console.error('Get click count error:', error);
      return 0;
    }
  }

  // =================== POPULAR LINKS ===================

  // Track popular links with sorted sets
  async trackPopularLink(shortCode, score = 1) {
    if (!this.isConnected) return false;

    try {
      const key = 'popular:links';
      await this.client.zIncrBy(key, score, shortCode);

      // Keep only top 100 popular links
      await this.client.zRemRangeByRank(key, 0, -101);

      console.log(`🔥 Tracked popular link: ${shortCode}`);
      return true;
    } catch (error) {
      console.error('Track popular link error:', error);
      return false;
    }
  }

  // Get top popular links
  async getPopularLinks(limit = 10) {
    if (!this.isConnected) return [];

    try {
      const key = 'popular:links';
      const popular = await this.client.zRevRange(key, 0, limit - 1, {
        BY: 'SCORE',
        WITHSCORES: true,
      });

      // Convert to array of objects
      const result = [];
      for (let i = 0; i < popular.length; i += 2) {
        result.push({
          shortCode: popular[i],
          score: parseInt(popular[i + 1]),
        });
      }

      return result;
    } catch (error) {
      console.error('Get popular links error:', error);
      return [];
    }
  }

  // =================== RATE LIMITING ===================

  // Advanced rate limiting per user
  async checkRateLimit(userId, limit = 10, window = 3600) {
    if (!this.isConnected) return { allowed: true, remaining: limit };

    try {
      const key = `ratelimit:${userId}`;
      const current = await this.client.get(key);

      if (!current) {
        // First request in window
        await this.client.setEx(key, window, '1');
        return { allowed: true, remaining: limit - 1, resetTime: Date.now() + window * 1000 };
      }

      const count = parseInt(current);
      if (count >= limit) {
        const ttl = await this.client.ttl(key);
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + ttl * 1000,
          message: 'Rate limit exceeded',
        };
      }

      // Increment counter
      await this.client.incr(key);
      return { allowed: true, remaining: limit - count - 1 };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit }; // Allow on error
    }
  }

  // =================== ANALYTICS ===================

  // Store real-time analytics
  async logAnalytics(event, data) {
    if (!this.isConnected) return false;

    try {
      const key = `analytics:${event}:${new Date().toISOString().split('T')[0]}`;
      const logEntry = {
        timestamp: Date.now(),
        ...data,
      };

      await this.client.lPush(key, JSON.stringify(logEntry));

      // Keep only last 1000 entries per day
      await this.client.lTrim(key, 0, 999);

      // Set expiration (keep for 30 days)
      await this.client.expire(key, 30 * 24 * 3600);

      return true;
    } catch (error) {
      console.error('Log analytics error:', error);
      return false;
    }
  }

  // Get analytics data
  async getAnalytics(event, date = null) {
    if (!this.isConnected) return [];

    try {
      const dateStr = date || new Date().toISOString().split('T')[0];
      const key = `analytics:${event}:${dateStr}`;
      const logs = await this.client.lRange(key, 0, -1);

      return logs.map(log => JSON.parse(log));
    } catch (error) {
      console.error('Get analytics error:', error);
      return [];
    }
  }

  // =================== UTILITY METHODS ===================

  // Health check
  async ping() {
    if (!this.isConnected) return false;

    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error) {
      console.error('Redis ping error:', error);
      return false;
    }
  }

  // Get Redis info
  async getInfo() {
    if (!this.isConnected) return null;

    try {
      const info = await this.client.info();
      return info;
    } catch (error) {
      console.error('Get Redis info error:', error);
      return null;
    }
  }

  // Clear all cache (use with caution)
  async clearAll() {
    if (!this.isConnected) return false;

    try {
      await this.client.flushAll();
      console.log('🧹 Redis cache cleared');
      return true;
    } catch (error) {
      console.error('Clear cache error:', error);
      return false;
    }
  }
}

// Export singleton instance
const redisService = new RedisService();
module.exports = redisService;
