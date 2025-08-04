// TẠO FILE MỚI: backend/services/ElasticSearchMonitor.js
// Service để monitor và notify về trạng thái ES connection

const esConnection = require('../config/elasticsearch');

class ElasticSearchMonitor {
  constructor() {
    this.subscribers = [];
    this.lastStatus = null;
    this.statusHistory = [];
    this.maxHistorySize = 50;
  }

  initialize() {
    // Listen to connection events
    esConnection.onConnectionEvent((event, data) => {
      this.handleConnectionEvent(event, data);
    });

    console.log('✅ ElasticSearch Monitor initialized');
  }

  handleConnectionEvent(event, data) {
    const timestamp = new Date().toISOString();
    const statusEntry = {
      event,
      data,
      timestamp
    };

    // Add to history
    this.statusHistory.unshift(statusEntry);
    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory.pop();
    }

    // Log event
    if (event === 'connected') {
      console.log('🎉 ElasticSearch reconnected!', data);
    } else if (event === 'disconnected') {
      console.warn('⚠️ ElasticSearch disconnected:', data);
    }

    // Update last status
    this.lastStatus = statusEntry;

    // Notify subscribers
    this.notifySubscribers(statusEntry);
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    
    // Send current status to new subscriber
    if (this.lastStatus) {
      callback(this.lastStatus);
    }
  }

  unsubscribe(callback) {
    const index = this.subscribers.indexOf(callback);
    if (index > -1) {
      this.subscribers.splice(index, 1);
    }
  }

  notifySubscribers(statusEntry) {
    this.subscribers.forEach(callback => {
      try {
        callback(statusEntry);
      } catch (error) {
        console.error('ElasticSearch monitor subscriber error:', error);
      }
    });
  }

  getStatus() {
    return {
      connection: esConnection.getStatus(),
      lastEvent: this.lastStatus,
      history: this.statusHistory.slice(0, 10), // Last 10 events
      subscribers: this.subscribers.length
    };
  }

  getFullHistory() {
    return this.statusHistory;
  }

  // Convenience methods for specific notifications
  onReconnected(callback) {
    this.subscribe((statusEntry) => {
      if (statusEntry.event === 'connected') {
        callback(statusEntry);
      }
    });
  }

  onDisconnected(callback) {
    this.subscribe((statusEntry) => {
      if (statusEntry.event === 'disconnected') {
        callback(statusEntry);
      }
    });
  }
}

module.exports = new ElasticSearchMonitor();

// ===== SỬA FILE: backend/server.js =====
// Thêm monitor initialization

const app = require('./app');
const { sequelize } = require('./models');
const cacheService = require('./core/cache/CacheService');
const esConnection = require('./config/elasticsearch');
const esMonitor = require('./services/ElasticSearchMonitor'); // THÊM
const linkService = require('./domains/links/services/LinkService');

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    console.log('🚀 Starting Shortlink Backend...');
    
    // 1. Connect to PostgreSQL
    console.log('📊 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');

    // 2. Run database migrations
    if (process.env.NODE_ENV !== 'test') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized');
    }

    // 3. Connect to Redis
    console.log('🔄 Connecting to Redis...');
    await cacheService.initialize();
    console.log('✅ Redis connected');

    // 4. Initialize ElasticSearch Monitor - THÊM
    console.log('🔍 Initializing ElasticSearch Monitor...');
    esMonitor.initialize();
    
    // Setup notification handlers
    esMonitor.onReconnected((statusEntry) => {
      console.log('🎉 NOTIFICATION: ElasticSearch is back online!');
      console.log(`   → Retry count: ${statusEntry.data.retryCount}`);
      console.log(`   → Time: ${statusEntry.timestamp}`);
    });

    esMonitor.onDisconnected((statusEntry) => {
      console.log('⚠️ NOTIFICATION: ElasticSearch went offline');
      console.log(`   → Error: ${statusEntry.data.error}`);
      console.log(`   → Retry count: ${statusEntry.data.retryCount}`);
    });

    // 5. Connect to ElasticSearch
    console.log('🔍 Connecting to ElasticSearch...');
    let esStatus = 'disconnected';
    
    try {
      await esConnection.connect();
      if (esConnection.isReady()) {
        console.log('✅ ElasticSearch connected');
        esStatus = 'connected';
      } else {
        console.warn('⚠️ ElasticSearch connection returned but not ready');
        esStatus = 'disconnected';
      }
    } catch (error) {
      console.warn('⚠️ ElasticSearch connection failed:', error.message);
      console.warn('ℹ️ Application will continue with PostgreSQL fallback for analytics');
      esStatus = 'disconnected';
    }

    // 6. Initialize LinkService
    console.log('🔗 Initializing services...');
    await linkService.initialize();
    console.log('✅ Services initialized');

    // 7. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🎉 ===============================================');
      console.log(`🚀 Shortlink Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
      console.log('🎉 ===============================================');
      console.log('');
      
      // Log service status
      console.log('📋 Service Status:');
      console.log(`  🗄️  PostgreSQL: ✅ Connected`);
      console.log(`  🔄 Redis: ✅ Connected`);
      
      if (esStatus === 'connected') {
        console.log(`  🔍 ElasticSearch: ✅ Connected`);
      } else {
        console.log(`  🔍 ElasticSearch: ⚠️ Disconnected (Auto-retry enabled)`);
      }
      
      console.log('');
      
      // Show admin endpoints
      console.log('🔧 Admin Endpoints:');
      console.log(`  📊 ES Status: GET ${process.env.API_URL || `http://localhost:${PORT}`}/api/admin/elasticsearch/status`);
      console.log(`  🔄 Manual Retry: POST ${process.env.API_URL || `http://localhost:${PORT}`}/api/admin/elasticsearch/retry`);
      console.log('');
    });

    // Graceful shutdown - UPDATED
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        console.log('📝 HTTP server closed');
        
        // Shutdown ElasticSearch connection and retry mechanism
        try {
          await esConnection.shutdown();
          console.log('🔍 ElasticSearch connection closed');
        } catch (error) {
          console.error('❌ Error closing ElasticSearch:', error.message);
        }
        
        try {
          await sequelize.close();
          console.log('📊 PostgreSQL connection closed');
        } catch (error) {
          console.error('❌ Error closing PostgreSQL:', error.message);
        }
        
        try {
          await cacheService.disconnect();
          console.log('🔄 Redis connection closed');
        } catch (error) {
          console.error('❌ Error closing Redis:', error.message);
        }
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

startServer();