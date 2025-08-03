// backend/domains/auth/controllers/AuthController.js - FIXED VERSION
const authService = require('../services/AuthService');
const cacheService = require('../../../core/cache/CacheService');

// ✅ FIX: Unified error codes for backend
const ERROR_CODES = {
  // Authentication
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  OAUTH_USER_NO_PASSWORD: 'OAUTH_USER_NO_PASSWORD',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

// ✅ FIX: Standardized error response format
const sendErrorResponse = (res, statusCode, errorCode, message, details = null) => {
  const response = {
    success: false,
    code: errorCode,
    message,
    timestamp: new Date().toISOString()
  };
  
  // Add details in development mode
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }
  
  console.error(`❌ Auth Error [${statusCode}]:`, { code: errorCode, message, details });
  return res.status(statusCode).json(response);
};

// ✅ FIX: Standardized success response format
const sendSuccessResponse = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data) {
    response.data = data;
  }
  
  console.log(`✅ Auth Success [${statusCode}]:`, message);
  return res.status(statusCode).json(response);
};

// ✅ FIX: Standalone validation function (outside class)
const validateRegistrationInput = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!data.email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }
  
  if (!data.password) {
    errors.push('Password is required');
  } else {
    if (data.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(data.password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(data.password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(data.password)) {
      errors.push('Password must contain at least one number');
    }
  }
  
  return errors;
};

// ✅ FIX: Standalone password validation function
const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return errors;
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return errors;
};

class AuthController {
  
  // POST /api/auth/register - ✅ FIXED VERSION
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      console.log('📝 Registration attempt:', { name, email, hasPassword: !!password });

      // ✅ FIX: Use standalone validation function
      const validationErrors = validateRegistrationInput({ name, email, password });
      if (validationErrors.length > 0) {
        return sendErrorResponse(
          res, 
          400, 
          ERROR_CODES.VALIDATION_ERROR, 
          'Validation failed',
          validationErrors
        );
      }

