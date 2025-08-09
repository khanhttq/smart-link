// backend/domains/admin/routes/adminRoutes.js - COMPLETE WITH SSE
const express = require('express');
const adminController = require('../controllers/AdminController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// ✅ Import SSE Controller và middleware
const adminSSEController = require('../controllers/AdminSSEController');
const { sseAuthMiddleware, sseAdminMiddleware } = require('../middleware/sseAuthMiddleware');

// Import rate limiting từ security domain
const securityDomain = require('../../security');
const { generalLimiter } = securityDomain.middleware.rateLimiter;

const router = express.Router();

// ✅ SSE Route với proper middleware (TRƯỚC router.use để không bị override)
router.get(
  '/live-stats',
  generalLimiter, // Rate limiting
  sseAuthMiddleware, // Authentication (supports query token)
  sseAdminMiddleware, // Admin role check
  adminSSEController.liveStats.bind(adminSSEController)
);

// ===== USE NORMAL MIDDLEWARE FOR OTHER ROUTES =====
// Apply auth middleware to all routes (except SSE above)
router.use(authMiddleware.verifyToken);

// Apply admin role check to all routes
router.use(authMiddleware.requireRole('admin'));

// ===== EXISTING ROUTES =====
// System monitoring endpoints
router.get('/system-status', adminController.getSystemStatus);
router.get('/queue-stats', adminController.getQueueStats);
router.get('/statistics', adminController.getAdminStatistics);
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
        message: 'Background job system not initialized',
      });
    }

    const stats = await bullMQService.getQueueStats();

    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date(),
        systemStatus: 'healthy',
      },
    });
  } catch (error) {
    console.error('❌ Queue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue statistics',
      error: error.message,
    });
  }
});

// POST /api/admin/jobs/test - Test thêm jobs mẫu
router.post('/jobs/test', async (req, res) => {
  try {
    const results = [];

    // Test metadata job
    if (bullMQService.isInitialized) {
      const metadataJobId = await bullMQService.addMetadataJob(
        'test-link-123',
        'https://example.com',
        req.user.id
      );
      results.push({
        type: 'metadata',
        jobId: metadataJobId,
        status: 'queued',
      });

      // Test email job
      const emailJobId = await bullMQService.addEmailJob('welcome', req.user.email, {
        userName: req.user.name || 'Admin',
      });
      results.push({
        type: 'email',
        jobId: emailJobId,
        status: 'queued',
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Test jobs added successfully',
        results,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('❌ Test jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add test jobs',
      error: error.message,
    });
  }
});

// POST /api/admin/jobs/clear - Clear failed jobs
router.post('/jobs/clear', async (req, res) => {
  try {
    const { queue = 'all' } = req.body;
    const results = {};

    if (bullMQService.isInitialized) {
      if (queue === 'all') {
        // Clear all queues
        for (const queueName of ['metadata', 'email', 'analytics', 'clickTracking']) {
          try {
            const cleared = await bullMQService.retryFailedJobs(queueName);
            results[queueName] = { cleared, status: 'success' };
          } catch (error) {
            results[queueName] = { cleared: 0, status: 'error', error: error.message };
          }
        }
      } else {
        // Clear specific queue
        const cleared = await bullMQService.retryFailedJobs(queue);
        results[queue] = { cleared, status: 'success' };
      }
    }

    res.json({
      success: true,
      data: {
        message: 'Job clearing completed',
        results,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('❌ Clear jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear jobs',
      error: error.message,
    });
  }
});

// ===== USER MANAGEMENT ROUTES (Future) =====
// TODO: Implement these when UserManagementPage is ready

// GET /api/admin/users - List all users with pagination
router.get('/users', (req, res) => {
  // TODO: Implement user listing
  res.status(501).json({
    success: false,
    message: 'User management not implemented yet',
  });
});

// PUT /api/admin/users/:id/role - Change user role
router.put('/users/:id/role', (req, res) => {
  // TODO: Implement role management
  res.status(501).json({
    success: false,
    message: 'Role management not implemented yet',
  });
});

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/users/:id/suspend', (req, res) => {
  // TODO: Implement user suspension
  res.status(501).json({
    success: false,
    message: 'User suspension not implemented yet',
  });
});

// ===== LINK MODERATION ROUTES (Future) =====
// TODO: Implement these when LinkModerationPage is ready

// GET /api/admin/links - List all links with moderation status
router.get('/links', (req, res) => {
  // TODO: Implement link moderation listing
  res.status(501).json({
    success: false,
    message: 'Link moderation not implemented yet',
  });
});

// POST /api/admin/links/:id/approve - Approve link
router.post('/links/:id/approve', (req, res) => {
  // TODO: Implement link approval
  res.status(501).json({
    success: false,
    message: 'Link approval not implemented yet',
  });
});

// DELETE /api/admin/links/:id - Remove malicious link
router.delete('/links/:id', (req, res) => {
  // TODO: Implement link removal
  res.status(501).json({
    success: false,
    message: 'Link removal not implemented yet',
  });
});

// ===== SYSTEM CONFIGURATION ROUTES (Future) =====
// TODO: Implement these when SystemSettingsPage is ready

// GET /api/admin/config - Get system configuration
router.get('/config', (req, res) => {
  // TODO: Implement system config retrieval
  res.status(501).json({
    success: false,
    message: 'System configuration not implemented yet',
  });
});

// PUT /api/admin/config - Update system configuration
router.put('/config', (req, res) => {
  // TODO: Implement system config update
  res.status(501).json({
    success: false,
    message: 'System configuration update not implemented yet',
  });
});

module.exports = router;
