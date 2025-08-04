// backend/domains/analytics/controllers/AnalyticsController.js - Enhanced Error Handling
const linkService = require('../../links/services/LinkService');
const clickTrackingService = require('../services/ClickTrackingService');

// ===== ES6 RESPONSE HELPERS =====
const sendSuccessResponse = (res, message, data = null, meta = {}) => {
  return res.json({
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
};

const sendErrorResponse = (res, statusCode, message, details = null, errorCode = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code: errorCode,
    details: process.env.NODE_ENV === 'development' ? details : null,
    meta: {
      timestamp: new Date().toISOString(),
      endpoint: res.req?.originalUrl,
      method: res.req?.method
    }
  });
};

// ===== ES6 ERROR CLASSES =====
class AnalyticsError extends Error {
  constructor(message, statusCode = 500, code = 'ANALYTICS_ERROR') {
    super(message);
    this.name = 'AnalyticsError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

class ServiceUnavailableError extends AnalyticsError {
  constructor(message = 'Analytics service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

// ===== ES6 VALIDATION HELPERS =====
const validateLinkAccess = async (linkId, userId) => {
  try {
    const link = await linkService.getLinkById ? 
      await linkService.getLinkById(linkId, userId) : 
      null;
      
    if (!link) {
      throw new AnalyticsError('Link not found or unauthorized', 404, 'LINK_NOT_FOUND');
    }
    
    return link;
  } catch (error) {
    if (error instanceof AnalyticsError) throw error;
    throw new AnalyticsError('Failed to validate link access', 500, 'VALIDATION_ERROR');
  }
};

const validatePeriod = (period) => {
  const validPeriods = ['1d', '7d', '30d', '90d', '1y'];
  if (!validPeriods.includes(period)) {
    throw new AnalyticsError(`Invalid period. Must be one of: ${validPeriods.join(', ')}`, 400, 'INVALID_PERIOD');
  }
  return period;
};

// ===== ES6 ANALYTICS CONTROLLERS =====

/**
 * GET /api/analytics/dashboard - Dashboard overview analytics
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    validatePeriod(period);

    console.log(`📊 Getting dashboard analytics for user ${userId}, period: ${period}`);

    const userStats = await linkService.getUserStats(userId);

    // ✅ ENHANCED: Add service status info
    const serviceStatus = {
      elasticsearch: clickTrackingService.isReady(),
      dataSource: userStats.meta?.dataSource || 'postgresql',
      fallback: userStats.meta?.dataSource === 'postgresql'
    };

    return sendSuccessResponse(res, 'Dashboard analytics retrieved successfully', {
      overview: userStats,
      period,
      serviceStatus
    }, {
      cached: false,
      serviceStatus
    });

  } catch (error) {
    console.error('❌ Dashboard analytics error:', error);
    
    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }
    
    return sendErrorResponse(res, 500, 'Failed to retrieve dashboard analytics', error.message, 'DASHBOARD_ERROR');
  }
};

/**
 * GET /api/analytics/links/:linkId - Detailed link analytics  
 */
exports.getLinkAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const linkId = req.params.linkId;
    const { period = '7d' } = req.query;

    // ✅ VALIDATION
    if (!linkId) {
      return sendErrorResponse(res, 400, 'Link ID is required', null, 'MISSING_LINK_ID');
    }

    validatePeriod(period);

    console.log(`📊 Getting analytics for link ${linkId}, user ${userId}, period: ${period}`);

    // ✅ ENHANCED: Get analytics with comprehensive error handling
    let analytics;
    try {
      analytics = await linkService.getLinkAnalytics(linkId, userId, period);
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('unauthorized')) {
        return sendErrorResponse(res, 404, 'Link not found or unauthorized', null, 'LINK_NOT_FOUND');
      }
      throw error;
    }

    // ✅ ENHANCED: Check if we got valid analytics
    if (!analytics || !analytics.link) {
      return sendErrorResponse(res, 404, 'Link not found or no analytics available', null, 'NO_ANALYTICS_DATA');
    }

    // ✅ ENHANCED: Determine service status and response
    const serviceStatus = {
      elasticsearch: clickTrackingService.isReady(),
      dataSource: analytics.meta?.dataSource || 'unknown',
      fallback: analytics.meta?.fallback || false,
      error: analytics.meta?.error || null
    };

    // ✅ ENHANCED: Handle service unavailable but return fallback data
    if (serviceStatus.fallback && serviceStatus.dataSource === 'postgresql') {
      return res.status(200).json({
        success: true,
        message: 'Analytics retrieved using fallback data source',
        data: analytics,
        warning: 'ElasticSearch service temporarily unavailable, using PostgreSQL backup',
        meta: {
          timestamp: new Date().toISOString(),
          serviceStatus,
          fallback: true
        }
      });
    }

    // ✅ ENHANCED: Normal success response
    return sendSuccessResponse(res, 'Link analytics retrieved successfully', analytics, {
      serviceStatus,
      period,
      linkId
    });

  } catch (error) {
    console.error('❌ Link analytics error:', error);

    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }

    // ✅ ENHANCED: Check for specific error types
    if (error.name === 'SequelizeConnectionError' || error.name === 'ConnectionError') {
      return sendErrorResponse(res, 503, 'Database connection error', null, 'DATABASE_UNAVAILABLE');
    }

    if (error.message.includes('ElasticSearch') || error.message.includes('elasticsearch')) {
      return sendErrorResponse(res, 503, 'Analytics service temporarily unavailable', null, 'ELASTICSEARCH_UNAVAILABLE');
    }

    return sendErrorResponse(res, 500, 'Failed to retrieve link analytics', error.message, 'ANALYTICS_ERROR');
  }
};

