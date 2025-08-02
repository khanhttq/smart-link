const authService = require('../services/AuthService');
const cacheService = require('../../../core/cache/CacheService');

class AuthMiddleware {
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: 'Authorization header is required'
        });
      }

      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid authorization format. Use Bearer token.'
        });
      }

      const token = authHeader.substring(7);
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Token is required'
        });
      }

      // ✅ CRITICAL FIX: Check blacklist FIRST
      try {
        const isBlacklisted = await cacheService.get(`blacklist:${token}`);
        if (isBlacklisted) {
          console.log('🚫 Blacklisted token blocked:', token.substring(0, 20) + '...');
          return res.status(401).json({
            success: false,
            message: 'Token has been revoked'
          });
        }
      } catch (cacheError) {
        console.error('❌ Cache check error:', cacheError);
      }

      const user = await authService.verifyToken(token);
      
      req.user = user;
      req.token = token;
      
      console.log(`✅ Token verified for user: ${user.email}`);
      next();

    } catch (error) {
      console.error('❌ Token verification failed:', error);
      
      let statusCode = 401;
      let message = 'Invalid or expired token';

      if (error.message.includes('revoked') || error.message.includes('blacklisted')) {
        message = 'Token has been revoked';
      } else if (error.message.includes('invalidated') || error.message.includes('version')) {
        message = 'Token has been invalidated. Please login again.';
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

  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        if (token) {
          try {
            const isBlacklisted = await cacheService.get(`blacklist:${token}`);
            if (!isBlacklisted) {
              const user = await authService.verifyToken(token);
              req.user = user;
              req.token = token;
              console.log(`✅ Optional auth successful for user: ${user.email}`);
            }
          } catch (error) {
            console.log('ℹ️ Optional auth failed, continuing without auth:', error.message);
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('❌ Optional auth middleware error:', error);
      next();
    }
  }

  requireRole(role) {
    return async (req, res, next) => {
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

  requireAdmin(req, res, next) {
    return this.requireRole('admin')(req, res, next);
  }

  checkOwnershipOrAdmin(getResourceOwnerId) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        if (req.user.role === 'admin') {
          return next();
        }

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

  rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const requests = new Map();

    return (req, res, next) => {
      try {
        const key = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        if (requests.has(key)) {
          const userRequests = requests.get(key).filter(time => time > windowStart);
          requests.set(key, userRequests);
        }

        const currentRequests = requests.get(key) || [];
        
        if (currentRequests.length >= maxRequests) {
          return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(windowMs / 1000)
          });
        }

        currentRequests.push(now);
        requests.set(key, currentRequests);

        next();
      } catch (error) {
        console.error('❌ Rate limit error:', error);
        next();
      }
    };
  }
}

module.exports = new AuthMiddleware();