// SỬA FILE: backend/server.js
// Proper handling khi ES fail

const app = require('./app');
const { sequelize } = require('./models');
const cacheService = require('./core/cache/CacheService');
const esConnection = require('./config/elasticsearch');
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

    // 4. Connect to ElasticSearch - IMPROVED HANDLING
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
      
      // Trong production có thể muốn fail hard
      if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_ELASTICSEARCH === 'true') {
        console.error('💥 ElasticSearch required in production but connection failed');
        process.exit(1);
      }
    }

    // 5. Initialize LinkService (which initializes QueueService)
    console.log('🔗 Initializing services...');
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