/**
 * GET /api/analytics/export/:linkId - Export analytics data
 */
exports.exportAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const linkId = req.params.linkId;
    const { period = '7d', format = 'json' } = req.query;

    // ✅ VALIDATION
    if (!linkId) {
      return sendErrorResponse(res, 400, 'Link ID is required', null, 'MISSING_LINK_ID');
    }

    validatePeriod(period);

    if (!['json', 'csv'].includes(format)) {
      return sendErrorResponse(res, 400, 'Invalid format. Must be "json" or "csv"', null, 'INVALID_FORMAT');
    }

    console.log(`📤 Exporting analytics for link ${linkId}, format: ${format}`);

    const analytics = await linkService.getLinkAnalytics(linkId, userId, period);

    if (!analytics || !analytics.link) {
      return sendErrorResponse(res, 404, 'Link not found or no analytics data available', null, 'NO_EXPORT_DATA');
    }

    // ✅ ENHANCED: Prepare export data with metadata
    const exportData = {
      link: analytics.link,
      summary: analytics.totals,
      dateRange: analytics.period,
      breakdown: analytics.breakdown,
      exportInfo: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email || req.user.id,
        format,
        period,
        dataSource: analytics.meta?.dataSource || 'unknown',
        fallback: analytics.meta?.fallback || false,
        version: '1.0'
      }
    };

    if (format === 'csv') {
      // ✅ ENHANCED: Better CSV formatting
      const csvRows = [
        // Header
        'Metric,Value,Description',
        // Summary metrics
        `Total Clicks,${analytics.totals?.clicks || 0},Total number of clicks`,
        `Unique Clicks,${analytics.totals?.uniqueClicks || 0},Number of unique visitors`,
        `Click Through Rate,${analytics.totals?.clickThroughRate || '0.00'}%,Percentage of unique clicks`,
        `Link Title,"${analytics.link?.title || 'N/A'}",Link display title`,
        `Short Code,${analytics.link?.shortCode || 'N/A'},Shortened URL code`,
        `Original URL,"${analytics.link?.originalUrl || 'N/A'}",Original destination URL`,
        `Created Date,${analytics.link?.createdAt || 'N/A'},Link creation date`,
        `Export Date,${exportData.exportInfo.exportedAt},Data export timestamp`,
        `Data Source,${exportData.exportInfo.dataSource},Source of analytics data`,
        '',
        // Daily breakdown
        'Date,Daily Clicks,Type',
        ...(analytics.breakdown?.daily || []).map(item => 
          `${item.date},${item.clicks},Daily Stats`
        ),
        '',
        // Top countries
        'Country,Clicks,Type',
        ...(analytics.breakdown?.countries || []).map(item => 
          `${item.country},${item.clicks},Geographic`
        ),
        '',
        // Top devices  
        'Device,Clicks,Type',
        ...(analytics.breakdown?.devices || []).map(item => 
          `${item.device},${item.clicks},Device Type`
        ),
        '',
        // Top browsers
        'Browser,Clicks,Type',
        ...(analytics.breakdown?.browsers || []).map(item => 
          `${item.browser},${item.clicks},Browser Type`
        )
      ];

      const csv = csvRows.join('\n');
      const filename = `analytics-${analytics.link?.shortCode || 'data'}-${period}.csv`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));
      
      return res.send(csv);
    } else {
      // ✅ ENHANCED: Better JSON formatting
      const filename = `analytics-${analytics.link?.shortCode || 'data'}-${period}.json`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      return res.json(exportData);
    }

  } catch (error) {
    console.error('❌ Export analytics error:', error);

    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }

    return sendErrorResponse(res, 500, 'Failed to export analytics data', error.message, 'EXPORT_ERROR');
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

    if (!linkId) {
      return sendErrorResponse(res, 400, 'Link ID is required', null, 'MISSING_LINK_ID');
    }

    // Validate minutes parameter
    const minutesNum = parseInt(minutes);
    if (isNaN(minutesNum) || minutesNum < 1 || minutesNum > 1440) { // Max 24 hours
      return sendErrorResponse(res, 400, 'Minutes must be between 1 and 1440 (24 hours)', null, 'INVALID_MINUTES');
    }

    console.log(`⚡ Getting real-time analytics for link ${linkId}, ${minutesNum} minutes`);

    // ✅ ENHANCED: Check service availability
    if (!clickTrackingService.isReady()) {
      return sendErrorResponse(res, 503, 'Real-time analytics service temporarily unavailable', null, 'REALTIME_UNAVAILABLE');
    }

    const realtimeData = await clickTrackingService.getRealTimeClicks(userId, minutesNum);

    return sendSuccessResponse(res, 'Real-time analytics retrieved successfully', {
      linkId,
      timeRange: `${minutesNum} minutes`,
      recentClicks: realtimeData.recentClicks || [],
      clicksPerMinute: realtimeData.clicksPerMinute || [],
      summary: {
        totalClicksInPeriod: realtimeData.recentClicks?.length || 0,
        uniqueIPs: new Set(realtimeData.recentClicks?.map(click => click.ipAddress) || []).size,
        timeWindow: minutesNum
      }
    }, {
      realtime: true,
      refreshInterval: '30s'
    });

  } catch (error) {
    console.error('❌ Real-time analytics error:', error);
    
    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }

    return sendErrorResponse(res, 500, 'Failed to retrieve real-time analytics', error.message, 'REALTIME_ERROR');
  }
};

