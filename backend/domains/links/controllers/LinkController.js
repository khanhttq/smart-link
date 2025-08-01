// domains/links/controllers/LinkController.js
const linkService = require('../services/LinkService');

class LinkController {
  // POST /api/links - Create new shortlink
  async create(req, res) {
    try {
      const userId = req.user?.id; // From auth middleware (will add later)
      const linkData = req.body;

      // For now, use a dummy user ID for testing
      const testUserId = req.body.userId || 'test-user-id';

      const link = await linkService.createLink(testUserId, linkData);

      res.status(201).json({
        success: true,
        message: 'Shortlink created successfully',
        data: {
          id: link.id,
          shortCode: link.shortCode,
          originalUrl: link.originalUrl,
          shortUrl: `${process.env.API_URL || 'http://localhost:4000'}/${link.shortCode}`,
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
      const userId = req.user?.id || req.query.userId || 'test-user-id';
      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        campaign: req.query.campaign,
        search: req.query.search
      };

      const result = await linkService.getUserLinks(userId, options);

      res.json({
        success: true,
        data: {
          links: result.rows,
          pagination: {
            total: result.count,
            limit: options.limit,
            offset: options.offset,
            hasMore: (options.offset + options.limit) < result.count
          }
        }
      });
    } catch (error) {
      console.error('List links error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve links'
      });
    }
  }

  // GET /api/links/:id - Get single link
  async get(req, res) {
    try {
      const { id } = req.params;
      const link = await linkService.getLinkByShortCode(id); // Assume id is shortCode for now

      if (!link) {
        return res.status(404).json({
          success: false,
          message: 'Link not found'
        });
      }

      res.json({
        success: true,
        data: link
      });
    } catch (error) {
      console.error('Get link error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve link'
      });
    }
  }

  // PUT /api/links/:id - Update link
  async update(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.body.userId || 'test-user-id';
      const updateData = req.body;

      const updatedLink = await linkService.updateLink(id, userId, updateData);

      if (!updatedLink) {
        return res.status(404).json({
          success: false,
          message: 'Link not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Link updated successfully',
        data: updatedLink
      });
    } catch (error) {
      console.error('Update link error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: 'Failed to update link'
      });
    }
  }

  // DELETE /api/links/:id - Delete link
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.body.userId || 'test-user-id';

      const deleted = await linkService.deleteLink(id, userId);

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
      const { id } = req.params;
      const userId = req.user?.id || req.query.userId || 'test-user-id';

      const analytics = await linkService.getLinkAnalytics(id, userId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to retrieve analytics'
      });
    }
  }

  // GET /api/links/stats - Get user stats
  async stats(req, res) {
    try {
      const userId = req.user?.id || req.query.userId || 'test-user-id';

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
}

module.exports = new LinkController();