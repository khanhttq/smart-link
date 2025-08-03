// backend/domains/analytics/controllers/AnalyticsController.js - SIMPLIFIED VERSION
const linkService = require('../../links/services/LinkService');

// Simple response helpers
const sendSuccessResponse = (res, message, data = null) => {
  return res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const sendErrorResponse = (res, statusCode, message, details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    details: process.env.NODE_ENV === 'development' ? details : null,
    timestamp: new Date().toISOString()
  });
};

class AnalyticsController {
  
  /**
   * GET /api/analytics/dashboard - Dashboard overview analytics
   */
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;

      // Get user stats from existing LinkService method
      const userStats = await linkService.getUserStats(userId);
      
      return sendSuccessResponse(res, 'Dashboard analytics retrieved', {
        overview: userStats,
        period: '30d'
      });

    } catch (error) {
      console.error('❌ Dashboard analytics error:', error);
      return sendErrorResponse(res, 500, 'Failed to retrieve dashboard analytics', error.message);
    }
  }

  /**
   * GET /api/analytics/links/:linkId - Detailed link analytics
   */
  async getLinkAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const linkId = req.params.linkId;
      const { period = '30d' } = req.query;

      // Get analytics from existing LinkService method
      const analytics = await linkService.getLinkAnalytics(linkId, userId, period);

      return sendSuccessResponse(res, 'Link analytics retrieved', analytics);

    } catch (error) {
      console.error('❌ Link analytics error:', error);
      
      if (error.message.includes('not found')) {
        return sendErrorResponse(res, 404, 'Link not found or unauthorized');
      }
      
      return sendErrorResponse(res, 500, 'Failed to retrieve link analytics', error.message);
    }
  }

  /**
   * GET /api/analytics/export/:linkId - Export analytics data
   */
  async exportAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const linkId = req.params.linkId;
      const { period = '30d', format = 'json' } = req.query;

      // Get detailed analytics
      const analytics = await linkService.getLinkAnalytics(linkId, userId, period);
      
      // Prepare export data
      const exportData = {
        link: analytics.link,
        summary: analytics.totals,
        dateRange: analytics.period,
        breakdown: analytics.breakdown,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email
      };

      if (format === 'csv') {
        // Simple CSV export
        const csvHeader = 'Metric,Value\n';
        const csvRows = [
          `Total Clicks,${analytics.totals?.clicks || 0}`,
          `Unique Clicks,${analytics.totals?.uniqueClicks || 0}`,
          `Link Title,${analytics.link?.title || 'N/A'}`,
          `Short Code,${analytics.link?.shortCode || 'N/A'}`,
          `Export Date,${exportData.exportedAt}`
        ].join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Disposition', 
          `attachment; filename="analytics-${analytics.link?.shortCode || 'data'}.csv"`);
        res.setHeader('Content-Type', 'text/csv');
        return res.send(csv);
      } else {
        // Default JSON export
        res.setHeader('Content-Disposition', 
          `attachment; filename="analytics-${analytics.link?.shortCode}-${period}.json"`);
        res.setHeader('Content-Type', 'application/json');
        return res.json(exportData);
      }

    } catch (error) {
      console.error('❌ Export analytics error:', error);
      return sendErrorResponse(res, 500, 'Failed to export analytics', error.message);
    }
  }

  /**
   * GET /api/analytics/real-time/:linkId - Real-time analytics
   */
  async getRealTimeAnalytics(req, res) {
    try {
      const userId = req.user.id;
      const linkId = req.params.linkId;
      const { minutes = 60 } = req.query;

      // Verify user owns the link
      const analytics = await linkService.getLinkAnalytics(linkId, userId, '1d');
      
      // For now, return basic real-time data
      // TODO: Implement ElasticSearch real-time data when ES is ready
      return sendSuccessResponse(res, 'Real-time analytics retrieved', {
        link: analytics.link,
        timeRange: `${minutes} minutes`,
        recentClicks: [], // TODO: Add real-time clicks
        clicksPerMinute: [], // TODO: Add minute-by-minute data
        summary: {
          totalClicksInPeriod: 0,
          uniqueIPs: 0
        }
      });

    } catch (error) {
      console.error('❌ Real-time analytics error:', error);
      return sendErrorResponse(res, 500, 'Failed to retrieve real-time analytics', error.message);
    }
  }

  /**
   * GET /api/analytics/trends - Analytics trends and insights
   */
  async getTrends(req, res) {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;

      // Get current stats
      const currentStats = await linkService.getUserStats(userId);
      
      // For now, return basic trends without complex period comparison
      return sendSuccessResponse(res, 'Analytics trends retrieved', {
        current: currentStats,
        trends: {
          clicksChange: '0.0', // TODO: Implement period comparison
          direction: { clicks: 'stable' }
        },
        period
      });

    } catch (error) {
      console.error('❌ Trends analytics error:', error);
      return sendErrorResponse(res, 500, 'Failed to retrieve analytics trends', error.message);
    }
  }
}

module.exports = new AnalyticsController();