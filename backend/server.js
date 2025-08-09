// SỬA FILE: backend/server.js
// Proper handling khi ES fail

const app = require('./app');
const { sequelize } = require('./models');
const cacheService = require('./core/cache/CacheService');
const esConnection = require('./config/elasticsearch');
const linkService = require('./domains/links/services/LinkService');
const bullMQService = require('./core/queue/BullMQService');

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

    // 4. Connect to ElasticSearch - IMPROVED HANDLING
    console.log('🔍 Connecting to ElasticSearch...');
    let esStatus = 'disconnected';

    try {
      await esConnection.connect();

      // WAIT for connection to be fully ready
      let retries = 0;
      while (!esConnection.isReady() && retries < 10) {
        console.log(`🔄 Waiting for ElasticSearch to be ready... (${retries + 1}/10)`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        retries++;
      }

      if (esConnection.isReady()) {
        console.log('✅ ElasticSearch connected and ready');
        esStatus = 'connected';
      } else {
        console.warn('⚠️ ElasticSearch connection timeout');
        esStatus = 'disconnected';
      }
    } catch (error) {
      console.warn('⚠️ ElasticSearch connection failed:', error.message);
      console.warn('ℹ️ Application will continue with PostgreSQL fallback for analytics');
      esStatus = 'disconnected';
    }

    // 5. Initialize LinkService (BullMQ already initialized above)
    console.log('🔗 Initializing services...');

    // Initialize BullMQ first
    try {
      await bullMQService.initialize();
      console.log('✅ Background job system initialized');
    } catch (error) {
      console.error('⚠️ Background jobs failed to initialize:', error.message);
      console.log('📝 Server will continue without background jobs');
    }

    await linkService.initialize();
    console.log('✅ Services initialized');

    // 6. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🎉 ===============================================');
      console.log(`🚀 Shortlink Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
      console.log(`📝 API Docs: http://localhost:${PORT}/`);
      console.log('🎉 ===============================================');
      console.log('');

      // Log service status
      console.log('📋 Service Status:');
      console.log(`  🗄️  PostgreSQL: ✅ Connected`);
      console.log(`  🔄 Redis: ✅ Connected`);

      if (esStatus === 'connected') {
        console.log(`  🔍 ElasticSearch: ✅ Connected`);
      } else {
        console.log(`  🔍 ElasticSearch: ⚠️ Disconnected (Using PostgreSQL fallback)`);
      }

      console.log('');

      // Show fallback status if needed
      if (esStatus === 'disconnected') {
        console.log('📝 Notes:');
        console.log('  • Analytics will use PostgreSQL fallback');
        console.log('  • Real-time analytics features may be limited');
        console.log('  • To enable ElasticSearch: start ES server and restart app');
        console.log('');
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        console.log('📝 HTTP server closed');

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
        try {
          if (bullMQService.isInitialized) {
            await bullMQService.cleanup();
            console.log('📋 BullMQ connections closed');
          }
        } catch (error) {
          console.error('❌ Error closing BullMQ:', error.message);
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

// Add environment variable to .env.example:
// REQUIRE_ELASTICSEARCH=false  # Set to true in production if ES is mandatory

startServer();
