// SỬA FILE: backend/domains/admin/routes/adminRoutes.js
// Fix middleware và thêm ES management routes

const express = require('express');
const adminController = require('../controllers/AdminController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware.verifyToken);

// Apply admin role check to all routes
router.use(authMiddleware.requireRole('admin'));

// ===== EXISTING ROUTES =====
// System monitoring endpoints
router.get('/system-status', adminController.getSystemStatus);
router.get('/queue-stats', adminController.getQueueStats);
router.post('/clear-queues', adminController.clearQueues);

// ElasticSearch monitoring (existing)
router.get('/elasticsearch-info', adminController.getElasticsearchInfo);
router.get('/test-elasticsearch', adminController.testElasticsearch);

// Analytics monitoring
router.get('/recent-clicks', adminController.getRecentClicks);

// ===== NEW ELASTICSEARCH MANAGEMENT ROUTES =====
// ElasticSearch connection management
router.get('/elasticsearch/status', adminController.getElasticsearchStatus);
router.post('/elasticsearch/retry', adminController.retryElasticsearchConnection);
router.post('/elasticsearch/stop-retry', adminController.stopElasticsearchRetry);

module.exports = router;