// backend/domains/links/services/LinkService.js - ElasticSearch Integration (FIXED)
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

  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Create new shortened link with optional custom domain
   */
  async createLink(userId, linkData) {
    try {
      await this.ensureInitialized();

      const { 
        originalUrl, 
        customCode, 
        title, 
        description, 
        campaign, 
        tags = [], 
        domainId = null,
        password = null,
        expiresAt = null,
        utmParameters = {},
        geoRestrictions = {}
      } = linkData;

      // Validate URL
      if (!this.isValidUrl(originalUrl)) {
        throw new Error('Invalid URL format');
      }

      // Generate short code
      let shortCode = customCode;
      if (!shortCode) {
        shortCode = await this.generateUniqueShortCode(domainId);
      } else {
        // Check if custom code is available
        const existing = await Link.findByShortCodeAndDomain(shortCode, domainId);
        if (existing) {
          throw new Error('Custom short code already exists');
        }
      }

      // Create link
      const link = await Link.create({
        userId,
        domainId,
        originalUrl,
        shortCode,
        customCode,
        title,
        description,
        campaign,
        tags,
        password: password ? await this.hashPassword(password) : null,
        expiresAt,
        utmParameters,
        geoRestrictions,
        isActive: true,
        clickCount: 0,
        uniqueClickCount: 0
      });

      // Fetch with associations
      const result = await Link.findByPk(link.id, {
        include: [{
          model: Domain,
          as: 'domain'
        }]
      });

      console.log(`✅ Link created: ${result.shortCode} -> ${originalUrl}`);
      return result;

    } catch (error) {
      console.error('❌ Create link error:', error);
      throw error;
    }
  }

  /**
   * Process click and track in both PostgreSQL and ElasticSearch
   */
  async processClick(shortCode, customDomain = null, clickData, userLocation = null) {
    try {
      await this.ensureInitialized();

      // Find link by shortCode and domain
      const link = await Link.findByShortCodeAndDomain(shortCode, customDomain);
      
      if (!link) {
        throw new Error('Link not found');
      }

      // Check if link is active and not expired
      if (!link.isActive) {
        throw new Error('Link is inactive');
      }

      if (link.expiresAt && new Date() > link.expiresAt) {
        throw new Error('Link has expired');
      }

      // Check password if required
      if (link.password && !clickData.password) {
        throw new Error('Password required');
      }

      if (link.password && clickData.password) {
        const isValidPassword = await this.verifyPassword(clickData.password, link.password);
        if (!isValidPassword) {
          throw new Error('Invalid password');
        }
      }

      // Check geo restrictions
      if (!link.isAccessibleFromLocation(userLocation)) {
        throw new Error('Access denied from this location');
      }

      // Check if this is a unique click (by IP)
      const isUnique = await this.isUniqueClick(link.id, clickData.ipAddress);

      // Create click record in PostgreSQL
      const postgresClick = await Click.create({
        linkId: link.id,
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referrer: clickData.referrer,
        country: userLocation?.country,
        city: userLocation?.city,
        deviceType: clickData.deviceType,
        browser: clickData.browser,
        os: clickData.os
      });

      // Update link statistics
      await this.updateLinkStats(link, isUnique);

      // Track in ElasticSearch (for analytics)
      try {
        // Queue for batch processing (more efficient)
        if (queueService && queueService.isInitialized) {
          await queueService.queueClickTracking(link.id, {
            ...clickData,
            linkId: link.id,
            shortCode: link.shortCode,
            domain: link.domain?.domain || 'system',
            ...userLocation
          });
        } else {
          // Direct tracking if queue not available
          await clickTrackingService.trackClick({
            linkId: link.id,
            shortCode: link.shortCode,
            domain: link.domain?.domain || 'system',
            ...clickData,
            ...userLocation
          });
        }
      } catch (esError) {
        console.warn('⚠️ ElasticSearch tracking failed, continuing with PostgreSQL:', esError.message);
      }

      console.log(`📊 Click tracked: ${link.shortCode} (PG: ${postgresClick.id}, ES: queued)`);

      // Return final URL
      return {
        originalUrl: link.buildFinalUrl(),
        title: link.title,
        clicks: link.clickCount + 1
      };

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
      const totalLinks = await Link.count({
        where: { userId, isActive: true }
      });

      const totalClicks = await Link.sum('clickCount', {
        where: { userId, isActive: true }
      }) || 0;

      const totalUniqueClicks = await Link.sum('uniqueClickCount', {
        where: { userId, isActive: true }
      }) || 0;

      // Get recent links
      const recentLinks = await Link.findAll({
        where: { userId, isActive: true },
        include: [{
          model: Domain,
          as: 'domain'
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      // Try to get enhanced analytics from ElasticSearch
      let enhancedAnalytics = null;
      try {
        if (clickTrackingService.isInitialized) {
          enhancedAnalytics = await clickTrackingService.getUserAnalytics(userId);
        }
      } catch (esError) {
        console.warn('⚠️ ElasticSearch user analytics failed:', esError.message);
      }

      return {
        totalLinks,
        totalClicks,
        totalUniqueClicks,
        clickThroughRate: totalLinks > 0 ? (totalClicks / totalLinks).toFixed(2) : 0,
        recentLinks: recentLinks.map(link => ({
          id: link.id,
          shortCode: link.shortCode,
          title: link.title,
          originalUrl: link.originalUrl,
          clickCount: link.clickCount,
          domain: link.domain?.domain || 'system',
          createdAt: link.createdAt
        })),
        enhancedAnalytics // May be null if ElasticSearch unavailable
      };

    } catch (error) {
      console.error('❌ Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Get user links with pagination and filtering
   */
  async getUserLinks(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        campaign = '',
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      const whereClause = { userId, isActive: true };

      // Search filter
      if (search) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { originalUrl: { [Op.iLike]: `%${search}%` } },
          { shortCode: { [Op.iLike]: `%${search}%` } }
        ];
      }

      // Campaign filter
      if (campaign) {
        whereClause.campaign = campaign;
      }

      const { count, rows } = await Link.findAndCountAll({
        where: whereClause,
        include: [{
          model: Domain,
          as: 'domain'
        }],
        order: [[sortBy, sortOrder]],
        limit,
        offset
      });

      return {
        links: rows,
        pagination: {
          current: page,
          pages: Math.ceil(count / limit),
          total: count,
          limit
        }
      };

    } catch (error) {
      console.error('❌ Get user links error:', error);
      throw error;
    }
  }

  /**
   * Update link
   */
  async updateLink(linkId, userId, updateData) {
    try {
      const link = await Link.findOne({
        where: { id: linkId, userId }
      });

      if (!link) {
        throw new Error('Link not found or unauthorized');
      }

      const allowedFields = ['title', 'description', 'campaign', 'tags', 'isActive', 'expiresAt'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      await link.update(filteredData);
      
      return await Link.findByPk(linkId, {
        include: [{
          model: Domain,
          as: 'domain'
        }]
      });

    } catch (error) {
      console.error('❌ Update link error:', error);
      throw error;
    }
  }

  /**
   * Delete link (soft delete)
   */
  async deleteLink(linkId, userId) {
    try {
      const link = await Link.findOne({
        where: { id: linkId, userId }
      });

      if (!link) {
        throw new Error('Link not found or unauthorized');
      }

      await link.update({ isActive: false });
      return { success: true };

    } catch (error) {
      console.error('❌ Delete link error:', error);
      throw error;
    }
  }

  /**
   * Get link by short code
   */
  async getLinkByShortCode(shortCode, domainName = null) {
    try {
      return await Link.findByShortCodeAndDomain(shortCode, domainName);
    } catch (error) {
      console.error('❌ Get link by short code error:', error);
      throw error;
    }
  }

  // Helper methods
  async generateUniqueShortCode(domainId = null, length = 6) {
    let shortCode;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = shortid.generate().substring(0, length);
      const existing = await Link.findByShortCodeAndDomain(shortCode, domainId);
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique short code');
    }

    return shortCode;
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  }

  async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }

  async isUniqueClick(linkId, ipAddress) {
    const existing = await Click.findOne({
      where: { linkId, ipAddress }
    });
    return !existing;
  }

  getDateRange(range) {
    const endDate = moment();
    let startDate;

    switch (range) {
      case '24h':
        startDate = moment().subtract(24, 'hours');
        break;
      case '7d':
        startDate = moment().subtract(7, 'days');
        break;
      case '30d':
        startDate = moment().subtract(30, 'days');
        break;
      case '90d':
        startDate = moment().subtract(90, 'days');
        break;
      default:
        startDate = moment().subtract(30, 'days');
    }

    return { startDate: startDate.toDate(), endDate: endDate.toDate() };
  }
}

module.exports = new LinkService();