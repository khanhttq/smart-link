// domains/links/services/LinkService.js
const linkRepository = require('../repositories/LinkRepository');
const { generateShortCode } = require('../../../shared/utils/generators');
const { validateUrl } = require('../../../shared/utils/validators');
const queueService = require('../../../core/queue/QueueService'); // ADDED

class LinkService {
  // Initialize service
  async initialize() {
    console.log('🔗 LinkService initializing...');
    // Initialize queue service
    await queueService.initialize();
    console.log('✅ LinkService initialized');
  }

  // Create new shortlink
  async createLink(userId, linkData) {
    const { originalUrl, customCode, title, description, campaign, tags, webhookUrl } = linkData;

    // Validate URL
    if (!validateUrl(originalUrl)) {
      throw new Error('Invalid URL format');
    }

    // Generate or use custom short code
    let shortCode = customCode;
    if (!shortCode) {
      shortCode = await this.generateUniqueShortCode();
    } else {
      // Check if custom code is available
      const existing = await linkRepository.findByShortCode(customCode);
      if (existing) {
        throw new Error('Custom code already exists');
      }
    }

    // Create link
    const link = await linkRepository.create({
      userId,
      originalUrl,
      shortCode,
      customCode,
      title,
      description,
      campaign,
      tags,
      webhookUrl,
      isActive: true,
      clickCount: 0
    });

    console.log(`🔗 Link created: ${shortCode} -> ${originalUrl}`);
    return link;
  }

  // Get link by short code
  async getLinkByShortCode(shortCode) {
    return await linkRepository.findByShortCode(shortCode);
  }

  // Get user's links
  async getUserLinks(userId, options = {}) {
    return await linkRepository.findByUserId(userId, options);
  }

