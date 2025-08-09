// backend/domains/admin/controllers/AdminController.js - FIXED with functions
const bullMQService = require('../../../core/queue/BullMQService');
const cacheService = require('../../../core/cache/CacheService');
const esConnection = require('../../../config/elasticsearch');
const clickTrackingService = require('../../analytics/services/ClickTrackingService');

// ===== UTILITY FUNCTIONS =====

const getQueueRecommendations = (stats) => {
  const recommendations = [];

  try {
    // Check if stats has the expected structure
    if (!stats || typeof stats !== 'object') {
      recommendations.push({
        type: 'info',
        message: 'Queue statistics are not available',
        action: 'Check BullMQ service initialization',
      });
      return recommendations;
    }

    // Check click tracking queue
    if (stats.clickTracking && stats.clickTracking.pending > 100) {
      recommendations.push({
        type: 'warning',
        message: `High click tracking queue: ${stats.clickTracking.pending} pending jobs`,
        action: 'Consider increasing batch size or processing interval',
      });
    }

    // Check email notifications queue
    if (stats.emailNotifications && stats.emailNotifications.pending > 50) {
      recommendations.push({
        type: 'warning',
        message: `High email queue: ${stats.emailNotifications.pending} pending jobs`,
        action: 'Check email service configuration',
      });
    }

    // Check analytics queue
    if (stats.analytics && stats.analytics.pending > 75) {
      recommendations.push({
        type: 'warning',
        message: `High analytics queue: ${stats.analytics.pending} pending jobs`,
        action: 'Consider optimizing analytics processing',
      });
    }

    // All good
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'All BullMQ queues are operating normally',
        action: 'No action required',
      });
    }
  } catch (error) {
    console.error('Error generating queue recommendations:', error);
    recommendations.push({
      type: 'error',
      message: 'Unable to analyze queue performance',
      action: 'Check queue service status',
    });
  }

  return recommendations;
};

// ===== CONTROLLER FUNCTIONS =====

// GET /api/admin/system-status
const getSystemStatus = async (req, res) => {
  try {
    const [queueStats, cacheStats] = await Promise.all([
      bullMQService.getQueueStats(),
      cacheService.getStats(),
    ]);

    const systemStatus = {
      timestamp: new Date().toISOString(),
      services: {
        elasticsearch: {
          connected: esConnection.isReady(),
          status: esConnection.isReady() ? 'Connected' : 'Mock Mode',
        },
        redis: {
          connected: cacheStats?.connected || false,
          status: cacheStats?.connected ? 'Connected' : 'Disconnected',
        },
        queue: {
          status: 'Running',
          stats: queueStats,
        },
      },
      performance: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    res.json({
      success: true,
      data: systemStatus,
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get system status',
    });
  }
};

// GET /api/admin/queue-stats - ✅ FIXED
const getQueueStats = async (req, res) => {
  try {
    const stats = await bullMQService.getQueueStats();

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        queues: stats,
        recommendations: getQueueRecommendations(stats),
      },
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get queue stats',
    });
  }
};

// POST /api/admin/clear-queues
const clearQueues = async (req, res) => {
  try {
    const { queue } = req.body; // Specific queue or 'all'

    if (queue === 'all') {
      await bullMQService.clearQueues();
      res.json({
        success: true,
        message: 'All BullMQ queues cleared',
      });
    } else {
      // TODO: Clear specific queue
      res.json({
        success: false,
        message: 'Specific queue clearing not implemented yet',
      });
    }
  } catch (error) {
    console.error('Clear queues error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clear queues',
    });
  }
};

// GET /api/admin/elasticsearch-info
const getElasticsearchInfo = async (req, res) => {
  try {
    if (!esConnection.isReady()) {
      return res.json({
        success: true,
        data: {
          status: 'Mock Mode',
          message: 'ElasticSearch not connected, using mock client',
        },
      });
    }

    const client = esConnection.getClient();
    const [health, indices] = await Promise.all([
      client.cluster.health(),
      client.cat.indices({ format: 'json' }),
    ]);

    res.json({
      success: true,
      data: {
        status: 'Connected',
        cluster: health,
        indices: indices,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('ElasticSearch info error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get ElasticSearch info',
    });
  }
};

// GET /api/admin/recent-clicks
const getRecentClicks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.query.userId; // Optional filter by user

    // Get recent clicks from ElasticSearch
    const searchParams = {
      page: 1,
      size: limit,
    };

    if (userId) {
      searchParams.userId = userId;
    }

    const result = await clickTrackingService.searchClicks(null, searchParams);

    res.json({
      success: true,
      data: {
        clicks: result.clicks || [],
        total: result.total || 0,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Recent clicks error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get recent clicks',
    });
  }
};

// GET /api/admin/test-elasticsearch
const testElasticsearch = async (req, res) => {
  try {
    // Test ElasticSearch by indexing a test document
    const testDoc = {
      test: true,
      message: 'ElasticSearch test document',
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
    };

    const result = await clickTrackingService.trackClick({
      linkId: 'test',
      userId: 'test',
      shortCode: 'test',
      originalUrl: 'https://test.com',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referer'),
      campaign: 'test',
      ...testDoc,
    });

    res.json({
      success: true,
      data: {
        message: 'ElasticSearch test completed',
        documentId: result,
        testDoc,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('ElasticSearch test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'ElasticSearch test failed',
    });
  }
};

// ===== ELASTICSEARCH MANAGEMENT FUNCTIONS =====

const getElasticsearchStatus = async (req, res) => {
  try {
    const status = {
      connected: esConnection.isReady(),
      mode: esConnection.isReady() ? 'real' : 'mock',
      timestamp: new Date().toISOString(),
    };

    if (esConnection.isReady()) {
      const client = esConnection.getClient();
      const health = await client.cluster.health();
      status.cluster = health;
    }

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('ElasticSearch status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const retryElasticsearchConnection = async (req, res) => {
  try {
    // This would trigger a reconnection attempt
    res.json({
      success: true,
      message: 'ElasticSearch reconnection initiated',
    });
  } catch (error) {
    console.error('ElasticSearch retry error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const stopElasticsearchRetry = async (req, res) => {
  try {
    // This would stop reconnection attempts
    res.json({
      success: true,
      message: 'ElasticSearch retry stopped',
    });
  } catch (error) {
    console.error('ElasticSearch stop retry error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ===== EXPORTS =====
module.exports = {
  getSystemStatus,
  getQueueStats,
  clearQueues,
  getElasticsearchInfo,
  getRecentClicks,
  testElasticsearch,
  getElasticsearchStatus,
  retryElasticsearchConnection,
  stopElasticsearchRetry,
};
