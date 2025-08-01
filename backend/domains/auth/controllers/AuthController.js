// domains/auth/controllers/AuthController.js
const authService = require('../services/AuthService');
const oauthService = require('../services/OAuthService');

class AuthController {
  // POST /api/auth/register
  async register(req, res) {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and name are required'
        });
      }

      const result = await authService.register({ email, password, name });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      const token = req.token;
      const sessionId = req.headers['x-session-id'];

      await authService.logout(token, sessionId);

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  // POST /api/auth/refresh
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      const tokens = await authService.refreshTokens(refreshToken);

      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens }
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /api/auth/me
  async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  }

  // POST /api/auth/logout-all
  async logoutAll(req, res) {
    try {
      await authService.logoutAll(req.user.id);

      res.json({
        success: true,
        message: 'Logged out from all devices'
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices'
      });
    }
  }
}

module.exports = new AuthController();