// backend/domains/links/services/LinkService.js - UPDATED với Domain Support
const crypto = require('crypto');
const { Link, Domain, User, Click } = require('../../../models');
const { Op } = require('sequelize');
const { validateUrl } = require('../../../shared/utils/validators');
const { generateShortCode } = require('../../../shared/utils/generators');

class LinkService {
  
  /**
   * Initialize service
   */
  async initialize() {
    console.log('🔗 LinkService initializing with domain support...');
    console.log('✅ LinkService initialized');
  }

  /**
   * Create new shortlink with domain support
   */
  async createLink(userId, linkData) {
    const { 
      originalUrl, 
      customCode,
      domainId,     // ✅ NEW: Optional domain
      title, 
      description, 
      campaign, 
      tags, 
      webhookUrl,
      password,     // ✅ NEW: Optional password protection
      utmParameters, // ✅ NEW: UTM parameters
      geoRestrictions, // ✅ NEW: Geographic restrictions
      expiresAt
    } = linkData;

    // Validate URL
    if (!validateUrl(originalUrl)) {
      throw new Error('Invalid URL format');
    }
    
    let domain = null;
    
    // Validate domain ownership and limits if specified
    if (domainId) {
      domain = await Domain.findOne({
        where: { 
          id: domainId, 
          userId,
          isActive: true,
          isVerified: true 
        }
      });
      
      if (!domain) {
        throw new Error('Domain not found, not verified, or unauthorized');
      }
      
      // Check usage limits
      if (domain.isUsageLimitExceeded()) {
        throw new Error(`Monthly link limit exceeded for domain ${domain.domain}. Limit: ${domain.monthlyLinkLimit}`);
      }
    }

    // Generate or validate short code
    let shortCode = customCode;
    if (!shortCode) {
      shortCode = await this.generateUniqueShortCode(domainId);
    } else {
      // Validate custom code format
      if (!/^[a-zA-Z0-9_-]+$/.test(customCode)) {
        throw new Error('Custom code can only contain letters, numbers, hyphens, and underscores');
      }
      
      // Check uniqueness within domain scope
      const existing = await Link.findOne({
        where: { 
          shortCode: customCode,
          domainId: domainId || null
        }
      });
      
      if (existing) {
        const domainName = domain ? domain.domain : 'system domain';
        throw new Error(`Custom code "${customCode}" already exists for ${domainName}`);
      }
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
      hashedPassword = await this.hashPassword(password);
    }

    // Validate expiry date
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      throw new Error('Expiry date must be in the future');
    }

    // Create link
    const link = await Link.create({
      userId,
      domainId,
      originalUrl,
      shortCode,
      customCode,
      title: title || null,
      description: description || null,
      campaign: campaign || null,
      tags: tags || [],
      webhookUrl: webhookUrl || null,
      password: hashedPassword,
      utmParameters: utmParameters || {},
      geoRestrictions: geoRestrictions || {},
      expiresAt: expiresAt || null,
      isActive: true,
      clickCount: 0,
      uniqueClicks: 0
    });

    // Update domain usage if applicable
    if (domain) {
      await domain.incrementUsage(1);
    }

    // Load link with domain info for response
    const linkWithDomain = await Link.findByPk(link.id, {
      include: [{
        model: Domain,
        as: 'domain',
        attributes: ['id', 'domain', 'displayName', 'sslEnabled']
      }]
    });

