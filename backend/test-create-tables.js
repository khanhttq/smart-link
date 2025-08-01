// test-create-tables-fixed.js
const db = require('./models');

async function createTables() {
  console.log('🗄️ Creating database tables...\n');

  try {
    // Drop và tạo lại tables
    await db.sequelize.sync({ force: true });
    console.log('✅ All tables created successfully!');

    // Test tạo sample data
    console.log('\n🧪 Testing table creation...');
    
    // 1. Tạo user test
    const user = await db.User.create({
      email: 'test@example.com',
      name: 'Test User',
      password: 'password123'
    });
    console.log('✅ User created:', user.id);

    // 2. Tạo link test
    const link = await db.Link.create({
      userId: user.id,
      originalUrl: 'https://google.com',
      shortCode: 'test123',
      title: 'Test Link',
      campaign: 'test-campaign'
    });
    console.log('✅ Link created:', link.shortCode);

    // 3. Tạo click test
    const click = await db.Click.create({
      linkId: link.id,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows'
    });
    console.log('✅ Click created:', click.id);

    // 4. Tạo API key test (sẽ auto-generate key)
    const apiKey = await db.ApiKey.create({
      userId: user.id,
      name: 'Test API Key',
      tier: 'free'
    });
    console.log('✅ API Key created:', apiKey.id);
    console.log('🔑 Generated key hash:', apiKey.hashedKey.substring(0, 16) + '...');

    // 5. Test relationships
    console.log('\n🔗 Testing relationships...');
    
    const userWithLinks = await db.User.findByPk(user.id, {
      include: ['links', 'apiKeys']
    });
    console.log(`✅ User has ${userWithLinks.links.length} links`);
    console.log(`✅ User has ${userWithLinks.apiKeys.length} API keys`);

    const linkWithClicks = await db.Link.findByPk(link.id, {
      include: ['clicks', 'user']
    });
    console.log(`✅ Link has ${linkWithClicks.clicks.length} clicks`);
    console.log(`✅ Link belongs to user: ${linkWithClicks.user.email}`);

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📊 Tables created with data:');
    console.log('  ✅ users (1 record)');
    console.log('  ✅ links (1 record)'); 
    console.log('  ✅ clicks (1 record)');
    console.log('  ✅ api_keys (1 record)');
    console.log('\n🔗 All relationships working correctly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

createTables();