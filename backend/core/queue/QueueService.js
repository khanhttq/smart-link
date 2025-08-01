// core/queue/QueueService.js
const clickTrackingService = require('../../domains/analytics/services/ClickTrackingService');

class QueueService {
  constructor() {
    this.queues = {
      clickTracking: [],
      emailNotifications: [],
      analytics: []
    };
    this.processing = false;
    this.batchSize = 10;
    this.processInterval = 5000; // 5 seconds
  }

  async initialize() {
    console.log('📋 Queue Service initializing...');
    
    // Initialize click tracking service
    await clickTrackingService.initialize();
    
    // Start processing queues
    this.startProcessing();
    
    console.log('✅ Queue Service initialized');
  }

  // Add click tracking job to queue
  addClickTracking(linkId, clickData) {
    const job = {
      id: `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      linkId,
      clickData: {
        ...clickData,
        timestamp: new Date(),
        queuedAt: new Date()
      },
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date()
    };

    this.queues.clickTracking.push(job);
    console.log(`📊 Click tracking queued: ${linkId} (Queue size: ${this.queues.clickTracking.length})`);
    
    return job.id;
  }

  // Add email notification job
  addEmailNotification(emailData) {
    const job = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      emailData,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date()
    };

    this.queues.emailNotifications.push(job);
    console.log(`📧 Email notification queued: ${emailData.to} (Queue size: ${this.queues.emailNotifications.length})`);
    
    return job.id;
  }

  // Add analytics processing job
  addAnalyticsProcessing(userId, type, data) {
    const job = {
      id: `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      data,
      attempts: 0,
      maxAttempts: 2,
      createdAt: new Date()
    };

    this.queues.analytics.push(job);
    console.log(`📈 Analytics processing queued: ${type} for user ${userId}`);
    
    return job.id;
  }

  // Start processing queues
  startProcessing() {
    setInterval(async () => {
      if (!this.processing) {
        this.processing = true;
        await this.processQueues();
        this.processing = false;
      }
    }, this.processInterval);
  }

  // Process all queues
  async processQueues() {
    try {
      // Process click tracking queue
      await this.processClickTrackingQueue();
      
      // Process email notifications queue
      await this.processEmailQueue();
      
      // Process analytics queue
      await this.processAnalyticsQueue();
      
    } catch (error) {
      console.error('❌ Queue processing error:', error.message);
    }
  }

  // Process click tracking queue in batches
  async processClickTrackingQueue() {
    const queue = this.queues.clickTracking;
    if (queue.length === 0) return;

    const batch = queue.splice(0, this.batchSize);
    console.log(`🔄 Processing ${batch.length} click tracking jobs...`);

    // Group jobs for batch processing
    const clickData = batch.map(job => ({
      linkId: job.linkId,
      userId: job.clickData.userId,
      shortCode: job.clickData.shortCode,
      originalUrl: job.clickData.originalUrl,
      campaign: job.clickData.campaign,
      timestamp: job.clickData.timestamp,
      ipAddress: job.clickData.ipAddress,
      userAgent: job.clickData.userAgent,
      referrer: job.clickData.referrer,
      country: job.clickData.country || 'Unknown',
      city: job.clickData.city || 'Unknown',
      deviceType: this.detectDeviceType(job.clickData.userAgent),
      browser: this.detectBrowser(job.clickData.userAgent),
      os: this.detectOS(job.clickData.userAgent)
    }));

    try {
      // Batch insert to ElasticSearch
      const result = await clickTrackingService.trackClicksBatch(clickData);
      console.log(`✅ Successfully tracked ${result} clicks`);
    } catch (error) {
      console.error('❌ Click tracking batch error:', error.message);
      
      // Re-queue failed jobs (with retry logic)
      batch.forEach(job => {
        job.attempts++;
        if (job.attempts < job.maxAttempts) {
          this.queues.clickTracking.push(job);
          console.log(`🔄 Re-queued click tracking job ${job.id} (attempt ${job.attempts})`);
        } else {
          console.error(`❌ Max attempts reached for click tracking job ${job.id}`);
        }
      });
    }
  }

  // Process email notifications queue
  async processEmailQueue() {
    const queue = this.queues.emailNotifications;
    if (queue.length === 0) return;

    const jobs = queue.splice(0, 5); // Process 5 emails at a time
    console.log(`📧 Processing ${jobs.length} email jobs...`);

    for (const job of jobs) {
      try {
        // TODO: Implement email service
        console.log(`📧 Email sent to ${job.emailData.to}: ${job.emailData.subject}`);
      } catch (error) {
        console.error(`❌ Email job ${job.id} failed:`, error.message);
        
        // Re-queue with retry logic
        job.attempts++;
        if (job.attempts < job.maxAttempts) {
          this.queues.emailNotifications.push(job);
        }
      }
    }
  }

  // Process analytics queue
  async processAnalyticsQueue() {
    const queue = this.queues.analytics;
    if (queue.length === 0) return;

    const jobs = queue.splice(0, 10);
    console.log(`📈 Processing ${jobs.length} analytics jobs...`);

    for (const job of jobs) {
      try {
        // TODO: Implement analytics aggregation
        console.log(`📈 Analytics processed: ${job.type} for user ${job.userId}`);
      } catch (error) {
        console.error(`❌ Analytics job ${job.id} failed:`, error.message);
        
        // Re-queue with retry logic
        job.attempts++;
        if (job.attempts < job.maxAttempts) {
          this.queues.analytics.push(job);
        }
      }
    }
  }

  // Utility: Detect device type from User-Agent
  detectDeviceType(userAgent) {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'Mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'Tablet';
    } else {
      return 'Desktop';
    }
  }

  // Utility: Detect browser from User-Agent
  detectBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    
    return 'Other';
  }

  // Utility: Detect OS from User-Agent
  detectOS(userAgent) {
    if (!userAgent) return 'Unknown';
    
    const ua = userAgent.toLowerCase();
    
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    
    return 'Other';
  }

  // Get queue statistics
  getStats() {
    return {
      clickTracking: {
        pending: this.queues.clickTracking.length,
        processing: this.processing
      },
      emailNotifications: {
        pending: this.queues.emailNotifications.length
      },
      analytics: {
        pending: this.queues.analytics.length
      },
      batchSize: this.batchSize,
      processInterval: this.processInterval
    };
  }

  // Clear all queues (for testing)
  clearQueues() {
    this.queues.clickTracking = [];
    this.queues.emailNotifications = [];
    this.queues.analytics = [];
    console.log('🧹 All queues cleared');
  }
}

module.exports = new QueueService();