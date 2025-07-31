// config/index.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database config (sẽ thêm sau)
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'shortlink',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password'
  },
  
  // Redis config (sẽ thêm sau)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },

  // JWT config (sẽ thêm sau)
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: '24h'
  }
};