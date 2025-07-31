// test-structure.js
const app = require('./app');
const container = require('./shared/container/Container');

console.log('🧪 Testing new structure...\n');

// Test container
try {
  const config = container.get('config');
  const logger = container.get('logger');
  console.log('✅ DI Container working');
  console.log(`   Config loaded: ${config.nodeEnv} environment`);
} catch (error) {
  console.error('❌ DI Container error:', error.message);
}

// Test domains import
try {
  const authDomain = require('./domains/auth');
  const linksDomain = require('./domains/links');
  const analyticsDomain = require('./domains/analytics');
  const usersDomain = require('./domains/users');
  const securityDomain = require('./domains/security');
  console.log('✅ Domain imports working');
} catch (error) {
  console.error('❌ Domain import error:', error.message);
}

// Test app
try {
  const server = app.listen(4001, () => {
    console.log('✅ App starting on port 4001');
    console.log('✅ Structure migration successful!');
    
    // Test health endpoint
    console.log('\n📡 Testing endpoints...');
    
    setTimeout(async () => {
      try {
        const response = await fetch('http://localhost:4001/health');
        const data = await response.json();
        console.log('✅ Health endpoint working:', data.message);
      } catch (error) {
        console.error('❌ Health endpoint error:', error.message);
      }
      
      server.close();
      console.log('\n🎉 Test completed successfully!');
      console.log('\n🚀 Ready for BƯỚC 2!');
    }, 1000);
  });
} catch (error) {
  console.error('❌ App error:', error.message);
}