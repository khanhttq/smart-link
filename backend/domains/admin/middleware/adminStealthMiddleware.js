// backend/domains/admin/middleware/adminStealthMiddleware.js
const authService = require('../../auth/services/AuthService');

/**
 * ✅ FIXED: Export functions directly instead of class instance
 */

/**
 * Verify admin role but return 404 instead of 403 for security
 */
const requireAdminStealth = async (req, res, next) => {
  try {
    // Must be authenticated first
    if (!req.user) {
      return res.status(404).json({
        success: false,
        message: 'Not Found',
        error: 'The requested resource does not exist'
      });
    }

    // Check admin role - return 404 if not admin (stealth mode)
    if (req.user.role !== 'admin') {
      console.log(`🥷 Stealth mode: User ${req.user.email} (role: ${req.user.role}) tried to access admin area - returning 404`);
      
      return res.status(404).json({
        success: false,
        message: 'Not Found',
        error: 'The requested resource does not exist'
      });
    }

    console.log(`✅ Admin access granted: ${req.user.email}`);
    next();
    
  } catch (error) {
    console.error('❌ Admin stealth middleware error:', error);
    
    // Even on error, return 404 to maintain stealth
    return res.status(404).json({
      success: false,
      message: 'Not Found',
      error: 'The requested resource does not exist'
    });
  }
};

/**
 * Combined auth + admin check in stealth mode
 */
const verifyAdminStealth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // No auth header = 404 (not 401)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(404).json({
        success: false,
        message: 'Not Found',
        error: 'The requested resource does not exist'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      // Verify token
      const decoded = await authService.verifyToken(token);
      const user = await authService.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Not Found',
          error: 'The requested resource does not exist'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(404).json({
          success: false,
          message: 'Not Found',
          error: 'The requested resource does not exist'
        });
      }

      // Set user context
      req.user = user;
      req.token = token;

      // Check admin role - return 404 if not admin
      if (user.role !== 'admin') {
        console.log(`🥷 Stealth mode: User ${user.email} (role: ${user.role}) tried to access admin area - returning 404`);
        
        return res.status(404).json({
          success: false,
          message: 'Not Found',
          error: 'The requested resource does not exist'
        });
      }

      console.log(`✅ Admin stealth access granted: ${user.email}`);
      next();
      
    } catch (tokenError) {
      console.log(`🥷 Stealth mode: Invalid token - returning 404`);
      
      return res.status(404).json({
        success: false,
        message: 'Not Found',
        error: 'The requested resource does not exist'
      });
    }
    
  } catch (error) {
    console.error('❌ Admin stealth verification error:', error);
    
    // Always return 404 to maintain stealth
    return res.status(404).json({
      success: false,
      message: 'Not Found',
      error: 'The requested resource does not exist'
    });
  }
};

// ✅ FIXED: Export functions directly
module.exports = {
  requireAdminStealth,
  verifyAdminStealth
};