  // Update link
  async updateLink(linkId, userId, updateData) {
    // Verify ownership
    const link = await linkRepository.findByShortCode(updateData.shortCode || '');
    if (link && link.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return await linkRepository.update(linkId, updateData);
  }

  // Delete link
  async deleteLink(linkId, userId) {
    // TODO: Add ownership verification
    return await linkRepository.delete(linkId);
  }

  // Process click (redirect) - UPDATED WITH TRACKING
  async processClick(shortCode, clickData) {
    const link = await this.getLinkByShortCode(shortCode);
    
    if (!link || !link.isActive) {
      return null;
    }

    // Increment click count in database (sync for immediate feedback)
    setImmediate(async () => {
      try {
        await linkRepository.incrementClickCount(link.id);
        console.log(`📊 Click count incremented for link: ${shortCode}`);
      } catch (error) {
        console.error('❌ Error incrementing click count:', error);
      }
    });

    // UPDATED: Add comprehensive click tracking to queue (async)
    const trackingData = {
      linkId: link.id,
      userId: link.userId,
      shortCode: link.shortCode,
      originalUrl: link.originalUrl,
      campaign: link.campaign,
      title: link.title,
      ...clickData, // Contains: ipAddress, userAgent, referrer, timestamp
      // Additional metadata
      clickedAt: new Date(),
      sessionId: this.generateSessionId(clickData.ipAddress, clickData.userAgent)
    };

    // Add to queue for async processing
    queueService.addClickTracking(link.id, trackingData);

    // ADDED: Trigger webhook if configured
    if (link.webhookUrl) {
      this.triggerWebhook(link.webhookUrl, {
        event: 'click',
        link: {
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl
        },
        click: {
          timestamp: trackingData.clickedAt,
          ipAddress: clickData.ipAddress,
          userAgent: clickData.userAgent,
          referrer: clickData.referrer
        }
      });
    }

    console.log(`🚀 Click processed: ${shortCode} -> ${link.originalUrl}`);

    return {
      originalUrl: link.originalUrl,
      linkId: link.id,
      shortCode: link.shortCode,
      campaign: link.campaign
    };
  }

  // Generate unique short code
  async generateUniqueShortCode(attempts = 0) {
    if (attempts > 10) {
      throw new Error('Failed to generate unique short code');
    }

    const shortCode = generateShortCode();
    const existing = await linkRepository.findByShortCode(shortCode);
    
    if (existing) {
      return await this.generateUniqueShortCode(attempts + 1);
    }
    
    return shortCode;
  }

  // UPDATED: Get link analytics from ElasticSearch
  async getLinkAnalytics(linkId, userId, timeRange = '30d') {
    try {
      const clickTrackingService = require('../../analytics/services/ClickTrackingService');
      
      // Get click statistics
      const clickStats = await clickTrackingService.getClickStats(userId, timeRange);
      
      // Get link-specific data
      const linkClicks = await clickTrackingService.searchClicks(userId, {
        linkId,
        startDate: this.getDateRange(timeRange).start,
        endDate: this.getDateRange(timeRange).end,
        page: 1,
        size: 1000
      });

      return {
        linkId,
        timeRange,
        overview: {
          totalClicks: linkClicks.total,
          uniqueClicks: this.countUniqueClicks(linkClicks.clicks),
          clickRate: this.calculateClickRate(linkClicks.clicks),
          lastClickAt: linkClicks.clicks.length > 0 ? linkClicks.clicks[0].timestamp : null
        },
        charts: {
          dailyClicks: this.aggregateClicksByDay(linkClicks.clicks),
          hourlyDistribution: this.aggregateClicksByHour(linkClicks.clicks)
        },
        demographics: {
          countries: this.aggregateByField(linkClicks.clicks, 'country'),
          devices: this.aggregateByField(linkClicks.clicks, 'deviceType'),
          browsers: this.aggregateByField(linkClicks.clicks, 'browser'),
          os: this.aggregateByField(linkClicks.clicks, 'os')
        },
        referrers: this.aggregateByField(linkClicks.clicks, 'referrer', 10),
        recentClicks: linkClicks.clicks.slice(0, 20)
      };
    } catch (error) {
      console.error('❌ Get link analytics error:', error);
      return {
        linkId,
        error: error.message,
        overview: { totalClicks: 0, uniqueClicks: 0, clickRate: 0 },
        charts: { dailyClicks: [], hourlyDistribution: [] },
        demographics: { countries: [], devices: [], browsers: [], os: [] },
        referrers: [],
        recentClicks: []
      };
    }
  }

  // Get user statistics
  async getUserStats(userId) {
    return await linkRepository.getStats(userId);
  }

  // UTILITY METHODS

  // Generate session ID for tracking
  generateSessionId(ipAddress, userAgent) {
    const crypto = require('crypto');
    const sessionString = `${ipAddress}_${userAgent}_${new Date().toDateString()}`;
    return crypto.createHash('md5').update(sessionString).digest('hex').substring(0, 16);
  }

  // Trigger webhook notification
  async triggerWebhook(webhookUrl, data) {
    try {
      const axios = require('axios');
      await axios.post(webhookUrl, data, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shortlink-System-Webhook/1.0'
        }
      });
      console.log(`🔔 Webhook triggered: ${webhookUrl}`);
    } catch (error) {
      console.error(`❌ Webhook failed ${webhookUrl}:`, error.message);
    }
  }

  // Get date range for analytics
  getDateRange(timeRange) {
    const now = new Date();
    const ranges = {
      '1d': { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now },
      '7d': { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: now },
      '30d': { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now },
      '90d': { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: now }
    };
    return ranges[timeRange] || ranges['30d'];
  }

  // Count unique clicks by IP
  countUniqueClicks(clicks) {
    const uniqueIPs = new Set(clicks.map(click => click.ipAddress));
    return uniqueIPs.size;
  }

  // Calculate click rate
  calculateClickRate(clicks) {
    if (clicks.length === 0) return 0;
    const uniqueClicks = this.countUniqueClicks(clicks);
    return ((uniqueClicks / clicks.length) * 100).toFixed(2);
  }

  // Aggregate clicks by day
  aggregateClicksByDay(clicks) {
    const dayMap = {};
    clicks.forEach(click => {
      const day = new Date(click.timestamp).toDateString();
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    
    return Object.entries(dayMap).map(([date, count]) => ({
      date,
      clicks: count
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // Aggregate clicks by hour
  aggregateClicksByHour(clicks) {
    const hourMap = {};
    clicks.forEach(click => {
      const hour = new Date(click.timestamp).getHours();
      hourMap[hour] = (hourMap[hour] || 0) + 1;
    });
    
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      clicks: hourMap[hour] || 0
    }));
  }

  // Aggregate by field
  aggregateByField(clicks, field, limit = 5) {
    const fieldMap = {};
    clicks.forEach(click => {
      const value = click[field] || 'Unknown';
      fieldMap[value] = (fieldMap[value] || 0) + 1;
    });
    
    return Object.entries(fieldMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }
}

module.exports = new LinkService();