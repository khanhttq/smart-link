// domains/admin/controllers/AdminController.js
const queueService = require('../../../core/queue/QueueService');
const cacheService = require('../../../core/cache/CacheService');
const esConnection = require('../../../config/elasticsearch');
const clickTrackingService = require('../../analytics/services/ClickTrackingService');

class AdminController {
  // GET /api/admin/system-status
  async getSystemStatus(req, res) {
    try {
      const [queueStats, cacheStats] = await Promise.all([
        queueService.getStats(),
        cacheService.getStats()
      ]);

      const systemStatus = {
        timestamp: new Date().toISOString(),
        services: {
          elasticsearch: {
            connected: esConnection.isReady(),
            status: esConnection.isReady() ? 'Connected' : 'Mock Mode'
          },
          redis: {
            connected: cacheStats?.connected || false,
            status: cacheStats?.connected ? 'Connected' : 'Disconnected'
          },
          queue: {
            status: 'Running',
            stats: queueStats
          }
        },
        performance: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      };

      res.json({
        success: true,
        data: systemStatus
      });
    } catch (error) {
      console.error('System status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get system status'
      });
    }
  }

  // GET /api/admin/queue-stats
  async getQueueStats(req, res) {
    try {
      const stats = queueService.getStats();
      
      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          queues: stats,
          recommendations: this.getQueueRecommendations(stats)
        }
      });
    } catch (error) {
      console.error('Queue stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get queue stats'
      });
    }
  }

  // POST /api/admin/clear-queues
  async clearQueues(req, res) {
    try {
      const { queue } = req.body; // Specific queue or 'all'
      
      if (queue === 'all') {
        queueService.clearQueues();
        res.json({
          success: true,
          message: 'All queues cleared'
        });
      } else {
        // TODO: Clear specific queue
        res.json({
          success: false,
          message: 'Specific queue clearing not implemented yet'
        });
      }
    } catch (error) {
      console.error('Clear queues error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to clear queues'
      });
    }
  }

  // GET /api/admin/elasticsearch-info
  async getElasticsearchInfo(req, res) {
    try {
      if (!esConnection.isReady()) {
        return res.json({
          success: true,
          data: {
            status: 'Mock Mode',
            message: 'ElasticSearch not connected, using mock client'
          }
        });
      }

      const client = esConnection.getClient();
      const [health, indices] = await Promise.all([
        client.cluster.health(),
        client.cat.indices({ format: 'json' })
      ]);

      res.json({
        success: true,
        data: {
          status: 'Connected',
          cluster: health,
          indices: indices,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('ElasticSearch info error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get ElasticSearch info'
      });
    }
  }

  // GET /api/admin/recent-clicks
  async getRecentClicks(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const userId = req.query.userId; // Optional filter by user
      
      // Get recent clicks from ElasticSearch
      const searchParams = {
        page: 1,
        size: limit
      };
      
      if (userId) {
        searchParams.userId = userId;
      }

      const result = await clickTrackingService.searchClicks(null, searchParams);
      
      res.json({
        success: true,
        data: {
          clicks: result.clicks,
          total: result.total,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Recent clicks error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get recent clicks'
      });
    }
  }

  // GET /api/admin/test-elasticsearch
  async testElasticsearch(req, res) {
    try {
      // Test ElasticSearch by indexing a test document
      const testDoc = {
        test: true,
        message: 'ElasticSearch test document',
        timestamp: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV
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
        ...testDoc
      });

      res.json({
        success: true,
        data: {
          message: 'ElasticSearch test completed',
          documentId: result,
          testDoc,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('ElasticSearch test error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'ElasticSearch test failed'
      });
    }
  }

  // UTILITY METHODS

  getQueueRecommendations(stats) {
    const recommendations = [];
    
    if (stats.clickTracking.pending > 100) {
      recommendations.push({
        type: 'warning',
        message: `High click tracking queue: ${stats.clickTracking.pending} pending jobs`,
        action: 'Consider increasing batch size or processing interval'
      });
    }
    
    if (stats.emailNotifications.pending > 50) {
      recommendations.push({
        type: 'warning',
        message: `High email queue: ${stats.emailNotifications.pending} pending jobs`,
        action: 'Check email service configuration'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        message: 'All queues are operating normally',
        action: 'No action required'
      });
    }
    
    return recommendations;
  }
}

module.exports = new AdminController();