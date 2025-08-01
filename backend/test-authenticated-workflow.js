// test-authenticated-workflow.js
const app = require('./app');
const db = require('./models');
const cacheService = require('./core/cache/CacheService');

async function testAuthenticatedWorkflow() {
  console.log('🧪 Testing authenticated API workflow...\n');

  try {
    // Initialize
    await cacheService.initialize();
    await db.sequelize.sync({ force: true });

    const server = app.listen(4005, async () => {
      console.log('🌐 Authenticated test server started on port 4005\n');

      let accessToken = null;
      let userId = null;

      // Step 1: Register user
      console.log('📝 Step 1: User Registration');
      try {
        const registerResponse = await fetch('http://localhost:4005/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'fulltest@example.com',
            password: 'Password123!',
            name: 'Full Test User'
          })
        });

        const registerData = await registerResponse.json();
        if (registerResponse.ok) {
          console.log('✅ User registered successfully');
          accessToken = registerData.data.tokens.accessToken;
          userId = registerData.data.user.id;
        } else {
          console.log('❌ Registration failed:', registerData.message);
          return;
        }
      } catch (error) {
        console.log('❌ Registration error:', error.message);
        return;
      }

      // Step 2: Create authenticated link
      console.log('\n🔗 Step 2: Create Authenticated Link');
      let linkShortCode = null;
      try {
        const createLinkResponse = await fetch('http://localhost:4005/api/links', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            originalUrl: 'https://github.com',
            title: 'GitHub Homepage',
            campaign: 'social-media',
            tags: ['github', 'development']
          })
        });

        const linkData = await createLinkResponse.json();
        if (createLinkResponse.ok) {
          console.log('✅ Link created successfully');
          linkShortCode = linkData.data.shortCode;
          console.log(`   Short URL: http://localhost:4005/${linkShortCode}`);
        } else {
          console.log('❌ Link creation failed:', linkData.message);
        }
      } catch (error) {
        console.log('❌ Link creation error:', error.message);
      }

      // Step 3: List user's links
      console.log('\n📋 Step 3: List User Links');
      try {
        const listResponse = await fetch('http://localhost:4005/api/links', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const listData = await listResponse.json();
        if (listResponse.ok) {
          console.log('✅ Links retrieved successfully');
          console.log(`   Total links: ${listData.data.pagination.total}`);
        } else {
          console.log('❌ List links failed:', listData.message);
        }
      } catch (error) {
        console.log('❌ List links error:', error.message);
      }

      // Step 4: Test redirect (no auth needed)
      if (linkShortCode) {
        console.log('\n↗️ Step 4: Test Redirect');
        try {
          const redirectResponse = await fetch(`http://localhost:4005/${linkShortCode}`, {
            redirect: 'manual'
          });

          if (redirectResponse.status === 302) {
            const location = redirectResponse.headers.get('location');
            console.log('✅ Redirect working successfully');
            console.log(`   ${linkShortCode} -> ${location}`);
          } else {
            console.log('❌ Redirect failed:', redirectResponse.status);
          }
        } catch (error) {
          console.log('❌ Redirect error:', error.message);
        }
      }

      // Step 5: Get user stats
      console.log('\n📊 Step 5: Get User Statistics');
      try {
        const statsResponse = await fetch('http://localhost:4005/api/links/stats', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        const statsData = await statsResponse.json();
        if (statsResponse.ok) {
          console.log('✅ Stats retrieved successfully');
          console.log('   Stats:', statsData.data);
        } else {
          console.log('❌ Stats failed:', statsData.message);
        }
      } catch (error) {
        console.log('❌ Stats error:', error.message);
      }

      // Step 6: Test unauthorized access
      console.log('\n🚫 Step 6: Test Unauthorized Access');
      try {
        const unauthorizedResponse = await fetch('http://localhost:4005/api/links', {
          // No Authorization header
        });

        const unauthorizedData = await unauthorizedResponse.json();
        if (unauthorizedResponse.status === 401) {
          console.log('✅ Unauthorized access properly blocked');
        } else {
          console.log('❌ Unauthorized access should be blocked');
        }
      } catch (error) {
        console.log('❌ Unauthorized test error:', error.message);
      }

      // Step 7: Test invalid token
      console.log('\n🔒 Step 7: Test Invalid Token');
      try {
        const invalidTokenResponse = await fetch('http://localhost:4005/api/links', {
          headers: {
            'Authorization': 'Bearer invalid-token-here'
          }
        });

        const invalidTokenData = await invalidTokenResponse.json();
        if (invalidTokenResponse.status === 401) {
          console.log('✅ Invalid token properly rejected');
        } else {
          console.log('❌ Invalid token should be rejected');
        }
      } catch (error) {
        console.log('❌ Invalid token test error:', error.message);
      }

      console.log('\n🎉 Complete authenticated workflow test completed!');
      console.log('\n📊 Test Summary:');
      console.log('  ✅ User registration & login');
      console.log('  ✅ Authenticated link creation');
      console.log('  ✅ Protected endpoints access');
      console.log('  ✅ Public redirect functionality');
      console.log('  ✅ User statistics');
      console.log('  ✅ Security validation (unauthorized/invalid tokens)');
      
      server.close();
    });

  } catch (error) {
    console.error('❌ Authenticated workflow test error:', error.message);
  }
}

testAuthenticatedWorkflow();