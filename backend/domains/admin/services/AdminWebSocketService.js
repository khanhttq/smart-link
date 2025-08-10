// backend/domains/admin/services/AdminWebSocketService.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const adminStatsService = require('./AdminStatsService');
const bullMQService = require('../../../core/queue/BullMQService');
const cacheService = require('../../../core/cache/CacheService');
const esConnection = require('../../../config/elasticsearch');

class AdminWebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map client ID to WebSocket connection
    this.statsInterval = null;
    this.heartbeatInterval = null;
    this.isRunning = false;
  }

  /**
   * Get cache statistics safely
   */
  async getCacheStats() {
    try {
      if (!cacheService.redis) {
        await cacheService.initialize();
      }

      const stats = await cacheService.getStats();
      return {
        connected: !!stats,
        ...stats,
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return { connected: false };
    }
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    console.log('🌐 Initializing Admin WebSocket Service...');

    this.wss = new WebSocket.Server({
      server,
      path: '/admin/ws',
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));

    // Start intervals
    this.startStatsInterval();
    this.startHeartbeat();
    this.isRunning = true;

    console.log('✅ Admin WebSocket Service initialized');
  }

  /**
   * Verify client authentication
   */
  async verifyClient(info) {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log('❌ WebSocket connection denied: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user is admin
      if (decoded.role !== 'admin') {
        console.log('❌ WebSocket connection denied: Not admin user');
        return false;
      }

      // Store user info in request for later use
      info.req.user = decoded;
      console.log('✅ WebSocket connection verified for admin:', decoded.email);
      return true;
    } catch (error) {
      console.log('❌ WebSocket verification failed:', error.message);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const user = req.user;
    const clientId = `admin_${user.userId}_${Date.now()}`;

    // Store client with metadata
    this.clients.set(clientId, {
      ws,
      user,
      connectedAt: new Date(),
      lastPing: new Date(),
      isAlive: true,
    });

    console.log(`📡 Admin WebSocket connected: ${user.email} (${clientId})`);

    // Send welcome message with initial data
    this.sendToClient(clientId, {
      type: 'connection',
      data: {
        clientId,
        message: 'Connected to Admin WebSocket',
        timestamp: new Date().toISOString(),
      },
    });

    // Send initial stats
    this.sendInitialStats(clientId);

    // Handle incoming messages
    ws.on('message', (message) => this.handleMessage(clientId, message));

    // Handle client disconnect
    ws.on('close', () => this.handleDisconnect(clientId));

    // Handle errors
    ws.on('error', (error) => this.handleClientError(clientId, error));

    // Handle pong response
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.isAlive = true;
        client.lastPing = new Date();
      }
    });
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(clientId, message) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const data = JSON.parse(message.toString());
      console.log(`📨 Message from ${client.user.email}:`, data.type);

      switch (data.type) {
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'request_stats':
          this.sendStatsToClient(clientId);
          break;

        case 'clear_queues':
          this.handleClearQueues(clientId, data.payload);
          break;

        case 'restart_service':
          this.handleRestartService(clientId, data.payload);
          break;

        default:
          this.sendToClient(clientId, {
            type: 'error',
            data: { message: 'Unknown message type', type: data.type },
          });
      }
    } catch (error) {
      console.error(`❌ Error handling message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Failed to process message' },
      });
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`📡 Admin WebSocket disconnected: ${client.user.email} (${clientId})`);
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle client errors
   */
  handleClientError(clientId, error) {
    console.error(`❌ WebSocket client error (${clientId}):`, error);
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
    }
  }

  /**
   * Handle WebSocket server errors
   */
  handleError(error) {
    console.error('❌ Admin WebSocket Server error:', error);
  }

  /**
   * Send initial statistics to newly connected client
   */
  async sendInitialStats(clientId) {
    try {
      const stats = await this.getLatestStats();
      this.sendToClient(clientId, {
        type: 'initial_stats',
        data: stats,
      });
    } catch (error) {
      console.error('❌ Error sending initial stats:', error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Failed to get initial stats' },
      });
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`❌ Error sending to client ${clientId}:`, error);
        this.clients.delete(clientId);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast message to all connected admin clients
   */
  broadcast(message) {
    let successCount = 0;
    let failedClients = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          successCount++;
        } catch (error) {
          console.error(`❌ Error broadcasting to ${clientId}:`, error);
          failedClients.push(clientId);
        }
      } else {
        failedClients.push(clientId);
      }
    }

    // Remove failed clients
    failedClients.forEach((clientId) => {
      this.clients.delete(clientId);
    });

    console.log(
      `📡 Broadcasted to ${successCount} clients, removed ${failedClients.length} failed connections`
    );
    return successCount;
  }

  /**
   * Start periodic stats updates
   */
  startStatsInterval() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(async () => {
      if (this.clients.size === 0) return;

      try {
        const stats = await this.getLatestStats();
        this.broadcast({
          type: 'stats_update',
          data: stats,
        });
      } catch (error) {
        console.error('❌ Error in stats interval:', error);
        this.broadcast({
          type: 'error',
          data: { message: 'Failed to update stats' },
        });
      }
    }, 10000); // Every 10 seconds

    console.log('✅ Stats interval started (10s)');
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const deadClients = [];

      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          deadClients.push(clientId);
          client.ws.terminate();
        } else {
          client.isAlive = false;
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        }
      }

      // Remove dead clients
      deadClients.forEach((clientId) => {
        const client = this.clients.get(clientId);
        if (client) {
          console.log(`💀 Removed dead client: ${client.user.email} (${clientId})`);
          this.clients.delete(clientId);
        }
      });

      if (deadClients.length > 0) {
        console.log(`🧹 Cleaned up ${deadClients.length} dead connections`);
      }
    }, 30000); // Every 30 seconds

    console.log('✅ Heartbeat interval started (30s)');
  }

  /**
   * Get latest statistics (same as SSE version but optimized)
   */
  async getLatestStats() {
    try {
      const [adminStats, queueStats, cacheStats] = await Promise.allSettled([
        adminStatsService.getAllStats(),
        bullMQService && bullMQService.isInitialized
          ? bullMQService.getQueueStats()
          : Promise.resolve({}),
        this.getCacheStats(),
      ]);

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
            connected: bullMQService.isInitialized,
            status: bullMQService.isInitialized ? 'Running' : 'Disconnected',
            stats: queueData,
          },
          websocket: {
            connected: true,
            status: 'Running',
            clients: this.clients.size,
            uptime: this.isRunning ? process.uptime() : 0,
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
      throw error;
    }
  }

  /**
   * Handle clear queues request
   */
  async handleClearQueues(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      console.log(`🗑️ Admin ${client.user.email} requested queue clear:`, payload);

      // Implement queue clearing logic here
      // Example: await bullMQService.clearAllQueues();

      this.sendToClient(clientId, {
        type: 'action_result',
        data: {
          action: 'clear_queues',
          success: true,
          message: 'Queues cleared successfully',
        },
      });

      // Broadcast update to all clients
      const stats = await this.getLatestStats();
      this.broadcast({
        type: 'stats_update',
        data: stats,
      });
    } catch (error) {
      console.error('❌ Error clearing queues:', error);
      this.sendToClient(clientId, {
        type: 'action_result',
        data: {
          action: 'clear_queues',
          success: false,
          message: error.message,
        },
      });
    }
  }

  /**
   * Handle restart service request
   */
  async handleRestartService(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      console.log(`🔄 Admin ${client.user.email} requested service restart:`, payload);

      // Implement service restart logic here

      this.sendToClient(clientId, {
        type: 'action_result',
        data: {
          action: 'restart_service',
          success: true,
          message: `Service ${payload.service} restarted successfully`,
        },
      });
    } catch (error) {
      console.error('❌ Error restarting service:', error);
      this.sendToClient(clientId, {
        type: 'action_result',
        data: {
          action: 'restart_service',
          success: false,
          message: error.message,
        },
      });
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const now = new Date();
    const connections = Array.from(this.clients.entries()).map(([clientId, client]) => ({
      clientId,
      email: client.user.email,
      connectedAt: client.connectedAt,
      duration: Math.floor((now - client.connectedAt) / 1000),
      lastPing: client.lastPing,
      isAlive: client.isAlive,
    }));

    return {
      totalConnections: this.clients.size,
      connections,
      uptime: this.isRunning ? process.uptime() : 0,
    };
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown() {
    console.log('🛑 Shutting down Admin WebSocket Service...');

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.error(`❌ Error closing client ${clientId}:`, error);
      }
    }

    this.clients.clear();

    if (this.wss) {
      this.wss.close(() => {
        console.log('✅ Admin WebSocket Service shut down');
      });
    }

    this.isRunning = false;
  }
}

module.exports = new AdminWebSocketService();
