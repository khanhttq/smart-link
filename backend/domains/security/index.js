// backend/domains/security/index.js - UPDATED for Step 3
const rateLimiter = require('./middleware/rateLimiter');
const securityHeaders = require('./middleware/securityHeaders');
const corsConfig = require('./middleware/corsConfig');
const inputValidation = require('./middleware/inputValidation');
const sqlInjectionProtection = require('./middleware/sqlInjectionProtection');

module.exports = {
  middleware: {
    rateLimiter,
    securityHeaders,
    corsConfig,
    inputValidation,
    sqlInjectionProtection
  },
  services: null,      // Sẽ setup sau
  config: null         // Sẽ setup sau
};