// domains/auth/controllers/OAuthController.js
const authService = require('../services/AuthService');
const oauthService = require('../services/OAuthService');

class OAuthController {
  // GET /api/auth/google
  async googleAuth(req, res) {
    try {
      const state = req.query.state || '';
      const authUrl = oauthService.generateGoogleAuthUrl(state);

      res.json({
        success: true,
        data: {
          authUrl: authUrl
        }
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate Google auth URL'
      });
    }
  }

  // GET /api/auth/google/callback
  async googleCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code required'
        });
      }

      // Complete OAuth flow
      const { googleUser } = await oauthService.completeGoogleAuth(code);

      // Login or register user
      const result = await authService.googleLogin(googleUser);

      // Redirect to frontend with tokens (in production, use secure method)
      const redirectUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/success?token=${result.tokens.accessToken}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google callback error:', error);
      
      const errorUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/error?message=${encodeURIComponent(error.message)}`;
      res.redirect(errorUrl);
    }
  }

  // For testing purposes - return JSON instead of redirect
  async googleCallbackJson(req, res) {
    try {
      const { code } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code required'
        });
      }

      const { googleUser } = await oauthService.completeGoogleAuth(code);
      const result = await authService.googleLogin(googleUser);

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      console.error('Google callback error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new OAuthController();