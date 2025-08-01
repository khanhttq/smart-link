// domains/auth/middleware/authMiddleware.js
const authService = require('../services/AuthService');

class AuthMiddleware {
  // Verify JWT token
  async verifyToken(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const { user, decoded } = await authService.verifyToken(token);
      
      // Attach user and token info to request
      req.user = user;
      req.token = token;
      req.tokenData = decoded;
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: error.message || 'Invalid token'
      });
    }
  }

  // Optional authentication (don't fail if no token)
  async optionalAuth(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        const { user, decoded } = await authService.verifyToken(token);
        req.user = user;
        req.token = token;
        req.tokenData = decoded;
      }
      
      next();
    } catch (error) {
      // Continue without auth
      next();
    }
  }

  // Role-based authorization
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.role];
      const hasRole = roles.some(role => userRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: roles,
          current: userRoles
        });
      }

      next();
    };
  }

  // Admin only
  get requireAdmin() {
    return this.requireRole(['admin']);
  }

  // User or higher
  get requireUser() {
    return this.requireRole(['user', 'editor', 'admin']);
  }
}

// FIXED: Export instance instead of class
module.exports = new AuthMiddleware();