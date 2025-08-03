// backend/domains/links/services/LinkService.js - ElasticSearch Integration
const { Link, Domain, Click, sequelize } = require('../../../models');
const { Op } = require('sequelize');
const moment = require('moment');
const crypto = require('crypto');
const axios = require('axios');

// Import ElasticSearch services
const clickTrackingService = require('../../analytics/services/ClickTrackingService');
const queueService = require('../../../core/queue/QueueService');
const { Link, Domain, Click, sequelize } = require('../../../models');
const { Op } = require('sequelize');
const moment = require('moment');
const shortid = require('shortid');
const crypto = require('crypto');
const axios = require('axios');

// Import ElasticSearch services
const clickTrackingService = require('../../analytics/services/ClickTrackingService');
const queueService = require('../../../core/queue/QueueService');

class LinkService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Initialize ElasticSearch connection
      await clickTrackingService.initialize();
      console.log('✅ LinkService: ElasticSearch tracking initialized');
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('⚠️ LinkService: ElasticSearch not available, using PostgreSQL only');
      this.isInitialized = true;
    }
  }

  /**
   * Process click and track in both PostgreSQL and ElasticSearch
   */
  async processClick(shortCode, customDomain = null, clickData, userLocation = null) {
    try {
      await this.ensureInitialized();

      // Find link by shortCode and domain
      const whereClause = { shortCode };
      
      let link;
      if (customDomain) {
        // Custom domain - must match exactly
        link = await Link.findOne({
          where: whereClause,
          include: [{
            model: Domain,
            as: 'domain',
            where: { domain: customDomain, isVerified: true },
            required: true
          }]
        });
      } else {
        // System domain - no domain association or default domain
        link = await Link.findOne({
          where: whereClause,
          include: [{
            model: Domain,
            as: 'domain',
            required: false
          }]
        });
      }

      if (!link) {
        console.log(`❌ Link not found: ${customDomain || 'system'}/${shortCode}`);
        return null;
      }

      // Check if link is active
      if (!link.isActive) {
        console.log(`⛔ Link inactive: ${shortCode}`);
        return { blocked: true, reason: 'Link is inactive' };
      }

      // Check expiration
      if (link.expiresAt && new Date() > link.expiresAt) {
        console.log(`⏰ Link expired: ${shortCode}`);
        return { blocked: true, reason: 'Link has expired' };
      }

      // Check password protection
      if (link.password) {
        return { passwordRequired: true, linkId: link.id };
      }

      // Enhanced click data for tracking
      const enhancedClickData = {
        linkId: link.id,
        userId: link.userId,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        campaign: link.campaign,
        domain: customDomain || 'system',
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referrer: clickData.referrer,
        country: userLocation?.country || 'Unknown',
        city: userLocation?.city || 'Unknown',
        deviceType: this.detectDeviceType(clickData.userAgent),
        browser: this.detectBrowser(clickData.userAgent),
        os: this.detectOS(clickData.userAgent),
        timestamp: clickData.timestamp || new Date()
      };

      // Track click in multiple places
      await this.trackClick(link, enhancedClickData, userLocation);

      // Build final URL with UTM parameters
      const finalUrl = this.buildFinalUrl(link);

      // Trigger webhook if configured (async)
      if (link.webhookUrl) {
        setImmediate(() => {
          this.triggerWebhook(link.webhookUrl, {
            event: 'click',
            link: {
              id: link.id,
              shortCode: link.shortCode,
              originalUrl: link.originalUrl,
              domain: customDomain || 'system'
            },
            click: enhancedClickData,
            timestamp: new Date()
          });
        });
      }

      console.log(`✅ Click processed: ${customDomain || 'system'}/${shortCode} -> ${finalUrl}`);

      return {
        originalUrl: finalUrl,
        link: {
          id: link.id,
          title: link.title,
          shortCode: link.shortCode,
          domain: customDomain || 'system'
        }
      };

    } catch (error) {
      console.error('❌ ProcessClick error:', error);
      return null;
    }
  }

  /**
   * Track click in both PostgreSQL and ElasticSearch
   */
  async trackClick(link, clickData, userLocation) {
    try {
      // 1. PostgreSQL tracking (for data consistency)
      const isUnique = !(await Click.findOne({
        where: {
          linkId: link.id,
          ipAddress: clickData.ipAddress
        },
        paranoid: false
      }));

      // Create click record in PostgreSQL
      const postgresClick = await Click.create({
        linkId: link.id,
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referrer: clickData.referrer,
        country: clickData.country,
        city: clickData.city,
        deviceType: clickData.deviceType,
        browser: clickData.browser,
        os: clickData.os,
        timestamp: clickData.timestamp
      });

      // Update link statistics in PostgreSQL
      await this.updateLinkStats(link, isUnique);

      // 2. ElasticSearch tracking (for analytics)
      try {
        // Queue for batch processing (more efficient)
        if (queueService && queueService.isInitialized) {
          await queueService.queueClickTracking(clickData.linkId, clickData);
        } else {
          // Direct tracking if queue not available
          await clickTrackingService.trackClick(clickData);
        }
      } catch (esError) {
        console.warn('⚠️ ElasticSearch tracking failed, continuing with PostgreSQL:', esError.message);
      }

      console.log(`📊 Click tracked: ${clickData.shortCode} (PG: ${postgresClick.id}, ES: queued)`);

    } catch (error) {
      console.error('❌ Click tracking error:', error);
      throw error;
    }
  }

  /**
   * Update link statistics in PostgreSQL
   */
  async updateLinkStats(link, isUnique) {
    const updateData = {
      clickCount: link.clickCount + 1,
      lastClickAt: new Date()
    };

    if (isUnique) {
      updateData.uniqueClickCount = (link.uniqueClickCount || 0) + 1;
    }

    await link.update(updateData);
  }

  /**
   * Get link analytics from ElasticSearch (with PostgreSQL fallback)
   */
  async getLinkAnalytics(linkId, userId, dateRange = '30d') {
    try {
      await this.ensureInitialized();

      // Get link from PostgreSQL
      const link = await Link.findOne({
        where: { 
          id: linkId,
          userId 
        },
        include: [{
          model: Domain,
          as: 'domain'
        }]
      });
      
      if (!link) {
        throw new Error('Link not found or unauthorized');
      }

      // Calculate date range
      const { startDate, endDate } = this.getDateRange(dateRange);

      let analytics = null;

      try {
        // Try to get analytics from ElasticSearch
        analytics = await clickTrackingService.getClickStats(
          linkId, 
          startDate.toISOString(), 
          endDate.toISOString()
        );

        console.log(`📊 Analytics from ElasticSearch: ${analytics.totalClicks} clicks`);

      } catch (esError) {
        console.warn('⚠️ ElasticSearch analytics failed, falling back to PostgreSQL:', esError.message);
        
        // Fallback to PostgreSQL analytics
        analytics = await this.getPostgreSQLAnalytics(linkId, startDate, endDate);
      }

      // Combine with link metadata
      return {
        link: {
          id: link.id,
          title: link.title,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          domain: link.domain?.domain || 'system',
          createdAt: link.createdAt,
          campaign: link.campaign
        },
        dateRange: {
          start: startDate,
          end: endDate,
          period: dateRange
        },
        ...analytics
      };

    } catch (error) {
      console.error('❌ Get analytics error:', error);
      throw error;
    }
  }

  /**
   * Fallback PostgreSQL analytics
   */
  async getPostgreSQLAnalytics(linkId, startDate, endDate) {
    try {
      const whereClause = {
        linkId,
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      };

      // Basic stats
      const totalClicks = await Click.count({ where: whereClause });
      const uniqueClicks = await Click.count({ 
        where: whereClause,
        distinct: true,
        col: 'ipAddress'
      });

      // Daily breakdown
      const dailyClicks = await Click.findAll({
        where: whereClause,
        attributes: [
          [sequelize.fn('DATE', sequelize.col('timestamp')), 'date'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'clicks']
        ],
        group: [sequelize.fn('DATE', sequelize.col('timestamp'))],
        order: [[sequelize.fn('DATE', sequelize.col('timestamp')), 'ASC']]
      });

      // Top countries
      const topCountries = await Click.findAll({
        where: whereClause,
        attributes: [
          'country',
          [sequelize.fn('COUNT', sequelize.col('id')), 'clicks']
        ],
        group: ['country'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 10
      });

      // Top devices
      const topDevices = await Click.findAll({
        where: whereClause,
        attributes: [
          'deviceType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'clicks']
        ],
        group: ['deviceType'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 10
      });

      // Top browsers
      const topBrowsers = await Click.findAll({
        where: whereClause,
        attributes: [
          'browser',
          [sequelize.fn('COUNT', sequelize.col('id')), 'clicks']
        ],
        group: ['browser'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 10
      });

      return {
        totalClicks,
        uniqueClicks,
        dailyClicks: dailyClicks.map(item => ({
          date: item.dataValues.date,
          clicks: parseInt(item.dataValues.clicks)
        })),
        topCountries: topCountries.map(item => ({
          country: item.dataValues.country || 'Unknown',
          clicks: parseInt(item.dataValues.clicks)
        })),
        topDevices: topDevices.map(item => ({
          device: item.dataValues.deviceType || 'Unknown',
          clicks: parseInt(item.dataValues.clicks)
        })),
        topBrowsers: topBrowsers.map(item => ({
          browser: item.dataValues.browser || 'Unknown',
          clicks: parseInt(item.dataValues.clicks)
        }))
      };

    } catch (error) {
      console.error('❌ PostgreSQL analytics error:', error);
      return {
        totalClicks: 0,
        uniqueClicks: 0,
        dailyClicks: [],
        topCountries: [],
        topDevices: [],
        topBrowsers: []
      };
    }
  }

  /**
   * Get user stats with ElasticSearch integration
   */
  async getUserStats(userId) {
    try {
      await this.ensureInitialized();

      // Get basic stats from PostgreSQL
      const totalLinks = await Link.count({ where: { userId } });
      const activeLinks = await Link.count({ 
        where: { 
          userId, 
          isActive: true 
        } 
      });

      let totalClicks = 0;
      let clicksToday = 0;

      try {
        // Try to get click stats from ElasticSearch
        const today = moment().startOf('day');
        const esStats = await clickTrackingService.getClickStats(
          null, // All links for user
          null, // No start date (all time)
          null, // No end date
          { userId }
        );

        totalClicks = esStats.totalClicks || 0;

        // Get today's clicks
        const todayStats = await clickTrackingService.getClickStats(
          null,
          today.toISOString(),
          moment().endOf('day').toISOString(),
          { userId }
        );

        clicksToday = todayStats.totalClicks || 0;

      } catch (esError) {
        console.warn('⚠️ ElasticSearch stats failed, using PostgreSQL:', esError.message);
        
        // Fallback to PostgreSQL - using aggregate query
        const [clickStats] = await sequelize.query(`
          SELECT 
            COALESCE(SUM(l.click_count), 0) as total_clicks,
            COALESCE(COUNT(c.id), 0) as clicks_today
          FROM links l
          LEFT JOIN clicks c ON l.id = c.link_id 
            AND c.timestamp >= :today
          WHERE l.user_id = :userId
        `, {
          replacements: { 
            userId, 
            today: moment().startOf('day').toDate() 
          },
          type: sequelize.QueryTypes.SELECT
        });

        totalClicks = parseInt(clickStats?.total_clicks || 0);
        clicksToday = parseInt(clickStats?.clicks_today || 0);
      }

      return {
        totalLinks,
        activeLinks,
        totalClicks,
        clicksToday,
        avgClicks: totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0
      };

    } catch (error) {
      console.error('❌ Get user stats error:', error);
      throw error;
    }
  }

  // Helper methods
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  getDateRange(period) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    return { startDate, endDate };
  }

  buildFinalUrl(link) {
    try {
      const url = new URL(link.originalUrl);
      
      // Add UTM parameters if campaign is set
      if (link.campaign) {
        url.searchParams.set('utm_campaign', link.campaign);
        url.searchParams.set('utm_source', 'shortlink');
        url.searchParams.set('utm_medium', 'redirect');
      }
      
      return url.toString();
    } catch (error) {
      console.warn('Invalid URL for UTM parameters:', link.originalUrl);
      return link.originalUrl;
    }
  }

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

  async triggerWebhook(webhookUrl, data) {
    try {
      await axios.post(webhookUrl, data, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shortlink-Webhook/1.0'
        }
      });
      
      console.log(`🔔 Webhook triggered: ${webhookUrl}`);
    } catch (error) {
      console.error('❌ Webhook error:', error.message);
    }
  }

  // ... other existing methods (create, update, delete, etc.)
}

module.exports = new LinkService();