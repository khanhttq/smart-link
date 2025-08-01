// core/database/RedisConnection.js
const Redis = require('ioredis');
const config = require('../../config');

class RedisConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryDelayOnFailover: config.redis.retryDelayOnFailover || 100,
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest || 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000
      });

      // Event listeners
      this.client.on('connect', () => {
        console.log('🔗 Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis error:', error.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('📴 Redis connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.client.ping();
      console.log('✅ Redis connection successful');

      return this.client;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      throw error;
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  // Health check
  async ping() {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new RedisConnection();