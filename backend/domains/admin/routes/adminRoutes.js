// backend/domains/admin/routes/adminRoutes.js - UPDATED WITH STEALTH MODE
const express = require('express');
const adminController = require('../controllers/AdminController');
const authMiddleware = require('../../auth/middleware/authMiddleware');
const adminStealthMiddleware = require('../middleware/adminStealthMiddleware');

const router = express.Router();

// ===== STEALTH MODE: Use combined auth + admin check =====
// This returns 404 for any non-admin access instead of 401/403
router.use(adminStealthMiddleware.verifyAdminStealth);

// ===== ALTERNATIVE: Use separate middlewares (commented out) =====
// router.use(authMiddleware.verifyToken);
// router.use(adminStealthMiddleware.requireAdminStealth);

// ===== EXISTING ROUTES - All protected by stealth mode =====

// System monitoring endpoints
router.get('/system-status', adminController.getSystemStatus);
router.get('/queue-stats', adminController.getQueueStats);
router.post('/clear-queues', adminController.clearQueues);

// ElasticSearch monitoring
router.get('/elasticsearch-info', adminController.getElasticsearchInfo);
router.get('/test-elasticsearch', adminController.testElasticsearch);
router.get('/elasticsearch/status', adminController.getElasticsearchStatus);
router.post('/elasticsearch/retry', adminController.retryElasticsearchConnection);
router.post('/elasticsearch/stop-retry', adminController.stopElasticsearchRetry);

// Analytics monitoring
router.get('/recent-clicks', adminController.getRecentClicks);

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
    
    results.push({
      type: 'metadata',
      jobId: metadataJobId,
      status: 'queued'
    });

    // Test analytics job (if exists)
    try {
      const analyticsJobId = await bullMQService.addAnalyticsJob(
        'test-event-' + Date.now(),
        { test: true }
      );
      
      results.push({
        type: 'analytics',
        jobId: analyticsJobId,
        status: 'queued'
      });
    } catch (analyticsError) {
      console.log('ℹ️ Analytics job not available:', analyticsError.message);
    }

    res.json({
      success: true,
      data: {
        message: 'Test jobs created successfully',
        jobs: results,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Test jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test jobs',
      error: error.message
    });
  }
});

// ===== FUTURE ADMIN ROUTES =====
/*
// User management (TODO)
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id/status', adminController.updateUserStatus);

// Link moderation (TODO)
router.get('/links', adminController.getLinks);
router.put('/links/:id/moderate', adminController.moderateLink);
router.delete('/links/bulk', adminController.bulkDeleteLinks);

// System settings (TODO)
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

// Audit logs (TODO)
router.get('/audit-logs', adminController.getAuditLogs);
*/

module.exports = router;