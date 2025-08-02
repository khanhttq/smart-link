// clear-invalid-tokens.js - Script để clear tất cả token invalidated
const cacheService = require('./core/cache/CacheService');

async function clearInvalidTokens() {
  try {
    console.log('🧹 Clearing all invalid tokens and sessions...\n');

    // 1. Clear all blacklisted tokens
    console.log('1️⃣ Clearing blacklisted tokens...');
    const blacklistKeys = await cacheService.keys('blacklist:*');
    console.log(`Found ${blacklistKeys.length} blacklisted tokens`);
    
    if (blacklistKeys.length > 0) {
      await cacheService.del(blacklistKeys);
      console.log(`✅ Cleared ${blacklistKeys.length} blacklisted tokens`);
    }

    // 2. Clear all sessions
    console.log('\n2️⃣ Clearing all sessions...');
    const sessionKeys = await cacheService.keys('session:*');
    console.log(`Found ${sessionKeys.length} sessions`);
    
    if (sessionKeys.length > 0) {
      await cacheService.del(sessionKeys);
      console.log(`✅ Cleared ${sessionKeys.length} sessions`);
    }

    // 3. Clear all rate limiting keys
    console.log('\n3️⃣ Clearing rate limiting keys...');
    const rateLimitKeys = await cacheService.keys('login:attempt:*');
    console.log(`Found ${rateLimitKeys.length} rate limit keys`);
    
    if (rateLimitKeys.length > 0) {
      await cacheService.del(rateLimitKeys);
      console.log(`✅ Cleared ${rateLimitKeys.length} rate limit keys`);
    }

    // 4. Clear user cache keys
    console.log('\n4️⃣ Clearing user cache keys...');
    const userCacheKeys = await cacheService.keys('user:*');
    console.log(`Found ${userCacheKeys.length} user cache keys`);
    
    if (userCacheKeys.length > 0) {
      await cacheService.del(userCacheKeys);
      console.log(`✅ Cleared ${userCacheKeys.length} user cache keys`);
    }

    // 5. Clear links cache keys
    console.log('\n5️⃣ Clearing links cache keys...');
    const linksCacheKeys = await cacheService.keys('links:*');
    console.log(`Found ${linksCacheKeys.length} links cache keys`);
    
    if (linksCacheKeys.length > 0) {
      await cacheService.del(linksCacheKeys);
      console.log(`✅ Cleared ${linksCacheKeys.length} links cache keys`);
    }

    // 6. Clear stats cache keys
    console.log('\n6️⃣ Clearing stats cache keys...');
    const statsCacheKeys = await cacheService.keys('stats:*');
    console.log(`Found ${statsCacheKeys.length} stats cache keys`);
    
    if (statsCacheKeys.length > 0) {
      await cacheService.del(statsCacheKeys);
      console.log(`✅ Cleared ${statsCacheKeys.length} stats cache keys`);
    }

    // 7. Get Redis info
    console.log('\n7️⃣ Redis status after cleanup...');
    try {
      const allKeys = await cacheService.keys('*');
      console.log(`📊 Total remaining keys: ${allKeys.length}`);
      
      if (allKeys.length > 0) {
        console.log('Remaining key patterns:');
        const patterns = {};
        allKeys.forEach(key => {
          const pattern = key.split(':')[0] + ':*';
          patterns[pattern] = (patterns[pattern] || 0) + 1;
        });
        
        Object.entries(patterns).forEach(([pattern, count]) => {
          console.log(`  - ${pattern}: ${count} keys`);
        });
      }
    } catch (error) {
      console.error('Error getting Redis info:', error);
    }

    console.log('\n🎉 Cache cleanup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Restart backend server');
    console.log('2. Clear browser localStorage/sessionStorage');
    console.log('3. Refresh frontend');
    console.log('4. All users will need to login again');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

// Alternative: Complete Redis flush (nuclear option)
async function nuclearOption() {
  try {
    console.log('💣 NUCLEAR OPTION: Flushing entire Redis database...');
    
    await cacheService.redis.flushdb();
    console.log('✅ Redis database completely flushed');
    
    console.log('\n⚠️  ALL DATA IN REDIS HAS BEEN DELETED');
    console.log('📋 You need to restart the backend server');
    
  } catch (error) {
    console.error('❌ Error during nuclear flush:', error);
  } finally {
    process.exit(0);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--nuclear') || args.includes('-n')) {
  console.log('🚨 Running nuclear option...\n');
  nuclearOption();
} else {
  console.log('🧹 Running selective cleanup...\n');
  clearInvalidTokens();
}