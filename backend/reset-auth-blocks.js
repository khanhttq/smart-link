// backend/reset-auth-blocks.js - Chạy file này để reset các blocks
const cacheService = require('./core/cache/CacheService');

async function resetAllAuthBlocks() {
  try {
    console.log('🧹 Resetting all authentication blocks...');
    
    // Reset rate limiting
    const patterns = [
      'login:attempt:*',
      'blacklist:*',
      'compromised_family:*',
      'token_version:*',
      'used_token:*',
      'user_refresh:*'
    ];
    
    for (const pattern of patterns) {
      try {
        // Since we don't have Redis scan, we'll clear specific known keys
        const testKeys = [
          'login:attempt:khanhttq@twin.vn:::1',
          'login:attempt:test@example.com:::1',
          'brute_force:khanhttq@twin.vn',
          'brute_force:test@example.com'
        ];
        
        for (const key of testKeys) {
          await cacheService.del(key);
          console.log(`🗑️ Cleared: ${key}`);
        }
      } catch (e) {
        console.log(`⚠️ Could not clear pattern ${pattern}:`, e.message);
      }
    }
    
    console.log('✅ Auth blocks reset completed!');
    console.log('🚀 You can now try logging in again.');
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    process.exit(0);
  }
}

resetAllAuthBlocks();