// debug-user-check.js
const { User } = require('./models');
const bcrypt = require('bcryptjs');

async function debugUserLogin() {
  try {
    console.log('🔍 Debugging user login issue...\n');
    
    // 1. Kiểm tra tất cả user trong database
    const allUsers = await User.findAll({
      attributes: ['id', 'email', 'name', 'isActive', 'password']
    });
    
    console.log('👥 All users in database:');
    allUsers.forEach(user => {
      console.log(`- Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Has Password: ${user.password ? 'Yes' : 'No'}`);
      console.log(`  Password Hash: ${user.password ? user.password.substring(0, 20) + '...' : 'NULL'}`);
      console.log('');
    });
    
    // 2. Test specific email (thay bằng email bạn đang test)
    const testEmail = 'test@example.com'; // ← Thay bằng email bạn đang dùng
    const testPassword = 'password123'; // ← Thay bằng mật khẩu bạn đang dùng
    
    console.log(`🧪 Testing login for: ${testEmail}`);
    
    const user = await User.findOne({ where: { email: testEmail } });
    
    if (!user) {
      console.log('❌ User not found in database');
      console.log('\n💡 Solutions:');
      console.log('1. Create user first through registration');
      console.log('2. Check if email is correct');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Has Password: ${user.password ? 'Yes' : 'No'}`);
    
    if (!user.isActive) {
      console.log('❌ User account is deactivated');
      return;
    }
    
    if (!user.password) {
      console.log('❌ User has no password (OAuth user?)');
      return;
    }
    
    // 3. Test password comparison
    console.log('\n🔐 Testing password...');
    const isValidPassword = await user.comparePassword(testPassword);
    console.log(`Password match: ${isValidPassword ? '✅ Yes' : '❌ No'}`);
    
    if (!isValidPassword) {
      console.log('\n💡 Password debug:');
      console.log(`Input password: "${testPassword}"`);
      console.log(`Stored hash: ${user.password.substring(0, 30)}...`);
      
      // Test with bcrypt directly
      const directCompare = await bcrypt.compare(testPassword, user.password);
      console.log(`Direct bcrypt compare: ${directCompare ? '✅ Yes' : '❌ No'}`);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Nếu chạy trực tiếp
if (require.main === module) {
  debugUserLogin().then(() => {
    console.log('\n🏁 Debug completed');
    process.exit(0);
  });
}

module.exports = debugUserLogin;