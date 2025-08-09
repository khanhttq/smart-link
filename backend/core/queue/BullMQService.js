// backend/core/queue/BullMQService.js - COMPLETE VERSION AFTER MIGRATION
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');

class BullMQService {
  constructor() {
    this.connection = null;
    this.queues = {};
    this.workers = {};
    this.events = {};
    this.isInitialized = false;
  }

  // ===== INITIALIZATION METHODS =====

  /**
   * Initialize BullMQ Service with Redis connection and queues
   */
  async initialize() {
    console.log('📋 Khởi tạo BullMQ Service...');

    try {
      // Cấu hình Redis cho BullMQ (khác với Redis thường)
      this.connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: 1, // Use DB 1 for BullMQ (DB 0 for cache)
        maxRetriesPerRequest: null, // BullMQ yêu cầu null
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true, // Kết nối lazy để tránh lỗi
      });

      await this.connection.ping();
      console.log('✅ Kết nối BullMQ Redis thành công');

      // Khởi tạo queues
      await this.initializeQueues();

      // Khởi tạo workers
      await this.initializeWorkers();

      // Khởi tạo event listeners
      this.initializeEventListeners();

      this.isInitialized = true;
      console.log('✅ BullMQ Service khởi tạo hoàn tất');
    } catch (error) {
      console.error('❌ Khởi tạo BullMQ thất bại:', error);
      throw error;
    }
  }

  /**
   * Initialize all queues with proper configuration
   */
  async initializeQueues() {
    const queueOptions = {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100, // Giữ 100 job hoàn thành
        removeOnFail: 50, // Giữ 50 job thất bại
        attempts: 3, // Thử lại 3 lần
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    };

    // Khởi tạo các queue
    this.queues.metadata = new Queue('metadata-fetching', queueOptions);
    this.queues.email = new Queue('email-notifications', queueOptions);
    this.queues.analytics = new Queue('analytics-processing', queueOptions);
    this.queues.clickTracking = new Queue('click-tracking', queueOptions);

    console.log('✅ Các queue được khởi tạo thành công');
  }

  /**
   * Initialize workers for processing jobs
   */
  async initializeWorkers() {
    const workerOptions = {
      connection: this.connection,
      concurrency: 5, // Xử lý 5 job đồng thời
    };

    // Worker xử lý metadata
    this.workers.metadata = new Worker(
      'metadata-fetching',
      async (job) => {
        return await this.processMetadataJob(job);
      },
      workerOptions
    );

    // Worker xử lý email
    this.workers.email = new Worker(
      'email-notifications',
      async (job) => {
        return await this.processEmailJob(job);
      },
      workerOptions
    );

    // Worker xử lý analytics
    this.workers.analytics = new Worker(
      'analytics-processing',
      async (job) => {
        return await this.processAnalyticsJob(job);
      },
      workerOptions
    );

    // Worker xử lý click tracking - HIGHER CONCURRENCY
    this.workers.clickTracking = new Worker(
      'click-tracking',
      async (job) => {
        return await this.processClickTrackingJob(job);
      },
      { ...workerOptions, concurrency: 10 }
    ); // Cao hơn vì click tracking nhiều

    console.log('✅ Tất cả Workers đã được khởi tạo');

    // Add error handlers for all workers
    Object.entries(this.workers).forEach(([name, worker]) => {
      worker.on('completed', (job) => {
        console.log(`✅ ${name} job ${job.id} completed`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ ${name} job ${job.id} failed:`, err.message);
      });

      worker.on('error', (err) => {
        console.error(`❌ ${name} worker error:`, err);
      });
    });
  }

  /**
   * Initialize event listeners for queue monitoring
   */
  initializeEventListeners() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      const queueEvents = new QueueEvents(queue.name, { connection: this.connection });
      this.events[name] = queueEvents;

      queueEvents.on('completed', ({ jobId }) => {
        console.log(`📊 Queue ${name}: Job ${jobId} completed`);
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`❌ Queue ${name}: Job ${jobId} failed - ${failedReason}`);
      });
    });
  }

  // ===== JOB ADDITION METHODS =====

  /**
   * Add metadata fetching job
   */
  async addMetadataJob(linkId, url, userId) {
    if (!this.isInitialized) {
      throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.metadata.add('fetch', {
      linkId,
      url,
      userId,
      timestamp: new Date(),
    });

    console.log(`📋 Metadata job được thêm: ${job.id} cho URL: ${url}`);
    return job.id;
  }

  /**
   * Add email notification job
   */
  async addEmailJob(type, to, data) {
    if (!this.isInitialized) {
      throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.email.add(type, {
      type,
      to,
      data,
      timestamp: new Date(),
    });

    console.log(`📧 Email job được thêm: ${job.id} (${type} -> ${to})`);
    return job.id;
  }

  /**
   * Add analytics processing job
   */
  async addAnalyticsJob(type, data, userId) {
    if (!this.isInitialized) {
      throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.analytics.add(type, {
      type,
      data,
      userId,
      timestamp: new Date(),
    });

    console.log(`📈 Analytics job được thêm: ${job.id} (${type})`);
    return job.id;
  }

  /**
   * Add click tracking job - REPLACES queueService.addClickTracking()
   */
  async addClickTrackingJob(linkId, clickData) {
    if (!this.isInitialized) {
      throw new Error('BullMQ Service chưa được khởi tạo');
    }

    const job = await this.queues.clickTracking.add(
      'track',
      {
        linkId,
        clickData: {
          ...clickData,
          timestamp: new Date(),
          queuedAt: new Date(),
        },
        timestamp: new Date(),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    console.log(`📊 Click tracking job added: ${job.id} for link: ${linkId}`);
    return job.id;
  }

  // ===== COMPATIBILITY ALIASES (for QueueService replacement) =====

  /**
   * Alias for addClickTrackingJob - maintains compatibility
   */
  async addClickTracking(linkId, clickData) {
    return this.addClickTrackingJob(linkId, clickData);
  }

  /**
   * Alias for addClickTrackingJob - maintains compatibility
   */
  async queueClickTracking(linkId, clickData) {
    return this.addClickTrackingJob(linkId, clickData);
  }

  // ===== JOB PROCESSING METHODS =====

  /**
   * Process metadata fetching job
   */
  async processMetadataJob(job) {
    const { linkId, url, userId } = job.data;
    console.log(`🔍 Đang xử lý metadata cho: ${url}`);

    try {
      // Update progress
      await job.updateProgress(25);

      // Simulate metadata fetching with axios or cheerio
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Giả lập 2 giây

      await job.updateProgress(75);

      // Giả lập kết quả metadata (thực tế sẽ fetch từ URL)
      const metadata = {
        title: `Title for ${url}`,
        description: `Description for ${url}`,
        image: `https://example.com/image.jpg`,
        fetchedAt: new Date(),
      };

      console.log(`✅ Metadata hoàn thành cho ${url}:`, metadata);

      // Cập nhật progress
      await job.updateProgress(100);

      return {
        success: true,
        linkId,
        metadata,
      };
    } catch (error) {
      console.error(`❌ Lỗi xử lý metadata cho ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Process email notification job
   */
  async processEmailJob(job) {
    const { type, to, data } = job.data;
    console.log(`📧 Đang gửi email ${type} tới: ${to}`);

    try {
      await job.updateProgress(25);

      // Simulate email sending (thực tế sẽ dùng nodemailer, sendgrid, etc.)
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Giả lập 1 giây

      await job.updateProgress(75);

      console.log(`✅ Email ${type} đã gửi thành công tới ${to}`);

      await job.updateProgress(100);

      return {
        success: true,
        type,
        to,
        messageId: `msg-${Date.now()}`,
        sentAt: new Date(),
      };
    } catch (error) {
      console.error(`❌ Lỗi gửi email tới ${to}:`, error.message);
      throw error;
    }
  }

  /**
   * Process analytics job
   */
  async processAnalyticsJob(job) {
    const { type, data } = job.data;
    console.log(`📈 Đang xử lý analytics: ${type}`);

    try {
      await job.updateProgress(25);

      // Simulate analytics processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await job.updateProgress(75);

      console.log(`✅ Analytics ${type} đã xử lý xong`);

      await job.updateProgress(100);

      return {
        success: true,
        type,
        processed: true,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error(`❌ Lỗi xử lý analytics ${type}:`, error.message);
      throw error;
    }
  }

  /**
   * Process click tracking job - REPLACES processClickTrackingQueue()
   */
  async processClickTrackingJob(job) {
    const { linkId, clickData } = job.data;

    try {
      console.log(`📊 Processing click tracking: ${linkId}`);

      // ✅ FIX: Flatten structure cho ClickTrackingService
      const flattenedData = {
        ...clickData, // Spread click data
        linkId: linkId, // Add linkId at root level
      };

      const clickTrackingService = require('../../domains/analytics/services/ClickTrackingService');
      const result = await clickTrackingService.trackClick(flattenedData);

      console.log(`✅ Click tracked successfully: ${linkId}`, result);
      return { success: true, result, linkId };
    } catch (error) {
      console.error(`❌ Click tracking failed: ${linkId}`, error.message);
      throw error;
    }
  }

  // ===== MONITORING & STATS METHODS =====

  /**
   * Get queue statistics - REPLACES queueService.getStats()
   */
  async getQueueStats() {
    if (!this.isInitialized) {
      return {
        clickTracking: { pending: 0, processing: false },
        emailNotifications: { pending: 0 },
        analytics: { pending: 0 },
        metadata: { pending: 0 },
        isInitialized: false,
      };
    }

    try {
      const [clickWaiting, emailWaiting, analyticsWaiting, metadataWaiting] = await Promise.all([
        this.queues.clickTracking.getWaiting(),
        this.queues.email.getWaiting(),
        this.queues.analytics.getWaiting(),
        this.queues.metadata.getWaiting(),
      ]);

      return {
        clickTracking: {
          pending: clickWaiting.length,
          processing: true,
        },
        emailNotifications: {
          pending: emailWaiting.length,
        },
        analytics: {
          pending: analyticsWaiting.length,
        },
        metadata: {
          pending: metadataWaiting.length,
        },
        batchSize: 'N/A', // BullMQ không dùng batch như QueueService cũ
        processInterval: 'Real-time',
        isInitialized: this.isInitialized,
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        clickTracking: { pending: 0, processing: false },
        emailNotifications: { pending: 0 },
        analytics: { pending: 0 },
        metadata: { pending: 0 },
        isInitialized: this.isInitialized,
      };
    }
  }

  /**
   * Get detailed queue statistics
   */
  async getDetailedQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(0, 5), // Last 5 completed
          queue.getFailed(0, 5), // Last 5 failed
          queue.getDelayed(),
        ]);

        stats[name] = {
          counts: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            total:
              waiting.length + active.length + completed.length + failed.length + delayed.length,
          },
          recentJobs: {
            completed: completed.map((job) => ({
              id: job.id,
              finishedOn: job.finishedOn,
              returnvalue: job.returnvalue,
            })),
            failed: failed.map((job) => ({
              id: job.id,
              failedReason: job.failedReason,
              finishedOn: job.finishedOn,
            })),
          },
        };
      } catch (error) {
        console.error(`Error getting stats for ${name}:`, error);
        stats[name] = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Get failed jobs for a specific queue
   */
  async getFailedJobs(queueName) {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await this.queues[queueName].getFailed();
  }

  /**
   * Retry all failed jobs in a queue
   */
  async retryFailedJobs(queueName) {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const failed = await this.queues[queueName].getFailed();

    for (const job of failed) {
      await job.retry();
    }

    console.log(`🔄 Retried ${failed.length} failed jobs in ${queueName} queue`);
    return failed.length;
  }

  // ===== UTILITY METHODS =====

  /**
   * Clear all queues - for testing purposes
   */
  async clearQueues() {
    if (!this.isInitialized) {
      console.log('🧹 BullMQ not initialized, nothing to clear');
      return;
    }

    try {
      await Promise.all([
        this.queues.clickTracking.drain(),
        this.queues.email.drain(),
        this.queues.analytics.drain(),
        this.queues.metadata.drain(),
      ]);
      console.log('🧹 All BullMQ queues cleared');
    } catch (error) {
      console.error('❌ Error clearing queues:', error);
    }
  }

  /**
   * Pause all queues
   */
  async pauseQueues() {
    await Promise.all(Object.values(this.queues).map((queue) => queue.pause()));
    console.log('⏸️ All queues paused');
  }

  /**
   * Resume all queues
   */
  async resumeQueues() {
    await Promise.all(Object.values(this.queues).map((queue) => queue.resume()));
    console.log('▶️ All queues resumed');
  }

  /**
   * Get queue health status
   */
  async getHealthStatus() {
    const health = {
      isInitialized: this.isInitialized,
      redisConnected: false,
      queuesCount: Object.keys(this.queues).length,
      workersCount: Object.keys(this.workers).length,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.connection.ping();
      health.redisConnected = true;
    } catch (error) {
      health.redisConnected = false;
      health.error = error.message;
    }

    return health;
  }

  // ===== CLEANUP METHOD =====

  /**
   * Cleanup all resources
   */
  async cleanup() {
    console.log('🧹 Dọn dẹp BullMQ Service...');

    try {
      // Đóng tất cả event listeners
      for (const events of Object.values(this.events)) {
        await events.close();
      }

      // Đóng tất cả workers
      for (const worker of Object.values(this.workers)) {
        await worker.close();
      }

      // Đóng tất cả queues
      for (const queue of Object.values(this.queues)) {
        await queue.close();
      }

      // Đóng kết nối Redis
      if (this.connection) {
        await this.connection.quit();
      }

      // Reset state
      this.isInitialized = false;
      this.queues = {};
      this.workers = {};
      this.events = {};
      this.connection = null;

      console.log('✅ BullMQ cleanup hoàn tất');
    } catch (error) {
      console.error('❌ Lỗi cleanup:', error);
    }
  }
}

// Export singleton instance
module.exports = new BullMQService();