    console.log(`🔗 Link created: ${linkWithDomain.fullShortUrl} -> ${originalUrl}`);
    return linkWithDomain;
  }

  /**
   * Get link by short code and domain
   */
  async getLinkByShortCode(shortCode, domainName = null) {
    return await Link.findByShortCodeAndDomain(shortCode, domainName);
  }

  /**
   * Get user's links with domain info
   */
  async getUserLinks(userId, options = {}) {
    const { 
      limit = 20, 
      offset = 0,
      campaign,
      search,
      domainId,
      includeInactive = true
    } = options;
    
    const whereClause = { userId };
    
    if (!includeInactive) {
      whereClause.isActive = true;
    }
    
    if (campaign) {
      whereClause.campaign = campaign;
    }
    
    if (domainId !== undefined) {
      whereClause.domainId = domainId; // Can be null for system domain
    }
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { shortCode: { [Op.iLike]: `%${search}%` } },
        { originalUrl: { [Op.iLike]: `%${search}%` } },
        { campaign: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Link.findAndCountAll({
      where: whereClause,
      include: [{
        model: Domain,
        as: 'domain',
        attributes: ['id', 'domain', 'displayName', 'sslEnabled'],
        required: false
      }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return {
      links: rows,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: (offset + limit) < count
      }
    };
  }

  /**
   * Update existing link
   */
  async updateLink(linkId, userId, updateData) {
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

    // Validate domain change if requested
    if (updateData.domainId !== undefined && updateData.domainId !== link.domainId) {
      if (updateData.domainId) {
        const newDomain = await Domain.findOne({
          where: { 
            id: updateData.domainId,
            userId,
            isActive: true,
            isVerified: true
          }
        });
        
        if (!newDomain) {
          throw new Error('Target domain not found or unauthorized');
        }
        
        // Check if shortCode conflicts in new domain
        const existing = await Link.findOne({
          where: {
            shortCode: link.shortCode,
            domainId: updateData.domainId,
            id: { [Op.ne]: linkId }
          }
        });
        
        if (existing) {
          throw new Error(`Short code "${link.shortCode}" already exists in target domain`);
        }
      }
    }

    // Validate custom code change
    if (updateData.customCode && updateData.customCode !== link.customCode) {
      if (!/^[a-zA-Z0-9_-]+$/.test(updateData.customCode)) {
        throw new Error('Custom code can only contain letters, numbers, hyphens, and underscores');
      }
      
      const existing = await Link.findOne({
        where: {
          shortCode: updateData.customCode,
          domainId: updateData.domainId || link.domainId,
          id: { [Op.ne]: linkId }
        }
      });
      
      if (existing) {
        throw new Error('Custom code already exists for this domain');
      }
      
      updateData.shortCode = updateData.customCode;
    }

    // Hash password if provided
    if (updateData.password) {
      updateData.password = await this.hashPassword(updateData.password);
    }

    // Validate expiry date
    if (updateData.expiresAt && new Date(updateData.expiresAt) <= new Date()) {
      throw new Error('Expiry date must be in the future');
    }

    await link.update(updateData);
    
    // Return updated link with domain info
    return await Link.findByPk(linkId, {
      include: [{
        model: Domain,
        as: 'domain',
        attributes: ['id', 'domain', 'displayName', 'sslEnabled']
      }]
    });
  }

  /**
   * Delete link
   */
  async deleteLink(linkId, userId) {
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

    // Soft delete
    await link.destroy();
    
    // Decrement domain usage if applicable
    if (link.domain) {
      await link.domain.increment('currentMonthUsage', { by: -1 });
    }

    return true;
  }

  /**
   * Process click with enhanced tracking
   */
  async processClick(shortCode, domainName, clickData, userLocation = null) {
    const link = await this.getLinkByShortCode(shortCode, domainName);
    
    if (!link) {
      return null;
    }

    // Check if link is accessible
    if (!link.canAccess(userLocation)) {
      return {
        blocked: true,
        reason: link.isExpired() ? 'expired' : 'geo_restricted'
      };
    }

    // Check password protection
    if (link.password && !clickData.passwordProvided) {
      return {
        passwordRequired: true,
        link: {
          id: link.id,
          title: link.title,
          domain: link.domain?.domain || 'system'
        }
      };
    }

    if (link.password && clickData.password) {
      const passwordValid = await this.verifyPassword(clickData.password, link.password);
      if (!passwordValid) {
        return {
          passwordRequired: true,
          error: 'Invalid password'
        };
      }
    }

    // Determine if this is a unique click (simple IP-based for now)
    const isUnique = !(await Click.findOne({
      where: {
        linkId: link.id,
        ipAddress: clickData.ipAddress
      },
      paranoid: false
    }));

    // Create click record
    await Click.create({
      linkId: link.id,
      ipAddress: clickData.ipAddress,
      userAgent: clickData.userAgent,
      referrer: clickData.referrer,
      country: userLocation?.country,
      city: userLocation?.city,
      deviceType: this.detectDeviceType(clickData.userAgent),
      browser: this.detectBrowser(clickData.userAgent),
      os: this.detectOS(clickData.userAgent),
      timestamp: new Date()
    });

    // Update link statistics
    await link.incrementClicks(isUnique);

    // Build final URL with UTM parameters
    const finalUrl = link.buildFinalUrl();

    // Trigger webhook if configured
    if (link.webhookUrl) {
      setImmediate(() => {
        this.triggerWebhook(link.webhookUrl, {
          event: 'click',
          link: {
            id: link.id,
            shortCode: link.shortCode,
            originalUrl: link.originalUrl
          },
          click: clickData,
          timestamp: new Date()
        });
      });
    }

    return {
      originalUrl: finalUrl,
      link: {
        id: link.id,
        title: link.title,
        shortCode: link.shortCode,
        domain: link.domain?.domain || 'system'
      }
    };
  }

  /**
   * Get link analytics
   */
  async getLinkAnalytics(linkId, userId, dateRange = '30d') {
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
    const endDate = new Date();
    const startDate = new Date();
    
    switch (dateRange) {
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

    // Get click data for the period
    const clicks = await Click.findAll({
      where: {
        linkId: link.id,
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'ASC']]
    });

    // Process analytics data
    const analytics = {
      link: {
        id: link.id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        title: link.title,
        domain: link.domain?.domain || 'system',
        fullShortUrl: link.fullShortUrl
      },
      period: {
        start: startDate,
        end: endDate,
        range: dateRange
      },
      totals: {
        clicks: clicks.length,
        uniqueClicks: link.uniqueClicks,
        totalClicks: link.clickCount
      },
      breakdown: this.processClickAnalytics(clicks)
    };

    return analytics;
  }

  /**
   * Get user statistics across all links
   */
  async getUserStats(userId) {
    const stats = await Link.findAll({
      where: { userId },
      attributes: [
        [Link.sequelize.fn('COUNT', Link.sequelize.col('id')), 'totalLinks'],
        [Link.sequelize.fn('SUM', Link.sequelize.col('click_count')), 'totalClicks'],
        [Link.sequelize.fn('AVG', Link.sequelize.col('click_count')), 'avgClicks'],
        [Link.sequelize.fn('COUNT', Link.sequelize.literal('CASE WHEN is_active = true THEN 1 END')), 'activeLinks']
      ],
      raw: true
    });

    const campaignStats = await Link.findAll({
      where: { 
        userId,
        campaign: { [Op.not]: null }
      },
      attributes: [
        [Link.sequelize.fn('COUNT', Link.sequelize.fn('DISTINCT', Link.sequelize.col('campaign'))), 'campaignCount']
      ],
      raw: true
    });

    return {
      totalLinks: parseInt(stats[0]?.totalLinks) || 0,
      totalClicks: parseInt(stats[0]?.totalClicks) || 0,
      avgClicks: parseFloat(stats[0]?.avgClicks) || 0,
      activeLinks: parseInt(stats[0]?.activeLinks) || 0,
      campaignLinks: parseInt(campaignStats[0]?.campaignCount) || 0
    };
  }

  // ===== HELPER METHODS =====

  /**
   * Generate unique short code within domain scope
   */
  async generateUniqueShortCode(domainId = null, length = 6) {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const shortCode = generateShortCode(length);
      
      const existing = await Link.findOne({
        where: {
          shortCode,
          domainId: domainId || null
        }
      });
      
      if (!existing) {
        return shortCode;
      }
      
      attempts++;
      if (attempts === 5) length++; // Increase length after 5 attempts
    }
    
    throw new Error('Unable to generate unique short code');
  }

  /**
   * Hash password for link protection
   */
  async hashPassword(password) {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 10);
  }

  /**
   * Verify password for protected link
   */
  async verifyPassword(password, hashedPassword) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Process click analytics data
   */
  processClickAnalytics(clicks) {
    const devices = {};
    const browsers = {};
    const countries = {};
    const dailyClicks = {};

    clicks.forEach(click => {
      // Device breakdown
      const device = click.deviceType || 'unknown';
      devices[device] = (devices[device] || 0) + 1;

      // Browser breakdown
      const browser = click.browser || 'unknown';
      browsers[browser] = (browsers[browser] || 0) + 1;

      // Country breakdown
      const country = click.country || 'unknown';
      countries[country] = (countries[country] || 0) + 1;

      // Daily clicks
      const date = click.timestamp.toISOString().split('T')[0];
      dailyClicks[date] = (dailyClicks[date] || 0) + 1;
    });

    return {
      devices: Object.entries(devices).map(([name, count]) => ({ name, count })),
      browsers: Object.entries(browsers).map(([name, count]) => ({ name, count })),
      countries: Object.entries(countries).map(([name, count]) => ({ name, count })),
      daily: Object.entries(dailyClicks).map(([date, count]) => ({ date, count }))
    };
  }

  /**
   * Device detection from user agent
   */
  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'bot';
    }
    return 'desktop';
  }

  /**
   * Browser detection from user agent
   */
  detectBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Other';
  }

  /**
   * OS detection from user agent
   */
  detectOS(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('mac')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
    return 'Other';
  }

  /**
   * Trigger webhook (fire and forget)
   */
  async triggerWebhook(webhookUrl, data) {
    try {
      const axios = require('axios');
      await axios.post(webhookUrl, data, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Shortlink-Webhook/1.0'
        }
      });
    } catch (error) {
      console.error('Webhook failed:', error.message);
    }
  }
}

module.exports = new LinkService();