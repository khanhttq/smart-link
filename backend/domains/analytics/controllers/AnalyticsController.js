// domains/analytics/controllers/AnalyticsController.js
const analyticsService = require('../services/AnalyticsService');
const clickTrackingService = require('../services/ClickTrackingService');

class AnalyticsController {
  // GET /api/analytics/dashboard
  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const timeRange = req.query.timeRange || '7d';

      const dashboardData = await analyticsService.getDashboardData(userId, timeRange);

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load dashboard data'
      });
    }
  }

  // GET /api/analytics/clicks
  async getClicks(req, res) {
    try {
      const userId = req.user.id;
      const searchParams = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        campaign: req.query.campaign,
        country: req.query.country,
        deviceType: req.query.deviceType,
        search: req.query.search,
        page: parseInt(req.query.page) || 1,
        size: parseInt(req.query.size) || 20
      };

      const result = await clickTrackingService.searchClicks(userId, searchParams);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get clicks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve clicks data'
      });
    }
  }

  // GET /api/analytics/realtime
  async getRealtime(req, res) {
    try {
      const userId = req.user.id;
      const minutes = parseInt(req.query.minutes) || 60;

      const realTimeData = await clickTrackingService.getRealTimeClicks(userId, minutes);

      res.json({
        success: true,
        data: realTimeData
      });
    } catch (error) {
      console.error('Real-time analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load real-time data'
      });
    }
  }

  // GET /api/analytics/export
  async exportData(req, res) {
    try {
      const userId = req.user.id;
      const options = {
        format: req.query.format || 'json',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        includeRawClicks: req.query.includeRawClicks === 'true'
      };

      const exportData = await analyticsService.exportAnalytics(userId, options);

      if (options.format === 'json') {
        res.json({
          success: true,
          data: exportData
        });
      } else {
        // TODO: Support CSV, Excel formats
        res.json({
          success: false,
          message: 'Format not supported yet'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export data'
      });
    }
  }

  // GET /api/analytics/top-links
  async getTopLinks(req, res) {
    try {
      const userId = req.user.id;
      const timeRange = req.query.timeRange || '7d';
      const limit = parseInt(req.query.limit) || 10;

      const topLinks = await analyticsService.getTopLinks(userId, timeRange, limit);

      res.json({
        success: true,
        data: topLinks
      });
    } catch (error) {
      console.error('Top links error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top links'
      });
    }
  }

  // GET /api/analytics/link/:linkId
  async getLinkAnalytics(req, res) {
    try {
      const { linkId } = req.params;
      const userId = req.user.id;
      const timeRange = req.query.timeRange || '30d';

      const linkAnalytics = await analyticsService.getLinkAnalytics(linkId, userId, timeRange);

      res.json({
        success: true,
        data: linkAnalytics
      });
    } catch (error) {
      console.error('Link analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get link analytics'
      });
    }
  }
}

module.exports = new AnalyticsController();