// domains/links/controllers/RedirectController.js
const linkService = require('../services/LinkService');

class RedirectController {
  // GET /:shortCode - Handle redirect
  async handleRedirect(req, res) {
    try {
      const { shortCode } = req.params;
      
      // Collect click data
      const clickData = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        timestamp: new Date()
      };

      // Process click and get redirect URL
      const result = await linkService.processClick(shortCode, clickData);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Link not found or inactive',
          shortCode: shortCode
        });
      }

      // Log click for analytics
      console.log(`Click processed: ${shortCode} -> ${result.originalUrl}`);

      // Redirect to original URL
      res.redirect(302, result.originalUrl);

    } catch (error) {
      console.error('Redirect error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Redirect service temporarily unavailable'
      });
    }
  }

  // GET /api/preview/:shortCode - Preview link (no redirect)
  async preview(req, res) {
    try {
      const { shortCode } = req.params;
      
      const link = await linkService.getLinkByShortCode(shortCode);

      if (!link) {
        return res.status(404).json({
          success: false,
          message: 'Link not found'
        });
      }

      res.json({
        success: true,
        data: {
          shortCode: shortCode,
          originalUrl: link.originalUrl,
          title: link.title || 'Untitled',
          description: link.description || '',
          createdAt: link.createdAt,
          isActive: link.isActive
        }
      });

    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to preview link'
      });
    }
  }
}

module.exports = new RedirectController();