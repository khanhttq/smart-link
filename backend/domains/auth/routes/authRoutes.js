// backend/domains/auth/routes/authRoutes.js - SIMPLIFIED VERSION
const express = require('express');
const authController = require('../controllers/AuthController');
const oauthController = require('../controllers/OAuthController');
const authMiddleware = require('../middleware/authMiddleware');

// Import rate limiting từ security domain
const securityDomain = require('../../security');
const {
  authSlowDown,
  loginBruteForce,
  passwordResetBruteForce,
  passwordResetLimiter
} = securityDomain.middleware.rateLimiter;

const router = express.Router();

// ===== PUBLIC ROUTES (NO AUTH REQUIRED) =====

// Register (already has rate limiting from app.js)
router.post('/register', authController.register);

// Login with DISABLED brute force protection (for testing)
router.post('/login', 
  // authSlowDown,                    // DISABLED for testing
  // loginBruteForce.prevent,         // DISABLED for testing
  authController.login
);

// Google OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);
router.get('/google/callback/json', oauthController.googleCallbackJson);

// Check email (for smart registration)
router.post('/check-email', authController.checkEmail);

// Refresh token
router.post('/refresh', authController.refresh);

// ===== PROTECTED ROUTES (REQUIRE AUTH) =====

// Logout with enhanced security
router.post('/logout', 
  authMiddleware.verifyToken, 
  authController.logout
);

// Logout all devices
router.post('/logout-all', 
  authMiddleware.verifyToken,
  authController.logoutAll
);

// Get current user profile
router.get('/me', 
  authMiddleware.verifyToken, 
  authController.getProfile
);

// Change password (requires current password)
router.post('/change-password',
  authMiddleware.verifyToken,
  authController.changePassword
);

// ===== TODO: IMPLEMENT THESE FEATURES LATER =====
/*
// Password reset with enhanced protection
router.post('/forgot-password',
  passwordResetLimiter,            // Strict rate limiting
  passwordResetBruteForce.prevent, // Brute force protection
  authController.forgotPassword
);

router.post('/reset-password/:token', 
  passwordResetLimiter,
  authController.resetPassword
);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', 
  passwordResetLimiter,
  authController.resendVerification
);

// Update profile
router.put('/profile',
  authMiddleware.verifyToken,
  authController.updateProfile
);

// Get active sessions
router.get('/sessions',
  authMiddleware.verifyToken,
  authController.getActiveSessions
);

// Revoke specific session
router.delete('/sessions/:sessionId',
  authMiddleware.verifyToken,
  authController.revokeSession
);

// Get login history/security log
router.get('/security-log',
  authMiddleware.verifyToken,
  authController.getSecurityLog
);

// Enable/disable 2FA (future feature)
router.post('/2fa/enable',
  authMiddleware.verifyToken,
  authController.enable2FA
);

router.post('/2fa/disable',
  authMiddleware.verifyToken,
  authController.disable2FA
);

// Account deactivation
router.post('/deactivate',
  authMiddleware.verifyToken,
  authController.deactivateAccount
);
*/

module.exports = router;