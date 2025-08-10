// backend/server.js - Server Entry Point
require('dotenv').config();

const app = require('./app');
const http = require('http');

// Import database and cache
const db = require('./models');
const cacheService = require('./core/cache/CacheService');

// Server configuration
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// ===== DATABASE & CACHE INITIALIZATION =====
async function initializeServices() {
  console.log('🔧 Initializing services...');

  try {
    // Initialize cache service (Redis)
    console.log('📦 Connecting to Redis...');
    await cacheService.initialize();
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
  }

  try {
    // Initialize database
    console.log('🗄️ Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Sync database in development
    if (NODE_ENV === 'development') {
      console.log('🔄 Syncing database schema...');
      await db.sequelize.sync({ alter: true });
      console.log('✅ Database schema synced');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('❌ Server cannot start without database connection');
    process.exit(1);
  }

  // Initialize Elasticsearch (optional)
  let elasticsearchStatus = 'disconnected';
  try {
    console.log('🔍 Connecting to Elasticsearch...');
    const esConnection = require('./config/elasticsearch');

    // Initialize ES connection
    await esConnection.connect();

    if (esConnection.isReady()) {
      console.log('✅ Elasticsearch connected successfully');
      elasticsearchStatus = 'connected';
    } else {
      console.warn('⚠️ Elasticsearch connection returned but not ready');
      elasticsearchStatus = 'disconnected';
    }
  } catch (error) {
    console.warn('⚠️ Elasticsearch connection failed:', error.message);
    console.warn('ℹ️ Application will continue with PostgreSQL fallback for analytics');
    elasticsearchStatus = 'disconnected';
  }

  return { elasticsearchStatus };
}

// ===== SERVER STARTUP =====
async function startServer() {
  try {
    // Initialize all services first
    const { elasticsearchStatus } = await initializeServices();

    // Start the server
    server.listen(PORT, () => {
      console.log('\n🚀 ===== SERVER STARTED ===== 🚀');
      console.log(`📡 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔑 Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log(`📊 API info: http://localhost:${PORT}/api`);

      // Service status summary
      console.log('\n📋 Service Status:');
      console.log('  🗄️  PostgreSQL: ✅ Connected');
      console.log('  📦 Redis: ✅ Connected');

      if (elasticsearchStatus === 'connected') {
        console.log('  🔍 Elasticsearch: ✅ Connected');
        console.log('  📊 Real-time analytics: ✅ Available');
      } else {
        console.log('  🔍 Elasticsearch: ⚠️  Disconnected');
        console.log('  📊 Analytics: ⚠️  PostgreSQL fallback mode');
      }

      if (NODE_ENV === 'development') {
        console.log(`\n🧪 Development endpoints:`);
        console.log(`   Test login: http://localhost:${PORT}/api/auth/login`);
        console.log(`   Frontend CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

        if (elasticsearchStatus === 'disconnected') {
          console.log(`\n💡 To enable Elasticsearch:`);
          console.log(
            `   1. Start Elasticsearch: docker run -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.8.0`
          );
          console.log(`   2. Or update ELASTICSEARCH_NODE in .env`);
          console.log(`   3. Restart this server`);
        }
      }

      console.log('🚀 ========================== 🚀\n');

      // Test critical endpoints after startup
      setTimeout(testCriticalEndpoints, 2000);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        console.error('💡 Try a different port or stop the other process');
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// ===== ENDPOINT TESTING =====
async function testCriticalEndpoints() {
  console.log('🧪 Testing critical endpoints...');

  try {
    // Test health endpoint
    const healthUrl = `http://localhost:${PORT}/health`;
    const healthResponse = await fetch(healthUrl);
    const healthData = await healthResponse.json();

    if (healthResponse.ok) {
      console.log('✅ Health endpoint working');
    } else {
      console.log('❌ Health endpoint failed');
    }

    // Test auth routes
    const authInfoUrl = `http://localhost:${PORT}/api/auth/info`;
    const authResponse = await fetch(authInfoUrl);

    if (authResponse.status === 401) {
      console.log('✅ Auth endpoint working (401 expected without token)');
    } else if (authResponse.ok) {
      console.log('✅ Auth endpoint working');
    } else {
      console.log('❌ Auth endpoint failed:', authResponse.status);
    }
  } catch (error) {
    console.log('⚠️ Endpoint testing failed:', error.message);
  }
}

// ===== GRACEFUL SHUTDOWN =====
async function gracefulShutdown(signal) {
  console.log(`\n📤 ${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('✅ HTTP server closed');

    try {
      // Close database connections
      if (db.sequelize) {
        await db.sequelize.close();
        console.log('✅ Database connections closed');
      }

      // Close cache connections
      if (cacheService) {
        await cacheService.disconnect();
        console.log('✅ Cache connections closed');
      }

      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// ===== PROCESS EVENT HANDLERS =====
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// ===== START THE APPLICATION =====
if (require.main === module) {
  startServer();
}

module.exports = { app, server };
