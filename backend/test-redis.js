// test-redis.js
const cacheService = require('./core/cache/CacheService');

async function testRedis() {
  console.log('🧪 Testing Redis connection and caching...\n');

  try {
    // Initialize Redis connection
    await cacheService.initialize();
    console.log('✅ Redis connection initialized');

    // Test basic operations
    console.log('\n📝 Testing basic cache operations...');
    
    // Set a value
    await cacheService.set('test:key', { message: 'Hello Redis!' }, 60);
    console.log('✅ Set cache value');

    // Get the value
    const value = await cacheService.get('test:key');
    console.log('✅ Get cache value:', value);

    // Test exists
    const exists = await cacheService.exists('test:key');
    console.log('✅ Key exists:', exists);

    // Test getOrSet
    const result = await cacheService.getOrSet(
      'test:fetch',
      async () => {
        console.log('  Fetching data...');
        return { data: 'Fetched from source', timestamp: new Date() };
      },
      30
    );
    console.log('✅ GetOrSet result:', result);

    // Test link caching
    console.log('\n🔗 Testing link caching...');
    
    const linkData = {
      id: 'test-uuid',
      originalUrl: 'https://google.com',
      userId: 'user-uuid',
      title: 'Test Link'
    };
    
    await cacheService.setLinkCache('test123', linkData);
    console.log('✅ Link cached');
    
    const cachedLink = await cacheService.getLinkByShortCode('test123');
    console.log('✅ Retrieved cached link:', cachedLink);

    // Test session caching
    console.log('\n👤 Testing session caching...');
    
    const sessionData = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user'
    };
    
    await cacheService.setUserSession('session-abc', sessionData);
    console.log('✅ Session cached');
    
    const cachedSession = await cacheService.getUserSession('session-abc');
    console.log('✅ Retrieved cached session:', cachedSession);

    // Test batch operations
    console.log('\n📦 Testing batch operations...');
    
    const keyValuePairs = [
      ['batch:1', { value: 1 }],
      ['batch:2', { value: 2 }],
      ['batch:3', { value: 3 }]
    ];
    
    await cacheService.mset(keyValuePairs, 60);
    console.log('✅ Batch set completed');
    
    const batchValues = await cacheService.mget(['batch:1', 'batch:2', 'batch:3']);
    console.log('✅ Batch get results:', batchValues);

    // Test cache stats
    console.log('\n📊 Cache statistics...');
    const stats = await cacheService.getStats();
    console.log('✅ Cache stats retrieved');

    // Cleanup test keys
    console.log('\n🧹 Cleaning up test keys...');
    await cacheService.clearPattern('test:*');
    await cacheService.clearPattern('batch:*');
    await cacheService.deleteLinkCache('test123');
    await cacheService.deleteUserSession('session-abc');
    console.log('✅ Cleanup completed');

    console.log('\n🎉 Redis and caching test completed successfully!');

  } catch (error) {
    console.error('❌ Redis test error:', error.message);
  }
}

testRedis();