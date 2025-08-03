const linkService = require('../services/LinkService');
const config = require('../../../config');

class LinkController {
  // POST /api/links - Create new shortlink
  async create(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const linkData = req.body;

      const link = await linkService.createLink(userId, linkData);

      // Use correct API URL for shortlink
      const apiUrl = config.app.apiUrl || process.env.API_URL || 'http://localhost:4000';
      
      res.status(201).json({
        success: true,
        message: 'Shortlink created successfully',
        data: {
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          shortUrl: `${apiUrl}/${link.shortCode}`,
          title: link.title,
          campaign: link.campaign,
          createdAt: link.createdAt
        }
      });
    } catch (error) {
      console.error('Create link error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to create shortlink'
      });
    }
  }

  // GET /api/links - List user's links
  async list(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        campaign: req.query.campaign,
        search: req.query.search
      };

      const result = await linkService.getUserLinks(userId, options);

      // Add shortUrl to each link
      const apiUrl = config.app.apiUrl || process.env.API_URL || 'http://localhost:4000';
      const links = result.links || result.rows || []; // Fallback to empty array if both are undefined
      
      const linksWithShortUrl = links.map(link => ({
        ...link.toJSON(),
        shortUrl: `${apiUrl}/${link.shortCode}`
      }));

      res.json({
        success: true,
        data: {
          links: linksWithShortUrl,
          pagination: result.pagination || {
            total: result.count || links.length,
            limit: options.limit,
            offset: options.offset,
            hasMore: (options.offset + options.limit) < (result.count || links.length)
          }
        }
      });
    } catch (error) {
      console.error('List links error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch links'
      });
    }
  }

  // GET /api/links/stats - Get user stats
  async stats(req, res) {
    try {
      const userId = req.user.id;

      const stats = await linkService.getUserStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve stats'
      });
    }
  }

  // GET /api/links/:id - Get single link
  async getById(req, res) {
    try {
      const linkId = req.params.id;
      const userId = req.user.id;

      // TODO: Add method to get link by ID with user verification
      res.json({
        success: true,
        message: 'Get link by ID endpoint',
        data: { linkId, userId }
      });
    } catch (error) {
      console.error('Get link error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get link'
      });
    }
  }

  // PUT /api/links/:id - Update link
  async update(req, res) {
    try {
      const linkId = req.params.id;
      const userId = req.user.id;
      const updateData = req.body;

      const updatedLink = await linkService.updateLink(linkId, userId, updateData);

      if (!updatedLink) {
        return res.status(404).json({
          success: false,
          message: 'Link not found or unauthorized'
        });
      }

      const apiUrl = config.app.apiUrl || process.env.API_URL || 'http://localhost:4000';

      res.json({
        success: true,
        message: 'Link updated successfully',
        data: {
          ...updatedLink.toJSON(),
          shortUrl: `${apiUrl}/${updatedLink.shortCode}`
        }
      });
    } catch (error) {
      console.error('Update link error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to update link'
      });
    }
  }

  // DELETE /api/links/:id - Delete link
  async delete(req, res) {
    try {
      const linkId = req.params.id;
      const userId = req.user.id;

      const deleted = await linkService.deleteLink(linkId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Link not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Link deleted successfully'
      });
    } catch (error) {
      console.error('Delete link error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to delete link'
      });
    }
  }

  // GET /api/links/:id/analytics - Get link analytics
  async analytics(req, res) {
    try {
      const linkId = req.params.id;
      const userId = req.user.id;

      const analytics = await linkService.getLinkAnalytics(linkId, userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to get analytics'
      });
    }
  }
}

module.exports = new LinkController();