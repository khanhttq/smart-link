// backend/domains/analytics/routes/analyticsRoutes.js - Enhanced with ES6 Middleware
const express = require('express');
const analyticsController = require('../controllers/AnalyticsController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// Import enhanced error handling middleware
const { 
  analyticsErrorHandler, 
  asyncErrorHandler, 
  checkServiceHealth,
  requestLogger 
} = require('../middleware/errorHandler');

// Import rate limiting từ security domain
const securityDomain = require('../../security');
const { generalLimiter } = securityDomain.middleware.rateLimiter;

const router = express.Router();

// ===== ES6 GLOBAL MIDDLEWARE =====
// Apply auth middleware to all analytics routes
router.use(authMiddleware.verifyToken);

// Apply general rate limiting
router.use(generalLimiter);

// Apply request logging
router.use(requestLogger);

// Apply service health check (non-blocking)
router.use(checkServiceHealth);

// ===== ES6 ANALYTICS ROUTES WITH ERROR HANDLING =====

/**
 * GET /api/analytics/dashboard
 * Get dashboard overview analytics with enhanced error handling
 */
router.get('/dashboard', 
  asyncErrorHandler(analyticsController.getDashboard)
);

/**
 * GET /api/analytics/links/:linkId
 * Get detailed analytics for specific link with fallback support
 */
router.get('/links/:linkId', 
  asyncErrorHandler(analyticsController.getLinkAnalytics)
);

/**
 * GET /api/analytics/comparison
 * Compare analytics for multiple links
 * Query params: linkIds[], period
 */
router.get('/comparison', 
  asyncErrorHandler(analyticsController.compareLinks)
);

/**
 * GET /api/analytics/export/:linkId
 * Export analytics data (JSON/CSV) with enhanced formatting
 * Query params: period, format
 */
router.get('/export/:linkId', 
  asyncErrorHandler(analyticsController.exportAnalytics)
);

/**
 * GET /api/analytics/real-time/:linkId
 * Get real-time analytics for link (requires ElasticSearch)
 * Query params: minutes
 */
router.get('/real-time/:linkId', 
  asyncErrorHandler(analyticsController.getRealTimeAnalytics)
);

/**
 * GET /api/analytics/trends
 * Get analytics trends and insights
 * Query params: period
 */
router.get('/trends', 
  asyncErrorHandler(analyticsController.getTrends)
);

/**
 * GET /api/analytics/health
 * Health check endpoint for analytics services
 */
router.get('/health', 
  asyncErrorHandler(analyticsController.healthCheck)
);

// ===== ES6 ERROR HANDLING MIDDLEWARE =====
// Apply analytics-specific error handler
router.use(analyticsErrorHandler);

module.exports = router;