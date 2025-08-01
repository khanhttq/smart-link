// create-test-user-now.js - Chạy file này để tạo user test
const { User, ApiKey, Link, Click } = require('./models');
const bcrypt = require('bcryptjs');

async function createTestUserNow() {
  try {
    console.log('🧹 Cleaning old test users...');
    
    // Tìm user cũ và xóa tất cả dữ liệu liên quan
    const existingUser = await User.findOne({ 
      where: { email: 'test@example.com' } 
    });
    
    if (existingUser) {
      console.log('🗑️ Deleting user data cascade...');
      
      // Xóa clicks của các links thuộc user này
      const userLinks = await Link.findAll({ 
        where: { userId: existingUser.id } 
      });
      
      for (const link of userLinks) {
        await Click.destroy({ where: { linkId: link.id } });
      }
      
      // Xóa links của user
      await Link.destroy({ 
        where: { userId: existingUser.id } 
      });
      
      // Xóa api_keys của user
      await ApiKey.destroy({ 
        where: { userId: existingUser.id } 
      });
      
      // Cuối cùng xóa user
      await existingUser.destroy();
      console.log('✅ Old user and all related data deleted');
    }
    
    console.log('👤 Creating fresh test user...');
    
    // Tạo user mới với password được hash thủ công để đảm bảo
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    const user = await User.create({
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      role: 'user',
      isActive: true,
      isEmailVerified: true
    });
    
    console.log('✅ Test user created:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Password hash: ${user.password.substring(0, 20)}...`);
    
    // Test password comparison immediately
    console.log('\n🔐 Testing password comparison...');
    const isValid = await user.comparePassword('password123');
    console.log(`Password test result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!isValid) {
      console.log('🚨 Password comparison failed!');
      
      // Test direct bcrypt compare
      const directTest = await bcrypt.compare('password123', user.password);
      console.log(`Direct bcrypt test: ${directTest ? '✅ PASS' : '❌ FAIL'}`);
      
      // Check password field
      console.log(`Password field exists: ${!!user.password}`);
      console.log(`Password field length: ${user.password ? user.password.length : 'null'}`);
    } else {
      console.log('✅ Password comparison working correctly!');
    }
    
    console.log('\n📋 Login credentials to test:');
    console.log('📧 Email: test@example.com');
    console.log('🔒 Password: password123');
    console.log('\n🚀 Now try logging in with these credentials!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createTestUserNow();