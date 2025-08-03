// backend/domains/auth/controllers/AuthController.js - COMPLETE FIXED VERSION
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

      // Trim and validate inputs
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      if (!trimmedEmail || !trimmedName) {
        return res.status(400).json({
          success: false,
          message: 'Email and name cannot be empty'
        });
      }

      const result = await authService.register({ 
        email: trimmedEmail, 
        password, 
        name: trimmedName 
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      console.error('❌ Register error:', error);
      
      // Handle specific error types
      let statusCode = 400;
      let message = error.message;

      if (error.message.includes('already exists')) {
        statusCode = 409; // Conflict
        message = 'Email already exists. Please use a different email or login instead.';
      } else if (error.message.includes('password')) {
        statusCode = 400;
        message = 'Password must be at least 8 characters with uppercase, lowercase, and number';
      } else if (error.message.includes('email')) {
        statusCode = 400;
        message = 'Please provide a valid email address';
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/auth/login - ✅ FIXED VERSION
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const result = await authService.login(email.trim().toLowerCase(), password, req);

      // Set session cookie
      if (result.sessionId) {
        res.cookie('sessionId', result.sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens
        }
      });
    } catch (error) {
      console.error('❌ Login Controller Error:', error.message);
      
      let statusCode = 401;
      let message = 'Invalid email or password'; // Default

      // ✅ FIXED: Handle specific error types from AuthService
      switch (error.message) {
        case 'USER_NOT_FOUND':
          statusCode = 404;
          message = 'USER_NOT_FOUND'; // Frontend will handle smart registration
          break;
          
        case 'INVALID_PASSWORD':
          statusCode = 401;
          message = 'Invalid email or password';
          break;
          
        case 'ACCOUNT_DEACTIVATED':
          statusCode = 403;
          message = 'Your account has been deactivated. Please contact support.';
          break;
          
        case 'OAUTH_USER_NO_PASSWORD':
          statusCode = 400;
          message = 'This account was created with Google. Please sign in with Google.';
          break;
          
        case 'Too many login attempts. Please try again later.':
          statusCode = 429;
          message = 'Too many login attempts. Please try again later.';
          break;
          
        case 'Valid email is required':
        case 'Password is required':
          statusCode = 400;
          message = error.message;
          break;
          
        default:
          // For unknown errors, keep generic message for security
          console.log('🔍 Unmapped error:', error.message);
          statusCode = 401;
          message = 'Invalid email or password';
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      const token = req.token;
      const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

      await authService.logout(token, sessionId);

      // Clear session cookie
      res.clearCookie('sessionId');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      console.error('❌ Refresh error:', error);
      
      let statusCode = 401;
      let message = 'Invalid or expired refresh token';

      if (error.message.includes('required')) {
        statusCode = 400;
        message = 'Refresh token is required';
      }

      res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // GET /api/auth/me
  async getProfile(req, res) {
    try {
      // User is already attached by auth middleware
      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: req.user
        }
      });
    } catch (error) {
      console.error('❌ Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/auth/logout-all
  async logoutAll(req, res) {
    try {
      await authService.logoutAll(req.user.id);

      // Clear session cookie
      res.clearCookie('sessionId');

      res.json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error) {
      console.error('❌ Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/auth/change-password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      // Verify current password
      const user = await userRepository.findById(userId);
      const isValidPassword = await user.comparePassword(currentPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Validate new password
      if (!authService.validatePassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters with uppercase, lowercase, and number'
        });
      }

      // Update password
      await userRepository.updatePassword(userId, newPassword);

      // Logout from all devices to force re-login with new password
      await authService.logoutAll(userId);

      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      console.error('❌ Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to change password',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // POST /api/auth/check-email
  async checkEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await authService.findUserByEmail(normalizedEmail);

      res.json({
        success: true,
        data: {
          exists: !!user,
          hasPassword: user ? !!user.password : false,
          isOAuthUser: user ? !user.password : false
        }
      });
    } catch (error) {
      console.error('❌ Check email error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new AuthController();