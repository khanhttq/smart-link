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

// ===== QUEUE MANAGEMENT ROUTES =====
const bullMQService = require('../../../core/queue/BullMQService');

// GET /api/admin/queues - Xem trạng thái tất cả queues
router.get('/queues', async (req, res) => {
  try {
    if (!bullMQService.isInitialized) {
      return res.status(503).json({
        success: false,
        message: 'Background job system not initialized'
      });
    }

    const stats = await bullMQService.getQueueStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date(),
        systemStatus: 'healthy'
      }
    });

  } catch (error) {
    console.error('❌ Queue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message
    });
  }
});

// POST /api/admin/jobs/test - Test thêm jobs mẫu
router.post('/jobs/test', async (req, res) => {
  try {
    const results = [];

    // Test metadata job
    const metadataJobId = await bullMQService.addMetadataJob(
      'test-link-' + Date.now(),
      'https://google.com',
      'test-user'
    );
    results.push({ type: 'metadata', jobId: metadataJobId });

    // Test email job
    const emailJobId = await bullMQService.addWelcomeEmailJob(
      'test@example.com',
      { name: 'Test User' }
    );
    results.push({ type: 'email', jobId: emailJobId });

    res.json({
      success: true,
      message: 'Test jobs added successfully',
      data: { jobs: results }
    });

  } catch (error) {
    console.error('❌ Test jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add test jobs',
      error: error.message
    });
  }
});

// POST /api/admin/queues/:queueName/retry - Retry failed jobs
router.post('/queues/:queueName/retry', async (req, res) => {
  try {
    const { queueName } = req.params;
    
    const retriedCount = await bullMQService.retryFailedJobs(queueName);
    
    res.json({
      success: true,
      message: `Retried ${retriedCount} failed jobs in ${queueName} queue`,
      data: { retriedCount }
    });

  } catch (error) {
    console.error('❌ Retry jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry jobs',
      error: error.message
    });
  }
});

module.exports = router;

