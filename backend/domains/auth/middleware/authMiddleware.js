// backend/domains/auth/middleware/authMiddleware.js - FIXED VERSION
const authService = require('../services/AuthService');

class AuthMiddleware {
  // Verify JWT token middleware
  async verifyToken(req, res, next) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header is required'
        });
      }

      // Check if it's Bearer token
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authorization format. Use Bearer token.'
        });
      }

      // Extract token
      const token = authHeader.substring(7);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token is required'
        });
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
      
      let statusCode = 401;
      let message = 'Invalid or expired token';

      if (error.message.includes('revoked')) {
        message = 'Token has been revoked';
      } else if (error.message.includes('invalidated')) {
        message = 'Token has been invalidated';
      } else if (error.message.includes('deactivated')) {
        statusCode = 403;
        message = 'Account has been deactivated';
      } else if (error.message.includes('not found')) {
        message = 'User not found';
      }

      return res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // Optional authentication (for routes that work with or without auth)
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        if (token) {
          try {
            const user = await authService.verifyToken(token);
            req.user = user;
            req.token = token;
            console.log(`✅ Optional auth successful for user: ${user.email}`);
          } catch (error) {
            console.log('ℹ️ Optional auth failed, continuing without auth:', error.message);
            // Continue without authentication
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('❌ Optional auth middleware error:', error);
      // Continue without authentication even if there's an error
      next();
    }
  }

  // Check if user has specific role
  requireRole(role) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (req.user.role !== role) {
          return res.status(403).json({
            success: false,
            message: `${role} role required`
          });
        }

        next();
      } catch (error) {
        console.error('❌ Role check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Role verification failed'
        });
      }
    };
  }

  // Check if user has any of the specified roles
  requireAnyRole(roles) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (!roles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: `One of these roles required: ${roles.join(', ')}`
          });
        }

        next();
      } catch (error) {
        console.error('❌ Role check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Role verification failed'
        });
      }
    };
  }

  // Admin only middleware
  requireAdmin(req, res, next) {
    return this.requireRole('admin')(req, res, next);
  }

  // Check if user owns the resource or is admin
  checkOwnershipOrAdmin(getResourceOwnerId) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Admin can access everything
        if (req.user.role === 'admin') {
          return next();
        }

        // Get resource owner ID
        const resourceOwnerId = await getResourceOwnerId(req);
        
        if (req.user.id !== resourceOwnerId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. You can only access your own resources.'
          });
        }

        next();
      } catch (error) {
        console.error('❌ Ownership check error:', error);
        return res.status(500).json({
          success: false,
          message: 'Ownership verification failed'
        });
      }
    };
  }

  // Rate limiting middleware (basic implementation)
  rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 requests per 15 minutes
    const requests = new Map();

    return (req, res, next) => {
      const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      if (requests.has(key)) {
        const userRequests = requests.get(key).filter(time => time > windowStart);
        requests.set(key, userRequests);
      }

      // Get current request count
      const currentRequests = requests.get(key) || [];
      
      if (currentRequests.length >= maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Add current request
      currentRequests.push(now);
      requests.set(key, currentRequests);

      next();
    };
  }
}

module.exports = new AuthMiddleware();