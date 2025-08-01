// domains/links/services/LinkService.js
const linkRepository = require('../repositories/LinkRepository');
const { generateShortCode } = require('../../../shared/utils/generators');
const { validateUrl } = require('../../../shared/utils/validators');

class LinkService {
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

  // Process click (redirect)
  async processClick(shortCode, clickData) {
    const link = await this.getLinkByShortCode(shortCode);
    
    if (!link || !link.isActive) {
      return null;
    }

    // Increment click count (async)
    setImmediate(async () => {
      await linkRepository.incrementClickCount(link.id);
      
      // TODO: Add to click tracking queue
      // queueService.addClickTracking(link.id, clickData);
    });

    return {
      originalUrl: link.originalUrl,
      linkId: link.id
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

  // Get link analytics
  async getLinkAnalytics(linkId, userId) {
    // TODO: Implement analytics from ElasticSearch
    return {
      linkId,
      clickCount: 0,
      recentClicks: [],
      topCountries: [],
      topDevices: []
    };
  }

  // Get user statistics
  async getUserStats(userId) {
    return await linkRepository.getStats(userId);
  }
}

module.exports = new LinkService();