// shared/utils/generators.js
const crypto = require('crypto');

// Generate random short code
function generateShortCode(length = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Generate API key
function generateApiKey() {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

// Generate session ID
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateShortCode,
  generateApiKey,
  generateSessionId
};