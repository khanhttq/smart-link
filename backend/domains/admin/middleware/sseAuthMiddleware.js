// backend/domains/admin/middleware/sseAuthMiddleware.js
const jwt = require('jsonwebtoken');
const { User } = require('../../../models');
/**
 * SSE-specific authentication middleware
 * Handles both Authorization header and query token parameter
 */
const sseAuthMiddleware = async (req, res, next) => {
  try {
    // ✅ Get token from multiple sources for SSE compatibility
    let token = null;

    // 1. Check Authorization header (standard)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. Check query parameter (for EventSource compatibility)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      console.log('❌ SSE Auth: No token provided');
      return res.status(401).json({
        success: false,
        message: 'Authentication token required',
        code: 'TOKEN_MISSING',
      });
    }

    // ✅ Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (jwtError) {
      console.log('❌ SSE Auth: Invalid token:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
        code: 'TOKEN_INVALID',
      });
    }

    // ✅ Get user from database
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      console.log('❌ SSE Auth: User not found:', decoded.userId);
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      console.log('❌ SSE Auth: User not active:', user.email);
      return res.status(401).json({
        success: false,
        message: 'User account is not active',
        code: 'USER_INACTIVE',
      });
    }

    // ✅ Set user context (same as normal authMiddleware)
    req.user = {
      id: user.id,
      userId: user.id, // For compatibility
      email: user.email,
      role: user.role,
      name: user.name,
    };

    req.token = token;

    console.log('✅ SSE Auth: User authenticated:', user.email);
    next();
  } catch (error) {
    console.error('❌ SSE Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * SSE-specific admin role check
 */
const sseAdminMiddleware = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (req.user.role !== 'admin') {
      console.log('❌ SSE Admin: Access denied for user:', req.user.email, 'Role:', req.user.role);
      return res.status(403).json({
        success: false,
        message: 'Admin role required',
        code: 'ADMIN_REQUIRED',
      });
    }

    console.log('✅ SSE Admin: Access granted for:', req.user.email);
    next();
  } catch (error) {
    console.error('❌ SSE Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization failed',
      code: 'AUTHZ_ERROR',
    });
  }
};

module.exports = {
  sseAuthMiddleware,
  sseAdminMiddleware,
};
