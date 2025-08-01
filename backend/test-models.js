// test-models.js
const db = require('./models');

async function testModels() {
  console.log('🧪 Testing database models...\n');

  try {
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Test models loading
    console.log('\n📊 Available models:');
    Object.keys(db).forEach(modelName => {
      if (modelName !== 'sequelize' && modelName !== 'Sequelize') {
        console.log(`  - ${modelName}`);
      }
    });

    // Test associations
    console.log('\n🔗 Testing associations...');
    console.log('User associations:', Object.keys(db.User.associations));
    console.log('Link associations:', Object.keys(db.Link.associations));
    console.log('Click associations:', Object.keys(db.Click.associations));

    console.log('\n✅ All models loaded successfully!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

testModels();