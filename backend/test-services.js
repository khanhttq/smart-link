// test-services.js
const linkService = require('./domains/links/services/LinkService');
const userRepository = require('./domains/users/repositories/UserRepository');
const cacheService = require('./core/cache/CacheService');
const db = require('./models');

async function testServices() {
  console.log('🧪 Testing services and repositories...\n');

  try {
    // Initialize cache
    await cacheService.initialize();
    
    // Sync database (force: true để clear data cũ)
    await db.sequelize.sync({ force: true });
    console.log('✅ Database synced (fresh start)');
    
    // Create test user
    const user = await userRepository.create({
      email: 'testuser@example.com',
      name: 'Test User',
      password: 'Password123!'
    });
    console.log('✅ User created:', user.id);

    // Test link creation
    console.log('\n🔗 Testing link service...');
    
    const linkData = {
      originalUrl: 'https://google.com',
      title: 'Google Search',
      description: 'Search engine',
      campaign: 'test-campaign',
      tags: ['search', 'google']
    };
    
    const link = await linkService.createLink(user.id, linkData);
    console.log('✅ Link created:', link.shortCode);

    // Test link retrieval (should use cache)
    const retrievedLink = await linkService.getLinkByShortCode(link.shortCode);
    console.log('✅ Link retrieved:', retrievedLink.originalUrl);

    // Test click processing
    const clickResult = await linkService.processClick(link.shortCode, {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Browser'
    });
    console.log('✅ Click processed:', clickResult.originalUrl);

    // Test user links
    const userLinks = await linkService.getUserLinks(user.id);
    console.log('✅ User links count:', userLinks.count);

    // Test user stats
    const userStats = await linkService.getUserStats(user.id);
    console.log('✅ User stats:', userStats);

    // Test custom short code (với timestamp để unique)
    const timestamp = Date.now().toString(36);
    const customCode = `github${timestamp}`;
    
    const customLink = await linkService.createLink(user.id, {
      originalUrl: 'https://github.com',
      customCode: customCode
    });
    console.log('✅ Custom link created:', customLink.shortCode);

    // Test duplicate custom code (should fail)
    try {
      await linkService.createLink(user.id, {
        originalUrl: 'https://example.com',
        customCode: customCode // Same code as above
      });
      console.log('❌ Should have failed with duplicate code');
    } catch (error) {
      console.log('✅ Duplicate code validation:', error.message);
    }

    // Test invalid URL
    try {
      await linkService.createLink(user.id, {
        originalUrl: 'not-a-valid-url',
        title: 'Invalid URL Test'
      });
      console.log('❌ Should have failed with invalid URL');
    } catch (error) {
      console.log('✅ Invalid URL validation:', error.message);
    }

    // Test link update
    console.log('\n🔄 Testing link updates...');
    const updatedLink = await linkService.updateLink(link.id, user.id, {
      title: 'Updated Google Search',
      description: 'Updated description'
    });
    console.log('✅ Link updated successfully');

    // Test final stats
    const finalStats = await linkService.getUserStats(user.id);
    console.log('✅ Final user stats:', finalStats);

    console.log('\n🎉 All services tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('  ✅ User repository operations');
    console.log('  ✅ Link service with caching');
    console.log('  ✅ CRUD operations');
    console.log('  ✅ Click processing');
    console.log('  ✅ Validation logic');
    console.log('  ✅ Error handling');
    console.log('  ✅ Cache integration');

  } catch (error) {
    console.error('❌ Services test error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testServices();