/**
 * GET /api/analytics/trends - Analytics trends and insights
 */
exports.getTrends = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30d' } = req.query;

    validatePeriod(period);

    console.log(`📈 Getting analytics trends for user ${userId}, period: ${period}`);

    const currentStats = await linkService.getUserStats(userId);

    // ✅ ENHANCED: Calculate trends (simplified for now)
    const trends = {
      clicksChange: '0.0', // TODO: Implement actual trend calculation
      direction: { 
        clicks: 'stable',
        links: 'stable',
        engagement: 'stable'
      },
      insights: [
        currentStats.totalClicks > 100 ? 
          'Your links are getting good engagement!' : 
          'Consider sharing your links more to increase clicks',
        currentStats.activeLinks > 10 ? 
          'You have a healthy number of active links' : 
          'Try creating more links to expand your reach'
      ],
      recommendations: [
        'Check your top-performing links and create similar content',
        'Monitor your click patterns to optimize posting times'
      ]
    };

    return sendSuccessResponse(res, 'Analytics trends retrieved successfully', {
      current: currentStats,
      trends,
      period
    }, {
      trendsVersion: '1.0',
      calculated: true
    });

  } catch (error) {
    console.error('❌ Trends analytics error:', error);
    
    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }

    return sendErrorResponse(res, 500, 'Failed to retrieve analytics trends', error.message, 'TRENDS_ERROR');
  }
};

/**
 * GET /api/analytics/comparison - Compare multiple links
 */
exports.compareLinks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { linkIds, period = '7d' } = req.query;

    if (!linkIds) {
      return sendErrorResponse(res, 400, 'Link IDs are required', null, 'MISSING_LINK_IDS');
    }

    validatePeriod(period);

    // Parse linkIds (could be comma-separated string or array)
    const linkIdArray = Array.isArray(linkIds) ? linkIds : linkIds.split(',');
    
    if (linkIdArray.length > 10) {
      return sendErrorResponse(res, 400, 'Maximum 10 links can be compared at once', null, 'TOO_MANY_LINKS');
    }

    console.log(`🔄 Comparing ${linkIdArray.length} links for user ${userId}`);

    // ✅ PLACEHOLDER: Implementation for comparison
    const comparisons = await Promise.all(
      linkIdArray.map(async (linkId) => {
        try {
          const analytics = await linkService.getLinkAnalytics(linkId.trim(), userId, period);
          return {
            linkId: linkId.trim(),
            success: true,
            data: {
              title: analytics.link?.title || 'Unknown',
              shortCode: analytics.link?.shortCode || 'unknown',
              totalClicks: analytics.totals?.clicks || 0,
              uniqueClicks: analytics.totals?.uniqueClicks || 0,
              ctr: analytics.totals?.clickThroughRate || '0.00'
            }
          };
        } catch (error) {
          return {
            linkId: linkId.trim(),
            success: false,
            error: error.message
          };
        }
      })
    );

    const successful = comparisons.filter(c => c.success);
    const failed = comparisons.filter(c => !c.success);

    return sendSuccessResponse(res, 'Link comparison completed', {
      period,
      requested: linkIdArray.length,
      successful: successful.length,
      failed: failed.length,
      comparisons: successful,
      errors: failed
    }, {
      comparisonType: 'basic',
      includesTrends: false
    });

  } catch (error) {
    console.error('❌ Compare links error:', error);
    
    if (error instanceof AnalyticsError) {
      return sendErrorResponse(res, error.statusCode, error.message, error.stack, error.code);
    }

    return sendErrorResponse(res, 500, 'Failed to compare links', error.message, 'COMPARISON_ERROR');
  }
};

// ===== ES6 HEALTH CHECK =====
exports.healthCheck = async (req, res) => {
  try {
    const elasticHealth = await clickTrackingService.healthCheck();
    
    return sendSuccessResponse(res, 'Analytics service health check', {
      elasticsearch: elasticHealth,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    return sendErrorResponse(res, 500, 'Health check failed', error.message, 'HEALTH_CHECK_ERROR');
  }
};