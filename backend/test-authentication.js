// test-authentication.js
const app = require('./app');
const db = require('./models');
const cacheService = require('./core/cache/CacheService');

async function testAuthentication() {
  console.log('🧪 Testing authentication system...\n');

  try {
    // Initialize
    await cacheService.initialize();
    await db.sequelize.sync({ force: true });

    const server = app.listen(4004, async () => {
      console.log('🌐 Auth test server started on port 4004\n');

      let userTokens = null;

      // Test registration
      console.log('👤 Testing user registration...');
      try {
        const registerResponse = await fetch('http://localhost:4004/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'testauth@example.com',
            password: 'Password123!',
            name: 'Auth Test User'
          })
        });

        const registerData = await registerResponse.json();
        if (registerResponse.ok) {
          console.log('✅ Registration successful');
          userTokens = registerData.data.tokens;
        } else {
          console.log('❌ Registration failed:', registerData.message);
        }
      } catch (error) {
        console.log('❌ Registration error:', error.message);
      }

      // Test login
      console.log('\n🔑 Testing user login...');
      try {
        const loginResponse = await fetch('http://localhost:4004/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'testauth@example.com',
            password: 'Password123!'
          })
        });

        const loginData = await loginResponse.json();
        if (loginResponse.ok) {
          console.log('✅ Login successful');
          userTokens = loginData.data.tokens;
        } else {
          console.log('❌ Login failed:', loginData.message);
        }
      } catch (error) {
        console.log('❌ Login error:', error.message);
      }

      // Test protected route
      if (userTokens) {
        console.log('\n🛡️ Testing protected route...');
        try {
          const profileResponse = await fetch('http://localhost:4004/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${userTokens.accessToken}`
            }
          });

          const profileData = await profileResponse.json();
          if (profileResponse.ok) {
            console.log('✅ Protected route access successful');
            console.log('   User:', profileData.data.user.email);
          } else {
            console.log('❌ Protected route failed:', profileData.message);
          }
        } catch (error) {
          console.log('❌ Protected route error:', error.message);
        }

        // Test token refresh
        console.log('\n🔄 Testing token refresh...');
        try {
          const refreshResponse = await fetch('http://localhost:4004/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refreshToken: userTokens.refreshToken
            })
          });

          const refreshData = await refreshResponse.json();
          if (refreshResponse.ok) {
            console.log('✅ Token refresh successful');
          } else {
            console.log('❌ Token refresh failed:', refreshData.message);
          }
        } catch (error) {
          console.log('❌ Token refresh error:', error.message);
        }

        // Test logout
        console.log('\n👋 Testing logout...');
        try {
          const logoutResponse = await fetch('http://localhost:4004/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${userTokens.accessToken}`
            }
          });

          const logoutData = await logoutResponse.json();
          if (logoutResponse.ok) {
            console.log('✅ Logout successful');
          } else {
            console.log('❌ Logout failed:', logoutData.message);
          }
        } catch (error) {
          console.log('❌ Logout error:', error.message);
        }
      }

      // Test Google OAuth URL generation
      console.log('\n🌐 Testing Google OAuth...');
      try {
        const oauthResponse = await fetch('http://localhost:4004/api/auth/google');
        const oauthData = await oauthResponse.json();
        
        if (oauthResponse.ok) {
          console.log('✅ Google OAuth URL generated');
          console.log('   URL:', oauthData.data.authUrl.substring(0, 100) + '...');
        } else {
          console.log('❌ Google OAuth failed:', oauthData.message);
        }
      } catch (error) {
        console.log('❌ Google OAuth error:', error.message);
      }

      console.log('\n🎉 Authentication testing completed!');
      server.close();
    });

  } catch (error) {
    console.error('❌ Authentication test error:', error.message);
  }
}

testAuthentication();