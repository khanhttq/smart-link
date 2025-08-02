// jwtConfig.js
module.exports = {
  secret: process.env.JWT_SECRET || 'your-secret-key', // Đặt JWT_SECRET trong file .env
  issuer: process.env.JWT_ISSUER || 'my-app',
  audience: process.env.JWT_AUDIENCE || 'my-app-users',
  tokenTypes: {
    ACCESS: 'access',
    REFRESH: 'refresh',
  },
  expirationTimes: {
    access: '15m',
    refresh: '7d',
    session: 7 * 24 * 60 * 60,
  },
};