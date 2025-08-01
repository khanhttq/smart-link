// domains/auth/index.js
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/AuthController');
const oauthController = require('./controllers/OAuthController');
const authService = require('./services/AuthService');
const oauthService = require('./services/OAuthService');
const authMiddleware = require('./middleware/authMiddleware');

module.exports = {
  routes: authRoutes,
  controllers: {
    auth: authController,
    oauth: oauthController
  },
  services: {
    auth: authService,
    oauth: oauthService
  },
  middleware: authMiddleware
};