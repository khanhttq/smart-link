// domains/admin/routes/adminRoutes.js
const express = require('express');
const adminController = require('../controllers/AdminController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware - TODO: Add admin role check
router.use(authMiddleware.verifyToken);

// System monitoring endpoints
router.get('/system-status', adminController.getSystemStatus);
router.get('/queue-stats', adminController.getQueueStats);
router.post('/clear-queues', adminController.clearQueues);

// ElasticSearch monitoring
router.get('/elasticsearch-info', adminController.getElasticsearchInfo);
router.get('/test-elasticsearch', adminController.testElasticsearch);

// Analytics monitoring
router.get('/recent-clicks', adminController.getRecentClicks);

module.exports = router;