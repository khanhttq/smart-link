// backend/domains/admin/controllers/AdminSSEController.js - COMPLETE
const adminStatsService = require('../services/AdminStatsService');
const bullMQService = require('../../../core/queue/BullMQService');
const cacheService = require('../../../core/cache/CacheService');
const esConnection = require('../../../config/elasticsearch');

class AdminSSEController {
  constructor() {
    this.clients = new Set(); // Track connected clients
  }

  /**
   * GET /api/admin/live-stats - SSE endpoint
   */
  async liveStats(req, res) {
    console.log('📡 New SSE client connected for user:', req.user.email);

    // ✅ req.user đã được authenticated bởi middleware
    console.log('✅ SSE: Starting stream for admin user:', req.user.email);

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Add client to tracking
    this.clients.add(res);

    // Send initial data
    try {
      const initialData = await this.getLatestStats();
      this.sendSSEData(res, 'stats-update', initialData);
      console.log('✅ SSE: Initial data sent to', req.user.email);
    } catch (error) {
      console.error('❌ Error sending initial SSE data:', error);
      this.sendSSEData(res, 'error', {
        message: 'Failed to get initial data',
        error: error.message,
      });
    }

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        this.clients.delete(res);
        return;
      }
      this.sendSSEData(res, 'heartbeat', {
        timestamp: new Date().toISOString(),
        user: req.user.email,
      });
    }, 30000);

    // Send stats update every 10 seconds
    const statsInterval = setInterval(async () => {
      if (res.writableEnded) {
        clearInterval(statsInterval);
        clearInterval(heartbeatInterval);
        this.clients.delete(res);
        return;
      }

      try {
        const latestStats = await this.getLatestStats();
        this.sendSSEData(res, 'stats-update', latestStats);
        console.log('📊 SSE: Stats update sent to', req.user.email);
      } catch (error) {
        console.error('❌ Error in SSE stats update:', error);
        this.sendSSEData(res, 'error', {
          message: 'Failed to update stats',
          error: error.message,
        });
      }
    }, 10000); // Update every 10 seconds

    // Handle client disconnect
    req.on('close', () => {
      console.log('📡 SSE client disconnected:', req.user.email);
      clearInterval(heartbeatInterval);
      clearInterval(statsInterval);
      this.clients.delete(res);
    });

    req.on('end', () => {
      console.log('📡 SSE client ended connection:', req.user.email);
      clearInterval(heartbeatInterval);
      clearInterval(statsInterval);
      this.clients.delete(res);
    });

    // Handle connection errors
    req.on('error', (error) => {
      console.error('❌ SSE connection error for', req.user.email, ':', error);
      clearInterval(heartbeatInterval);
      clearInterval(statsInterval);
      this.clients.delete(res);
    });
  }

  /**
   * Get latest statistics for SSE
   */
  async getLatestStats() {
    try {
      // ✅ Run all stats gathering in parallel with error handling
      const [adminStats, queueStats, cacheStats] = await Promise.allSettled([
        adminStatsService.getAllStats(),
        bullMQService.isInitialized ? bullMQService.getQueueStats() : Promise.resolve({}),
        cacheService.getStats(),
      ]);

      // ✅ Extract results with fallbacks
      const statistics =
        adminStats.status === 'fulfilled'
          ? adminStats.value
          : {
              totalUsers: 0,
              totalLinks: 0,
              todayClicks: 0,
              timestamp: new Date().toISOString(),
              error: adminStats.reason?.message || 'Failed to get admin stats',
            };

      const queueData = queueStats.status === 'fulfilled' ? queueStats.value : {};
      const cacheData = cacheStats.status === 'fulfilled' ? cacheStats.value : { connected: false };

      // System status
      const queueStatus = bullMQService.isInitialized ? 'Running' : 'Disconnected';
      const queueConnected = queueStatus === 'Running';

      return {
        timestamp: new Date().toISOString(),
        statistics,
        services: {
          elasticsearch: {
            connected: esConnection.isReady(),
            status: esConnection.isReady() ? 'Connected' : 'Mock Mode',
          },
          redis: {
            connected: cacheData?.connected || false,
            status: cacheData?.connected ? 'Connected' : 'Disconnected',
          },
          queue: {
            connected: queueConnected,
            status: queueStatus,
            stats: queueData,
          },
        },
        performance: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          environment: process.env.NODE_ENV || 'development',
        },
      };
    } catch (error) {
      console.error('❌ Error getting latest stats:', error);

      // ✅ Return fallback data instead of throwing
      return {
        timestamp: new Date().toISOString(),
        error: 'Failed to gather stats',
        statistics: {
          totalUsers: 0,
          totalLinks: 0,
          todayClicks: 0,
          timestamp: new Date().toISOString(),
        },
        services: {
          elasticsearch: { connected: false, status: 'Error' },
          redis: { connected: false, status: 'Error' },
          queue: { connected: false, status: 'Error', stats: {} },
        },
        performance: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
        },
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          environment: process.env.NODE_ENV || 'development',
        },
      };
    }
  }

  /**
   * Send SSE formatted data
   */
  sendSSEData(res, event, data) {
    try {
      if (!res.writableEnded) {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch (error) {
      console.error('❌ Error sending SSE data:', error);
      // Remove client if write fails
      this.clients.delete(res);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  async broadcastToAll(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const deadClients = [];

    for (const client of this.clients) {
      try {
        if (!client.writableEnded) {
          client.write(message);
        } else {
          deadClients.push(client);
        }
      } catch (error) {
        console.error('❌ Error broadcasting to client:', error);
        deadClients.push(client);
      }
    }

    // Clean up dead clients
    deadClients.forEach((client) => this.clients.delete(client));

    console.log(`📡 Broadcast sent to ${this.clients.size} clients`);
  }

  /**
   * Get active client count
   */
  getActiveClientCount() {
    return this.clients.size;
  }

  /**
   * Manually trigger broadcast (for testing/debugging)
   */
  async triggerBroadcast() {
    try {
      const stats = await this.getLatestStats();
      await this.broadcastToAll('manual-update', {
        ...stats,
        trigger: 'manual',
        activeClients: this.getActiveClientCount(),
      });
      return true;
    } catch (error) {
      console.error('❌ Manual broadcast failed:', error);
      return false;
    }
  }
}

module.exports = new AdminSSEController();
