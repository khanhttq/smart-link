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

/**
 * GET /api/analytics/dashboard - Dashboard overview analytics
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const userStats = await linkService.getUserStats(userId);

    return sendSuccessResponse(res, 'Dashboard analytics retrieved', {
      overview: userStats,
      period: '30d'
    });

  } catch (error) {
    console.error('❌ Dashboard analytics error:', error);
    return sendErrorResponse(res, 500, 'Failed to retrieve dashboard analytics', error.message);
  }
};

/**
 * GET /api/analytics/links/:linkId - Detailed link analytics
 */
exports.getLinkAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const linkId = req.params.linkId;
    const { period = '30d' } = req.query;

    const analytics = await linkService.getLinkAnalytics(linkId, userId, period);

    return sendSuccessResponse(res, 'Link analytics retrieved', analytics);

  } catch (error) {
    console.error('❌ Link analytics error:', error);

    if (error.message.includes('not found')) {
      return sendErrorResponse(res, 404, 'Link not found or unauthorized');
    }

    return sendErrorResponse(res, 500, 'Failed to retrieve link analytics', error.message);
  }
};

/**
 * GET /api/analytics/export/:linkId - Export analytics data
 */
exports.exportAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const linkId = req.params.linkId;
    const { period = '30d', format = 'json' } = req.query;

    const analytics = await linkService.getLinkAnalytics(linkId, userId, period);

    const exportData = {
      link: analytics.link,
      summary: analytics.totals,
      dateRange: analytics.period,
      breakdown: analytics.breakdown,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.email
    };

    if (format === 'csv') {
      const csvHeader = 'Metric,Value\n';
      const csvRows = [
        `Total Clicks,${analytics.totals?.clicks || 0}`,
        `Unique Clicks,${analytics.totals?.uniqueClicks || 0}`,
        `Link Title,${analytics.link?.title || 'N/A'}`,
        `Short Code,${analytics.link?.shortCode || 'N/A'}`,
        `Export Date,${exportData.exportedAt}`
      ].join('\n');

      const csv = csvHeader + csvRows;

      res.setHeader('Content-Disposition', `attachment; filename="analytics-${analytics.link?.shortCode || 'data'}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csv);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${analytics.link?.shortCode}-${period}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.json(exportData);
    }

  } catch (error) {
    console.error('❌ Export analytics error:', error);
    return sendErrorResponse(res, 500, 'Failed to export analytics', error.message);
  }
};

/**
 * GET /api/analytics/real-time/:linkId - Real-time analytics
 */
exports.getRealTimeAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const linkId = req.params.linkId;
    const { minutes = 60 } = req.query;

    const analytics = await linkService.getLinkAnalytics(linkId, userId, '1d');

    return sendSuccessResponse(res, 'Real-time analytics retrieved', {
      link: analytics.link,
      timeRange: `${minutes} minutes`,
      recentClicks: [], // TODO
      clicksPerMinute: [], // TODO
      summary: {
        totalClicksInPeriod: 0,
        uniqueIPs: 0
      }
    });

  } catch (error) {
    console.error('❌ Real-time analytics error:', error);
    return sendErrorResponse(res, 500, 'Failed to retrieve real-time analytics', error.message);
  }
};

/**
 * GET /api/analytics/trends - Analytics trends and insights
 */
exports.getTrends = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    const currentStats = await linkService.getUserStats(userId);

    return sendSuccessResponse(res, 'Analytics trends retrieved', {
      current: currentStats,
      trends: {
        clicksChange: '0.0', // TODO
        direction: { clicks: 'stable' }
      },
      period
    });

  } catch (error) {
    console.error('❌ Trends analytics error:', error);
    return sendErrorResponse(res, 500, 'Failed to retrieve analytics trends', error.message);
  }
};
exports.compareLinks = async (req, res) => {
  try {
    // Placeholder logic
    return res.json({
      success: true,
      message: 'Compare analytics not yet implemented',
      data: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to compare links',
      error: error.message
    });
  }
};