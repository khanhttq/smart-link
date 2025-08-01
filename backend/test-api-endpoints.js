// test-api-endpoints.js
const app = require('./app');
const db = require('./models');
const cacheService = require('./core/cache/CacheService');

async function testAPIEndpoints() {
  console.log('🧪 Testing API endpoints with real data...\n');

  try {
    // Initialize
    await cacheService.initialize();
    await db.sequelize.sync({ force: true });

    // Start test server
    const server = app.listen(4003, async () => {
      console.log('🌐 Test server started on port 4003\n');

      // Create a test user first
      const testUser = await db.User.create({
        email: 'apitest@example.com',
        name: 'API Test User',
        password: 'Password123!'
      });
      console.log('✅ Test user created:', testUser.id);

      // Test API endpoints
      const tests = [
        {
          name: 'Create Link',
          method: 'POST',
          url: '/api/links',
          body: {
            userId: testUser.id,
            originalUrl: 'https://google.com',
            title: 'Google Search',
            campaign: 'api-test'
          }
        },
        {
          name: 'List Links',
          method: 'GET',
          url: `/api/links?userId=${testUser.id}`
        },
        {
          name: 'Get Stats',
          method: 'GET',
          url: `/api/links/stats?userId=${testUser.id}`
        },
        {
          name: 'Create Custom Link',
          method: 'POST',
          url: '/api/links',
          body: {
            userId: testUser.id,
            originalUrl: 'https://github.com',
            customCode: 'gh123',
            title: 'GitHub'
          }
        }
      ];

      let createdLink = null;

      for (const test of tests) {
        try {
          console.log(`🔍 Testing: ${test.name}`);
          
          const options = {
            method: test.method,
            headers: { 'Content-Type': 'application/json' }
          };

          if (test.body) {
            options.body = JSON.stringify(test.body);
          }

          const response = await fetch(`http://localhost:4003${test.url}`, options);
          const data = await response.json();

          if (response.ok) {
            console.log(`✅ ${test.name}: Success`);
            if (test.name === 'Create Link' && data.data) {
              createdLink = data.data;
              console.log(`   Short URL: http://localhost:4003/${createdLink.shortCode}`);
            }
          } else {
            console.log(`❌ ${test.name}: ${data.message || data.error}`);
          }
        } catch (error) {
          console.log(`❌ ${test.name}: ${error.message}`);
        }
      }

      // Test redirect functionality
      if (createdLink) {
        console.log('\n🔗 Testing redirect functionality...');
        try {
          const redirectResponse = await fetch(`http://localhost:4003/${createdLink.shortCode}`, {
            redirect: 'manual' // Don't follow redirects
          });
          
          if (redirectResponse.status === 302) {
            const location = redirectResponse.headers.get('location');
            console.log(`✅ Redirect working: ${createdLink.shortCode} -> ${location}`);
          } else {
            console.log(`❌ Redirect failed: ${redirectResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ Redirect test error: ${error.message}`);
        }

        // Test preview functionality
        console.log('\n👁️ Testing preview functionality...');
        try {
          const previewResponse = await fetch(`http://localhost:4003/preview/${createdLink.shortCode}`);
          const previewData = await previewResponse.json();
          
          if (previewResponse.ok) {
            console.log(`✅ Preview working: ${previewData.data.originalUrl}`);
          } else {
            console.log(`❌ Preview failed: ${previewData.message}`);
          }
        } catch (error) {
          console.log(`❌ Preview test error: ${error.message}`);
        }
      }

      console.log('\n🎉 API endpoints testing completed!');
      server.close();
    });

  } catch (error) {
    console.error('❌ API test error:', error.message);
  }
}

testAPIEndpoints();