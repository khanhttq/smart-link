// backend/domains/auth/middleware/authMiddleware.js - CLEAN FIXED VERSION
const authService = require('../services/AuthService');
const cacheService = require('../../../core/cache/CacheService');

// ✅ Unified error codes
const ERROR_CODES = {
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  AUTHORIZATION_REQUIRED: 'AUTHORIZATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NETWORK_NOT_FOUND: 'NETWORK_NOT_FOUND'
};

// ✅ Standardized error response format
const sendErrorResponse = (res, statusCode, errorCode, message, details = null) => {
  const response = {
    success: false,
    code: errorCode,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }
  
  console.error(`❌ Auth Middleware Error [${statusCode}]:`, { code: errorCode, message });
  return res.status(statusCode).json(response);
};

class AuthMiddleware {
  
  /**
   * ✅ Enhanced token verification with proper error handling
   */
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      // Check if authorization header exists
      if (!authHeader) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.AUTHORIZATION_REQUIRED,
          'Authorization header is required'
        );
      }

      // Check authorization format
      if (!authHeader.startsWith('Bearer ')) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.TOKEN_MALFORMED,
          'Invalid authorization format. Use Bearer token.'
        );
      }

      const token = authHeader.substring(7);
      
      if (!token) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.TOKEN_MISSING,
          'Token is required'
        );
      }

      // ✅ Check blacklist FIRST before verification
      try {
        const isBlacklisted = await cacheService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          console.log('🚫 Blacklisted token blocked:', token.substring(0, 20) + '...');
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.TOKEN_REVOKED,
            'Token has been revoked'
          );
        }
      } catch (cacheError) {
        console.error('❌ Cache check error:', cacheError);
        // Continue with verification even if cache check fails
      }

      // Verify token and get user
      const user = await authService.verifyToken(token);
      
      // Attach user and token to request
      req.user = user;
      req.token = token;
      
      console.log(`✅ Token verified for user: ${user.email}`);
      next();

    } catch (error) {
      console.error('❌ Token verification failed:', error);
      
      // ✅ Proper error mapping with specific codes
      let statusCode = 401;
      let errorCode = ERROR_CODES.TOKEN_INVALID;
      let message = 'Invalid or expired token';

      if (error.message.includes('jwt expired') || error.message.includes('expired')) {
        errorCode = ERROR_CODES.TOKEN_EXPIRED;
        message = 'Token has expired. Please login again.';
      } else if (error.message.includes('jwt malformed') || error.message.includes('malformed')) {
        errorCode = ERROR_CODES.TOKEN_MALFORMED;
        message = 'Token format is invalid';
      } else if (error.message.includes('revoked') || error.message.includes('blacklisted')) {
        errorCode = ERROR_CODES.TOKEN_REVOKED;
        message = 'Token has been revoked';
      } else if (error.message.includes('invalidated') || error.message.includes('version')) {
        errorCode = ERROR_CODES.TOKEN_INVALID;
        message = 'Token has been invalidated. Please login again.';
      } else if (error.message.includes('deactivated')) {
        statusCode = 403;
        errorCode = ERROR_CODES.ACCOUNT_DEACTIVATED;
        message = 'Account has been deactivated';
      } else if (error.message.includes('not found')) {
        errorCode = ERROR_CODES.USER_NOT_FOUND;
        message = 'User not found';
      } else if (error.message.includes('invalid signature')) {
        errorCode = ERROR_CODES.TOKEN_INVALID;
        message = 'Token signature is invalid';
      }

      return sendErrorResponse(res, statusCode, errorCode, message, error.stack);
    }
  }

  /**
   * ✅ Enhanced optional authentication middleware
   */
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      // If no auth header, continue without authentication
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('ℹ️ No auth header provided, continuing without authentication');
        return next();
      }
      
      const token = authHeader.substring(7);
      
      if (!token) {
        console.log('ℹ️ Empty token, continuing without authentication');
        return next();
      }
      
      try {
        // Check blacklist
        const isBlacklisted = await cacheService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          console.log('🚫 Blacklisted token in optional auth, continuing without auth');
          return next();
        }
        
        // Try to verify token
        const user = await authService.verifyToken(token);
        req.user = user;
        req.token = token;
        console.log(`✅ Optional auth successful for user: ${user.email}`);
        
      } catch (error) {
        console.log('ℹ️ Optional auth failed, continuing without auth:', error.message);
        // Don't set req.user, just continue
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Optional auth middleware error:', error);
      // For optional auth, always continue even on errors
      next();
    }
  }

  /**
   * ✅ Enhanced role-based access control
   */
  requireRole(role) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.AUTHORIZATION_REQUIRED,
            'Authentication required'
          );
        }

        if (req.user.role !== role) {
          console.log(`❌ Access denied: User ${req.user.email} has role '${req.user.role}' but '${role}' required`);
          return sendErrorResponse(
            res,
            403,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            `${role} role required`
          );
        }

        console.log(`✅ Role check passed: User ${req.user.email} has required role '${role}'`);
        next();
        
      } catch (error) {
        console.error('❌ Role check error:', error);
        return sendErrorResponse(
          res,
          500,
          ERROR_CODES.INTERNAL_ERROR,
          'Role verification failed',
          error.stack
        );
      }
    };
  }

  /**
   * ✅ Multiple role support
   */
  requireAnyRole(roles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.AUTHORIZATION_REQUIRED,
            'Authentication required'
          );
        }

        if (!Array.isArray(roles) || roles.length === 0) {
          console.error('❌ Invalid roles array provided to requireAnyRole');
          return sendErrorResponse(
            res,
            500,
            ERROR_CODES.INTERNAL_ERROR,
            'Invalid role configuration'
          );
        }

        if (!roles.includes(req.user.role)) {
          console.log(`❌ Access denied: User ${req.user.email} has role '${req.user.role}' but one of [${roles.join(', ')}] required`);
          return sendErrorResponse(
            res,
            403,
            ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            `One of these roles required: ${roles.join(', ')}`
          );
        }

        console.log(`✅ Role check passed: User ${req.user.email} has role '${req.user.role}' which is in allowed roles`);
        next();
        
      } catch (error) {
        console.error('❌ Multi-role check error:', error);
        return sendErrorResponse(
          res,
          500,
          ERROR_CODES.INTERNAL_ERROR,
          'Role verification failed',
          error.stack
        );
      }
    };
  }

  /**
   * ✅ Admin role shorthand
   */
  requireAdmin(req, res, next) {
    return this.requireRole('admin')(req, res, next);
  }

  /**
   * ✅ Enhanced ownership or admin check
   */
  checkOwnershipOrAdmin(getResourceOwnerId) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return sendErrorResponse(
            res,
            401,
            ERROR_CODES.AUTHORIZATION_REQUIRED,
            'Authentication required'
          );
        }

        // Admin can access everything
        if (req.user.role === 'admin') {
          console.log(`✅ Admin access granted for user: ${req.user.email}`);
          return next();
        }

        // Check ownership
        if (typeof getResourceOwnerId !== 'function') {
          console.error('❌ getResourceOwnerId must be a function');
          return sendErrorResponse(
            res,
            500,
            ERROR_CODES.INTERNAL_ERROR,
            'Invalid ownership check configuration'
          );
        }

        try {
          const resourceOwnerId = await getResourceOwnerId(req);
          
          if (!resourceOwnerId) {
            console.log('❌ Could not determine resource owner');
            return sendErrorResponse(
              res,
              404,
              ERROR_CODES.USER_NOT_FOUND,
              'Resource not found or access denied'
            );
          }

          if (req.user.id !== resourceOwnerId) {
            console.log(`❌ Ownership check failed: User ${req.user.id} tried to access resource owned by ${resourceOwnerId}`);
            return sendErrorResponse(
              res,
              403,
              ERROR_CODES.INSUFFICIENT_PERMISSIONS,
              'Access denied. You can only access your own resources.'
            );
          }

          console.log(`✅ Ownership verified: User ${req.user.id} owns resource`);
          next();
          
        } catch (ownershipError) {
          console.error('❌ Ownership check error:', ownershipError);
          return sendErrorResponse(
            res,
            500,
            ERROR_CODES.INTERNAL_ERROR,
            'Ownership verification failed',
            ownershipError.stack
          );
        }
        
      } catch (error) {
        console.error('❌ Ownership or admin check error:', error);
        return sendErrorResponse(
          res,
          500,
          ERROR_CODES.INTERNAL_ERROR,
          'Access control verification failed',
          error.stack
        );
      }
    };
  }

  /**
   * ✅ Rate limiting aware middleware
   */
  async rateLimitAware(req, res, next) {
    try {
      // Add rate limiting context if user is authenticated
      if (req.user) {
        req.rateLimitKey = `user:${req.user.id}`;
        req.rateLimitName = req.user.email;
      } else {
        req.rateLimitKey = `ip:${req.ip}`;
        req.rateLimitName = req.ip;
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Rate limit aware middleware error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * ✅ Session validation middleware
   */
  async validateSession(req, res, next) {
    try {
      const sessionId = req.cookies?.sessionId;
      
      if (!sessionId) {
        return next(); // No session to validate
      }
      
      // Validate session in cache/database
      const sessionData = await cacheService.get(`session:${sessionId}`);
      
      if (!sessionData) {
        // Clear invalid session cookie
        res.clearCookie('sessionId');
        console.log('🧹 Cleared invalid session cookie');
      } else {
        req.sessionId = sessionId;
        req.sessionData = JSON.parse(sessionData);
        console.log('✅ Session validated');
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Session validation error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * ✅ API key authentication (for external integrations)
   */
  async verifyApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.TOKEN_MISSING,
          'API key is required'
        );
      }
      
      // Validate API key (implement your API key validation logic here)
      const isValidApiKey = await authService.validateApiKey(apiKey);
      
      if (!isValidApiKey) {
        return sendErrorResponse(
          res,
          401,
          ERROR_CODES.TOKEN_INVALID,
          'Invalid API key'
        );
      }
      
      // Set API context
      req.apiKey = apiKey;
      req.isApiRequest = true;
      
      console.log('✅ API key validated');
      next();
      
    } catch (error) {
      console.error('❌ API key validation error:', error);
      return sendErrorResponse(
        res,
        500,
        ERROR_CODES.INTERNAL_ERROR,
        'API key validation failed',
        error.stack
      );
    }
  }

  /**
   * ✅ Flexible authentication (token OR API key)
   */
  async flexibleAuth(req, res, next) {
    // Try token auth first
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return this.verifyToken(req, res, next);
    } else if (apiKey) {
      return this.verifyApiKey(req, res, next);
    } else {
      return sendErrorResponse(
        res,
        401,
        ERROR_CODES.AUTHORIZATION_REQUIRED,
        'Either Bearer token or API key is required'
      );
    }
  }

  /**
   * ✅ Device tracking middleware
   */
  async trackDevice(req, res, next) {
    try {
      if (req.user) {
        const deviceInfo = {
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          timestamp: new Date().toISOString()
        };
        
        req.deviceInfo = deviceInfo;
        
        // Store device info for security monitoring
        await cacheService.set(
          `device:${req.user.id}:${req.ip}`, 
          JSON.stringify(deviceInfo), 
          7 * 24 * 60 * 60 // 7 days
        );
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Device tracking error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * ✅ Security headers middleware
   */
  securityHeaders(req, res, next) {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
  }

  /**
   * ✅ Request logging middleware
   */
  logRequest(req, res, next) {
    const start = Date.now();
    
    // Log request
    console.log(`📨 ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      user: req.user?.email || 'anonymous',
      timestamp: new Date().toISOString()
    });
    
    // Log response time on finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`📤 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  }

  /**
   * ✅ CORS middleware with authentication context
   */
  corsWithAuth(req, res, next) {
    const origin = req.headers.origin;
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    
    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    }
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  }

  /**
   * ✅ IP whitelist middleware
   */
  ipWhitelist(allowedIPs = []) {
    return (req, res, next) => {
      if (allowedIPs.length === 0) {
        return next(); // No restrictions if list is empty
      }
      
      const clientIP = req.ip;
      
      if (!allowedIPs.includes(clientIP)) {
        console.log(`🚫 IP blocked: ${clientIP}`);
        return sendErrorResponse(
          res,
          403,
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          'Access denied from this IP address'
        );
      }
      
      console.log(`✅ IP allowed: ${clientIP}`);
      next();
    };
  }

  /**
   * ✅ Maintenance mode middleware
   */
  maintenanceMode(req, res, next) {
    const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    const isAdminUser = req.user?.role === 'admin';
    const isHealthCheck = req.path === '/health' || req.path === '/api/health';
    
    if (isMaintenanceMode && !isAdminUser && !isHealthCheck) {
      return sendErrorResponse(
        res,
        503,
        ERROR_CODES.SYSTEM_MAINTENANCE,
        'System is under maintenance. Please try again later.'
      );
    }
    
    next();
  }

  /**
   * ✅ User activity tracking
   */
  async trackActivity(req, res, next) {
    try {
      if (req.user && req.method !== 'GET') {
        const activity = {
          userId: req.user.id,
          action: `${req.method} ${req.originalUrl}`,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString()
        };
        
        // Store in cache for recent activity (async, don't block request)
        cacheService.set(
          `activity:${req.user.id}:${Date.now()}`, 
          JSON.stringify(activity), 
          24 * 60 * 60 // 24 hours
        ).catch(error => {
          console.error('❌ Activity tracking error:', error);
        });
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Activity tracking middleware error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * ✅ Account lock check middleware
   */
  async checkAccountLock(req, res, next) {
    try {
      if (req.user) {
        const lockKey = `account_lock:${req.user.id}`;
        const lockData = await cacheService.get(lockKey);
        
        if (lockData) {
          const lock = JSON.parse(lockData);
          const lockExpiry = new Date(lock.expiresAt);
          
          if (new Date() < lockExpiry) {
            return sendErrorResponse(
              res,
              423, // Locked
              ERROR_CODES.ACCOUNT_DEACTIVATED,
              `Account is temporarily locked until ${lockExpiry.toISOString()}`
            );
          } else {
            // Lock expired, remove it
            await cacheService.del(lockKey);
          }
        }
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Account lock check error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * ✅ Feature flag middleware
   */
  requireFeature(featureName) {
    return (req, res, next) => {
      const enabledFeatures = (process.env.ENABLED_FEATURES || '').split(',');
      
      if (!enabledFeatures.includes(featureName)) {
        return sendErrorResponse(
          res,
          404,
          ERROR_CODES.NETWORK_NOT_FOUND,
          'Feature not available'
        );
      }
      
      next();
    };
  }

  /**
   * ✅ Request size limiter
   */
  limitRequestSize(maxSizeKB = 10240) { // Default 10MB
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const maxSizeBytes = maxSizeKB * 1024;
      
      if (contentLength > maxSizeBytes) {
        return sendErrorResponse(
          res,
          413,
          ERROR_CODES.VALIDATION_ERROR,
          `Request too large. Maximum size is ${maxSizeKB}KB`
        );
      }
      
      next();
    };
  }

  /**
   * ✅ Environment-based middleware
   */
  developmentOnly(req, res, next) {
    if (process.env.NODE_ENV !== 'development') {
      return sendErrorResponse(
        res,
        404,
        ERROR_CODES.NETWORK_NOT_FOUND,
        'Not found'
      );
    }
    next();
  }

  productionOnly(req, res, next) {
    if (process.env.NODE_ENV !== 'production') {
      return sendErrorResponse(
        res,
        404,
        ERROR_CODES.NETWORK_NOT_FOUND,
        'Not found'
      );
    }
    next();
  }
}

// ✅ Export singleton instance with proper method binding
const authMiddleware = new AuthMiddleware();

// Bind all methods to preserve 'this' context
Object.getOwnPropertyNames(AuthMiddleware.prototype)
  .filter(method => method !== 'constructor' && typeof authMiddleware[method] === 'function')
  .forEach(method => {
    authMiddleware[method] = authMiddleware[method].bind(authMiddleware);
  });

module.exports = authMiddleware;