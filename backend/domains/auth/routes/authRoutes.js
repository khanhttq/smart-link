// domains/auth/routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/AuthController');
const oauthController = require('../controllers/OAuthController');
const authMiddleware = require('../middleware/authMiddleware'); // Now imports instance
const router = express.Router();

// Authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);

// Protected routes - FIXED: Use instance methods
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.get('/me', authMiddleware.verifyToken, authController.getProfile);
router.post('/logout-all', authMiddleware.verifyToken, authController.logoutAll);

// OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);
router.get('/google/callback/json', oauthController.googleCallbackJson); // For testing

module.exports = router;