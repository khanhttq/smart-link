// test-routes.js
const app = require('./app');

console.log('🧪 Testing API routes...\n');

const testRoutes = [
  { method: 'GET', url: '/health' },
  { method: 'GET', url: '/' },
  { method: 'POST', url: '/api/auth/login' },
  { method: 'POST', url: '/api/auth/register' },
  { method: 'GET', url: '/api/auth/me' },
  { method: 'POST', url: '/api/links' },
  { method: 'GET', url: '/api/links' },
  { method: 'GET', url: '/api/analytics/dashboard' },
  { method: 'GET', url: '/api/users/profile' },
  { method: 'GET', url: '/test123' }, // Test redirect route
];

async function testAllRoutes() {
  const server = app.listen(4002, async () => {
    console.log('🌐 Test server started on port 4002\n');

    for (const route of testRoutes) {
      try {
        const response = await fetch(`http://localhost:4002${route.url}`, {
          method: route.method,
          headers: { 'Content-Type': 'application/json' },
          ...(route.method === 'POST' && { 
            body: JSON.stringify({ test: 'data' }) 
          })
        });
        
        const data = await response.json();
        console.log(`✅ ${route.method} ${route.url}:`, data.message || data.error);
      } catch (error) {
        console.log(`❌ ${route.method} ${route.url}:`, error.message);
      }
    }

    console.log('\n🎉 Route testing completed!');
    server.close();
  });
}

testAllRoutes().catch(console.error);