      // Sanitize inputs
      const sanitizedData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password
      };

      const result = await authService.register(sanitizedData, req);

      return sendSuccessResponse(
        res,
        'Registration successful',
        {
          user: result.user,
          tokens: result.tokens
        },
        201
      );

    } catch (error) {
      console.error('❌ Registration Controller Error:', error);
      
      // ✅ FIX: Proper error mapping
      if (error.message.includes('email') && error.message.includes('exists')) {
        return sendErrorResponse(
          res,
          409,
          ERROR_CODES.EMAIL_EXISTS,
          'Email already exists. Please use a different email or login instead.'
        );
      }
      
      if (error.message.includes('validation')) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Registration failed',
        error.stack
      );
    }
  }

  // POST /api/auth/login - ✅ FIXED VERSION
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Basic validation
      if (!email || !password) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.REQUIRED_FIELD,
          'Email and password are required'
        );
      }

      const result = await authService.login(email, password, req);

      return sendSuccessResponse(
        res,
        'Login successful',
        {
          user: result.user,
          tokens: result.tokens
        }
      );

    } catch (error) {
      console.error('❌ Login Controller Error:', error);
      
      // Enhanced error handling
      switch (error.message) {
        case 'USER_NOT_FOUND':
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.USER_NOT_FOUND,
            'No account found with this email address'
          );
          
        case 'INVALID_PASSWORD':
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.INVALID_PASSWORD,
            'Incorrect password'
          );
          
        case 'ACCOUNT_DEACTIVATED':
          return sendErrorResponse(
            res,
            403,
            ERROR_CODES.ACCOUNT_DEACTIVATED,
            'Account has been deactivated. Please contact support.'
          );
          
        case 'OAUTH_USER_NO_PASSWORD':
          return sendErrorResponse(
            res,
            400,
            ERROR_CODES.OAUTH_USER_NO_PASSWORD,
            'This account was created with Google. Please sign in with Google.'
          );
          
        case 'Too many login attempts. Please try again later.':
          return sendErrorResponse(
            res,
            429,
            ERROR_CODES.TOO_MANY_ATTEMPTS,
            'Too many login attempts. Please try again later.'
          );
          
        default:
          return sendErrorResponse(
            res,
            500,
            ERROR_CODES.INTERNAL_ERROR,
            'Login failed',
            error.stack
          );
      }
    }
  }

  // POST /api/auth/logout - ✅ FIXED VERSION
  async logout(req, res) {
    try {
      const token = req.token;
      const userId = req.user.id;

      if (token) {
        // Add token to blacklist
        await cacheService.set(`blacklist:${token}`, 'true', 24 * 60 * 60); // 24 hours
        console.log('🚫 Token blacklisted:', token.substring(0, 20) + '...');
      }

      // Clear session cookie
      res.clearCookie('sessionId');

      return sendSuccessResponse(res, 'Logout successful');

    } catch (error) {
      console.error('❌ Logout error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Logout failed',
        error.stack
      );
    }
  }

  // POST /api/auth/logout-all - ✅ FIXED VERSION
  async logoutAll(req, res) {
    try {
      const userId = req.user.id;
      
      // Increment user's token version to invalidate all tokens
      await authService.invalidateAllUserTokens(userId);
      
      // Clear session cookie
      res.clearCookie('sessionId');

      return sendSuccessResponse(res, 'Logged out from all devices');

    } catch (error) {
      console.error('❌ Logout all error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Logout all failed',
        error.stack
      );
    }
  }

  // GET /api/auth/info - ✅ FIXED VERSION (changed from /me)
  async getProfile(req, res) {
    try {
      const user = req.user;
      
      return sendSuccessResponse(
        res,
        'Profile retrieved successfully',
        { user }
      );

    } catch (error) {
      console.error('❌ Get profile error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to get profile',
        error.stack
      );
    }
  }

  // POST /api/auth/refresh - ✅ FIXED VERSION
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.REQUIRED_FIELD,
          'Refresh token is required'
        );
      }

      const result = await authService.refreshToken(refreshToken);

      return sendSuccessResponse(
        res,
        'Token refreshed successfully',
        {
          tokens: result.tokens,
          user: result.user
        }
      );

    } catch (error) {
      console.error('❌ Refresh token error:', error);
      
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.TOKEN_EXPIRED,
          'Refresh token expired. Please login again.'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Token refresh failed',
        error.stack
      );
    }
  }

  // POST /api/auth/change-password - ✅ FIXED VERSION
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Validate inputs
      if (!currentPassword || !newPassword) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.REQUIRED_FIELD,
          'Current password and new password are required'
        );
      }

      // ✅ FIX: Use standalone validation function
      const passwordErrors = validatePassword(newPassword);
      if (passwordErrors.length > 0) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.WEAK_PASSWORD,
          'Password does not meet requirements',
          passwordErrors
        );
      }

      await authService.changePassword(userId, currentPassword, newPassword);

      return sendSuccessResponse(res, 'Password changed successfully');

    } catch (error) {
      console.error('❌ Change password error:', error);
      
      if (error.message.includes('current password')) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.INVALID_PASSWORD,
          'Current password is incorrect'
        );
      }
      
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Password change failed',
        error.stack
      );
    }
  }

  // POST /api/auth/check-email - ✅ FIXED VERSION
  async checkEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return sendErrorResponse(
          res,
          400,
          ERROR_CODES.REQUIRED_FIELD,
          'Email is required'
        );
      }

      const user = await authService.findUserByEmail(email.trim().toLowerCase());

      return sendSuccessResponse(
        res,
        'Email check completed',
        {
          exists: !!user,
          hasPassword: user ? !!user.password : false,
          isOAuthUser: user ? !user.password : false
        }
      );

    } catch (error) {
      console.error('❌ Check email error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'Email check failed',
        error.stack
      );
    }
  }
}

// ✅ FIX: Export instance, not class
module.exports = new AuthController();