// backend/clear-cache.js
const cacheService = require('./core/cache/CacheService');

async function clearCache() {
  try {
    await cacheService.initialize();
    
    // Clear specific patterns
    await cacheService.redis.flushdb();
    
    console.log('✅ Redis cache cleared!');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    process.exit(0);
  }
}

clearCache();