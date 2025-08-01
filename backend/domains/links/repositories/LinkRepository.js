// domains/links/repositories/LinkRepository.js
const { Link, User, sequelize } = require('../../../models');
const { Op } = require('sequelize');
const cacheService = require('../../../core/cache/CacheService');

class LinkRepository {
  // Create new link
  async create(linkData) {
    const link = await Link.create(linkData);
    
    // Cache the link for fast redirects
    await cacheService.setLinkCache(link.shortCode, {
      id: link.id,
      originalUrl: link.originalUrl,
      userId: link.userId,
      isActive: link.isActive
    });
    
    return link;
  }

  // Find link by short code (with cache)
  async findByShortCode(shortCode) {
    // Try cache first
    const cached = await cacheService.getLinkByShortCode(shortCode);
    if (cached) {
      return cached;
    }

    // If not cached, get from DB
    const link = await Link.findOne({
      where: { shortCode, isActive: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'name']
      }]
    });

    if (link) {
      // Cache for future requests
      await cacheService.setLinkCache(shortCode, {
        id: link.id,
        originalUrl: link.originalUrl,
        userId: link.userId,
        isActive: link.isActive
      });
    }

    return link;
  }

  // Find links by user
  async findByUserId(userId, options = {}) {
    const { limit = 20, offset = 0, campaign, search } = options;
    
    const where = { userId };
    
    if (campaign) {
      where.campaign = campaign;
    }
    
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { originalUrl: { [Op.iLike]: `%${search}%` } }
      ];
    }

    return await Link.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'name']
      }]
    });
  }

  // Update link
  async update(id, updateData) {
    const [updatedRowsCount, [updatedLink]] = await Link.update(updateData, {
      where: { id },
      returning: true
    });

    if (updatedLink) {
      // Update cache
      await cacheService.setLinkCache(updatedLink.shortCode, {
        id: updatedLink.id,
        originalUrl: updatedLink.originalUrl,
        userId: updatedLink.userId,
        isActive: updatedLink.isActive
      });
    }

    return updatedLink;
  }

  // Delete link
  async delete(id) {
    const link = await Link.findByPk(id);
    if (link) {
      // Remove from cache
      await cacheService.deleteLinkCache(link.shortCode);
      
      // Soft delete or hard delete
      await link.destroy();
    }
    
    return !!link;
  }

  // Increment click count
  async incrementClickCount(id) {
    return await Link.increment('clickCount', {
      where: { id }
    });
  }

  // Get link statistics
  async getStats(userId) {
    const cacheKey = `user:${userId}:stats`;
    
    return await cacheService.getOrSet(cacheKey, async () => {
      const stats = await Link.findAll({
        where: { userId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalLinks'],
          [sequelize.fn('SUM', sequelize.col('click_count')), 'totalClicks'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_active = true THEN 1 END')), 'activeLinks'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN campaign IS NOT NULL THEN 1 END')), 'campaignLinks']
        ],
        raw: true
      });
      
      return stats[0] || {
        totalLinks: 0,
        totalClicks: 0,
        activeLinks: 0,
        campaignLinks: 0
      };
    }, 300); // Cache for 5 minutes
  }
}

module.exports = new LinkRepository();