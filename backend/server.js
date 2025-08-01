// server.js
const app = require('./app');
const { sequelize } = require('./models');
const cacheService = require('./core/cache/CacheService');
const esConnection = require('./config/elasticsearch'); // ADDED
const linkService = require('./domains/links/services/LinkService'); // ADDED

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

    // 4. Connect to ElasticSearch - ADDED
    console.log('🔍 Connecting to ElasticSearch...');
    try {
      await esConnection.connect();
      console.log('✅ ElasticSearch connected');
    } catch (error) {
      console.warn('⚠️ ElasticSearch connection failed, using mock client');
    }

    // 5. Initialize LinkService (which initializes QueueService) - ADDED
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
      console.log(`  🗄️  PostgreSQL: Connected`);
      console.log(`  🔄 Redis: Connected`);
      console.log(`  🔍 ElasticSearch: ${esConnection.isReady() ? 'Connected' : 'Mock Mode'}`);
      console.log(`  📋 Queue Service: Running`);
      console.log(`  🔗 Link Service: Ready`);
      console.log('');
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { startServer };