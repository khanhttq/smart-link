// domains/auth/config/jwt.js
const config = require('../../../config');

module.exports = {
  secret: config.jwt.secret,
  expiresIn: config.jwt.expiresIn || '24h',
  algorithm: 'HS256',
  issuer: 'shortlink-system',
  audience: 'shortlink-users',
  
  // Token types
  tokenTypes: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset'
  },

  // Token expiration times
  expirationTimes: {
    access: '24h',
    refresh: '7d',
    emailVerification: '24h',
    passwordReset: '1h'
  }
};