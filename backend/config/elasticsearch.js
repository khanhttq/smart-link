// SỬA FILE: backend/config/elasticsearch.js
// Thêm retry connection mechanism

const { Client } = require('@elastic/elasticsearch');

class ElasticSearchConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionError = null;
    this.retryInterval = null;
    this.retryCount = 0;
    this.maxRetries = -1; // Unlimited retries in background
    this.retryDelays = [5000, 10000, 30000, 60000, 300000]; // 5s, 10s, 30s, 1m, 5m
    this.currentRetryDelay = 0;
    this.lastConnectionAttempt = null;
    this.connectionEventHandlers = [];
  }

  async connect() {
    this.lastConnectionAttempt = new Date();
    
    try {
      console.log('🔍 Attempting to connect to ElasticSearch...');
      
      this.client = new Client({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        requestTimeout: 10000, // Shorter timeout for faster retry
        pingTimeout: 5000,
        maxRetries: 2,
        resurrectStrategy: 'ping'
      });

      // Test connection với timeout ngắn
      const health = await Promise.race([
        this.client.cluster.health(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 8000)
        )
      ]);
      
      console.log('✅ ElasticSearch connected:', health.status);
      this.isConnected = true;
      this.connectionError = null;
      this.retryCount = 0;
      this.currentRetryDelay = 0;

      // Clear any existing retry interval
      if (this.retryInterval) {
        clearInterval(this.retryInterval);
        this.retryInterval = null;
      }

      // Setup indexes
      await this.setupIndexes();

      // Notify connection success
      this.notifyConnectionEvent('connected', {
        message: 'ElasticSearch connected successfully',
        retryCount: this.retryCount
      });

      return this.client;
      
    } catch (error) {
      console.error('❌ ElasticSearch connection failed:', error.message);
      
      this.isConnected = false;
      this.connectionError = error.message;
      this.client = null;
      
      // Notify connection failure
      this.notifyConnectionEvent('disconnected', {
        error: error.message,
        retryCount: this.retryCount
      });
      
      // Start retry mechanism in development and production
      this.startRetryMechanism();
      
      // Trong development: log warning nhưng không crash
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ ElasticSearch unavailable - PostgreSQL fallback will be used');
        console.warn('🔄 Auto-retry mechanism started...');
        return null;
      }
      
      // Trong production: cũng không crash, chỉ log error
      console.error('🔄 ElasticSearch connection failed, starting auto-retry...');
      return null;
    }
  }

  // ===== RETRY MECHANISM =====
  
  startRetryMechanism() {
    // Don't start if already running
    if (this.retryInterval) {
      return;
    }

    console.log('🔄 Starting ElasticSearch retry mechanism...');
    
    this.retryInterval = setInterval(async () => {
      if (this.isConnected) {
        // Stop retrying if connected
        clearInterval(this.retryInterval);
        this.retryInterval = null;
        return;
      }

      this.retryCount++;
      
      // Calculate delay using exponential backoff
      const delayIndex = Math.min(this.retryCount - 1, this.retryDelays.length - 1);
      const delay = this.retryDelays[delayIndex];
      
      console.log(`🔄 ElasticSearch retry attempt #${this.retryCount} (delay: ${delay/1000}s)`);
      
      try {
        await this.connect();
        
        if (this.isConnected) {
          console.log('✅ ElasticSearch reconnected successfully!');
        }
      } catch (error) {
        console.warn(`⚠️ Retry #${this.retryCount} failed:`, error.message);
      }
    }, this.getCurrentRetryDelay());
  }

  getCurrentRetryDelay() {
    const delayIndex = Math.min(this.retryCount, this.retryDelays.length - 1);
    return this.retryDelays[delayIndex];
  }

  stopRetryMechanism() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      console.log('🛑 ElasticSearch retry mechanism stopped');
    }
  }

  // ===== MANUAL RETRY API =====
  
  async manualRetry() {
    console.log('🔄 Manual ElasticSearch retry triggered...');
    
    // Stop automatic retry temporarily
    const wasRetrying = !!this.retryInterval;
    this.stopRetryMechanism();
    
    try {
      await this.connect();
      
      if (this.isConnected) {
        return {
          success: true,
          message: 'ElasticSearch reconnected successfully',
          retryCount: this.retryCount
        };
      } else {
        // Restart automatic retry if it was running
        if (wasRetrying) {
          this.startRetryMechanism();
        }
        
        return {
          success: false,
          message: 'Manual retry failed',
          error: this.connectionError,
          nextAutoRetry: this.getCurrentRetryDelay()
        };
      }
    } catch (error) {
      // Restart automatic retry if it was running
      if (wasRetrying) {
        this.startRetryMechanism();
      }
      
      return {
        success: false,
        message: 'Manual retry failed',
        error: error.message
      };
    }
  }

  // ===== EVENT SYSTEM =====
  
  onConnectionEvent(handler) {
    this.connectionEventHandlers.push(handler);
  }

  notifyConnectionEvent(event, data) {
    this.connectionEventHandlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        console.error('Connection event handler error:', error);
      }
    });
  }

  // ===== EXISTING METHODS =====

  async setupIndexes() {
    if (!this.client || !this.isConnected) {
      console.warn('⚠️ Skipping index setup - ElasticSearch not connected');
      return;
    }

    const indexes = [
      {
        index: 'clicks',
        mapping: {
          properties: {
            linkId: { type: 'keyword' },
            userId: { type: 'keyword' },
            shortCode: { type: 'keyword' },
            originalUrl: { type: 'text' },
            campaign: { type: 'keyword' },
            timestamp: { type: 'date' },
            '@timestamp': { type: 'date' },
            date: { type: 'date' },
            hour: { type: 'date' },
            ipAddress: { type: 'ip' },
            country: { type: 'keyword' },
            city: { type: 'keyword' },
            deviceType: { type: 'keyword' },
            browser: { type: 'keyword' },
            os: { type: 'keyword' },
            referrer: { type: 'text' },
            userAgent: { type: 'text' }
          }
        }
      }
    ];

    for (const { index, mapping } of indexes) {
      try {
        const exists = await this.client.indices.exists({ index });
        
        if (!exists) {
          await this.client.indices.create({
            index,
            body: { mappings: mapping }
          });
          console.log(`✅ Created index: ${index}`);
        }
      } catch (error) {
        console.error(`❌ Error setting up index ${index}:`, error.message);
      }
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client !== null;
  }

  getStatus() {
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      isRetrying: !!this.retryInterval,
      retryCount: this.retryCount,
      lastConnectionAttempt: this.lastConnectionAttempt,
      currentRetryDelay: this.isConnected ? null : this.getCurrentRetryDelay(),
      nextRetryIn: this.retryInterval ? this.getCurrentRetryDelay() : null,
      error: this.connectionError
    };
  }

  async healthCheck() {
    if (!this.isReady()) {
      return {
        status: 'down',
        message: 'ElasticSearch not connected',
        error: this.connectionError,
        retryInfo: {
          isRetrying: !!this.retryInterval,
          retryCount: this.retryCount,
          nextRetryDelay: this.getCurrentRetryDelay()
        }
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'up',
        message: 'ElasticSearch is healthy',
        responseTime: `${responseTime}ms`
      };
    } catch (error) {
      // Connection lost, start retry mechanism
      this.isConnected = false;
      this.connectionError = error.message;
      this.startRetryMechanism();
      
      return {
        status: 'down',
        message: 'ElasticSearch ping failed',
        error: error.message
      };
    }
  }

  // Cleanup on shutdown
  async shutdown() {
    console.log('🛑 Shutting down ElasticSearch connection...');
    this.stopRetryMechanism();
    
    if (this.client) {
      try {
        // ElasticSearch client doesn't have explicit close method
        this.client = null;
        console.log('✅ ElasticSearch client cleaned up');
      } catch (error) {
        console.error('❌ Error cleaning up ElasticSearch client:', error);
      }
    }
  }
}

module.exports = new ElasticSearchConnection();