// backend/domains/analytics/routes/analyticsRoutes.js - ElasticSearch Integration
const express = require('express');
const analyticsController = require('../controllers/AnalyticsController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// Import rate limiting từ security domain
const securityDomain = require('../../security');
const { generalLimiter } = securityDomain.middleware.rateLimiter;

const router = express.Router();

// Apply auth middleware to all analytics routes
router.use(authMiddleware.verifyToken);

// Apply general rate limiting
router.use(generalLimiter);

// ===== ANALYTICS ROUTES =====

/**
 * GET /api/analytics/dashboard
 * Get dashboard overview analytics
 */
router.get('/dashboard', analyticsController.getDashboard);

/**
 * GET /api/analytics/links/:linkId
 * Get detailed analytics for specific link
 */
router.get('/links/:linkId', analyticsController.getLinkAnalytics);

/**
 * GET /api/analytics/comparison
 * Compare analytics for multiple links
 * Query params: linkIds[], period
 */
router.get('/comparison', analyticsController.compareLinks);

/**
 * GET /api/analytics/export/:linkId
 * Export analytics data (JSON/CSV)
 * Query params: period, format
 */
router.get('/export/:linkId', analyticsController.exportAnalytics);

/**
 * GET /api/analytics/real-time/:linkId
 * Get real-time analytics for link
 * Query params: minutes
 */
router.get('/real-time/:linkId', analyticsController.getRealTimeAnalytics);

/**
 * GET /api/analytics/trends
 * Get analytics trends and insights
 * Query params: period
 */
router.get('/trends', analyticsController.getTrends);

module.exports = router;