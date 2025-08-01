// domains/analytics/routes/analyticsRoutes.js
const express = require('express');
const analyticsController = require('../controllers/AnalyticsController');
const authMiddleware = require('../../auth/middleware/authMiddleware'); // Now imports instance
const router = express.Router();

// All analytics routes require authentication - FIXED: Use instance method
router.use(authMiddleware.verifyToken);

// Dashboard and overview
router.get('/dashboard', analyticsController.getDashboard);
router.get('/realtime', analyticsController.getRealtime);
router.get('/top-links', analyticsController.getTopLinks);

// Detailed analytics
router.get('/clicks', analyticsController.getClicks);
router.get('/link/:linkId', analyticsController.getLinkAnalytics);

// Export
router.get('/export', analyticsController.exportData);

module.exports = router;