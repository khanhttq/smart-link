// backend/domains/analytics/middleware/errorHandler.js - Global Analytics Error Handler
// ✅ FIXED: Remove dependency on errorCodes file

// ===== ES6 ERROR CODES & MESSAGES =====
const ANALYTICS_ERROR_CODES = {
  // ElasticSearch errors
  ELASTICSEARCH_ERROR: 'ELASTICSEARCH_ERROR',
  ELASTICSEARCH_CONNECTION_ERROR: 'ELASTICSEARCH_CONNECTION_ERROR',
  ELASTICSEARCH_TIMEOUT: 'ELASTICSEARCH_TIMEOUT',
  ELASTICSEARCH_UNAVAILABLE: 'ELASTICSEARCH_UNAVAILABLE',
  
  // Database errors
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  
  // Analytics specific errors
  ANALYTICS_ERROR: 'ANALYTICS_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  NO_ANALYTICS_DATA: 'NO_ANALYTICS_DATA',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Network errors
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  
  // General errors
  ANALYTICS_UNKNOWN_ERROR: 'ANALYTICS_UNKNOWN_ERROR'
};

const ANALYTICS_ERROR_MESSAGES = {
  [ANALYTICS_ERROR_CODES.ELASTICSEARCH_ERROR]: 'ElasticSearch service error',
  [ANALYTICS_ERROR_CODES.ELASTICSEARCH_CONNECTION_ERROR]: 'Cannot connect to ElasticSearch',
  [ANALYTICS_ERROR_CODES.ELASTICSEARCH_TIMEOUT]: 'ElasticSearch request timed out',
  [ANALYTICS_ERROR_CODES.ELASTICSEARCH_UNAVAILABLE]: 'ElasticSearch service temporarily unavailable',
  
  [ANALYTICS_ERROR_CODES.DATABASE_CONNECTION_ERROR]: 'Database connection failed',
  [ANALYTICS_ERROR_CODES.DATABASE_TIMEOUT]: 'Database request timed out',
  [ANALYTICS_ERROR_CODES.DATABASE_UNAVAILABLE]: 'Database service unavailable',
  
  [ANALYTICS_ERROR_CODES.ANALYTICS_ERROR]: 'Analytics processing error',
  [ANALYTICS_ERROR_CODES.SERVICE_UNAVAILABLE]: 'Analytics service temporarily unavailable',
  [ANALYTICS_ERROR_CODES.LINK_NOT_FOUND]: 'Link not found or unauthorized',
  [ANALYTICS_ERROR_CODES.NO_ANALYTICS_DATA]: 'No analytics data available',
  [ANALYTICS_ERROR_CODES.VALIDATION_ERROR]: 'Invalid request parameters',
  
  [ANALYTICS_ERROR_CODES.CONNECTION_REFUSED]: 'Connection refused',
  [ANALYTICS_ERROR_CODES.REQUEST_TIMEOUT]: 'Request timed out',
  [ANALYTICS_ERROR_CODES.SERVICE_NOT_FOUND]: 'Service not found',
  
  [ANALYTICS_ERROR_CODES.ANALYTICS_UNKNOWN_ERROR]: 'Unknown analytics error'
};

// ===== ES6 ERROR MAPPING =====
const ERROR_TYPE_MAPPING = {
  // ElasticSearch errors
  'ResponseError': ANALYTICS_ERROR_CODES.ELASTICSEARCH_ERROR,
  'ConnectionError': ANALYTICS_ERROR_CODES.ELASTICSEARCH_CONNECTION_ERROR,
  'TimeoutError': ANALYTICS_ERROR_CODES.ELASTICSEARCH_TIMEOUT,
  
  // Database errors
  'SequelizeConnectionError': ANALYTICS_ERROR_CODES.DATABASE_CONNECTION_ERROR,
  'SequelizeTimeoutError': ANALYTICS_ERROR_CODES.DATABASE_TIMEOUT,
  'SequelizeValidationError': ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
  
  // Custom analytics errors
  'AnalyticsError': ANALYTICS_ERROR_CODES.ANALYTICS_ERROR,
  'ServiceUnavailableError': ANALYTICS_ERROR_CODES.SERVICE_UNAVAILABLE,
  
  // Network errors
  'ECONNREFUSED': ANALYTICS_ERROR_CODES.CONNECTION_REFUSED,
  'ETIMEOUT': ANALYTICS_ERROR_CODES.REQUEST_TIMEOUT,
  'ENOTFOUND': ANALYTICS_ERROR_CODES.SERVICE_NOT_FOUND
};

// ===== ES6 ERROR RESPONSE BUILDER =====
const buildErrorResponse = (error, req) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  // Determine error type and status code
  let statusCode = 500;
  let errorCode = ANALYTICS_ERROR_CODES.ANALYTICS_UNKNOWN_ERROR;
  let message = 'An unexpected error occurred in analytics service';
  let details = null;
  
  // Handle known error types
  if (error.name && ERROR_TYPE_MAPPING[error.name]) {
    errorCode = ERROR_TYPE_MAPPING[error.name];
  }
  
  // Handle custom error codes
  if (error.code) {
    errorCode = error.code;
  }
  
  // Handle status codes
  if (error.statusCode) {
    statusCode = error.statusCode;
  } else if (error.status) {
    statusCode = error.status;
  }
  
  // Handle specific error types
  switch (error.name) {
    case 'ResponseError':
      statusCode = 503;
      message = 'Analytics service temporarily unavailable';
      errorCode = ANALYTICS_ERROR_CODES.ELASTICSEARCH_UNAVAILABLE;
      break;
      
    case 'ConnectionError':
    case 'ECONNREFUSED':
      statusCode = 503;
      message = 'Unable to connect to analytics service';
      errorCode = ANALYTICS_ERROR_CODES.CONNECTION_REFUSED;
      break;
      
    case 'TimeoutError':
    case 'ETIMEOUT':
      statusCode = 504;
      message = 'Analytics request timed out';
      errorCode = ANALYTICS_ERROR_CODES.REQUEST_TIMEOUT;
      break;
      
    case 'SequelizeConnectionError':
      statusCode = 503;
      message = 'Database connection error';
      errorCode = ANALYTICS_ERROR_CODES.DATABASE_UNAVAILABLE;
      break;
      
    case 'ValidationError':
      statusCode = 400;
      message = error.message || 'Validation failed';
      errorCode = ANALYTICS_ERROR_CODES.VALIDATION_ERROR;
      break;
      
    default:
      if (error.message) {
        message = error.message;
      }
  }
  
  // Add development details
  if (process.env.NODE_ENV === 'development') {
    details = {
      stack: error.stack,
      originalError: error.name,
      elasticSearchMeta: error.meta,
      requestPath: req.originalUrl,
      requestMethod: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };
  }
  
  return {
    success: false,
    message,
    code: errorCode,
    details,
    meta: {
      timestamp,
      requestId,
      endpoint: req.originalUrl,
      method: req.method,
      statusCode
    }
  };
};

// ===== ES6 FALLBACK DATA PROVIDER =====
const getFallbackData = (req, error) => {
  const endpoint = req.originalUrl;
  
  // Provide fallback data based on endpoint
  if (endpoint.includes('/analytics/dashboard')) {
    return {
      overview: {
        totalLinks: 0,
        totalClicks: 0,
        totalUniqueClicks: 0,
        activeLinks: 0,
        avgClicks: 0,
        clickThroughRate: 0,
        recentActivity: {
          dailyClicks: [],
          topCountries: [],
          topDevices: []
        },
        recentLinks: [],
        meta: {
          dataSource: 'fallback',
          error: error.message,
          generatedAt: new Date().toISOString()
        }
      },
      period: req.query.period || '30d',
      serviceStatus: {
        elasticsearch: false,
        dataSource: 'fallback',
        fallback: true
      }
    };
  }
  
  if (endpoint.includes('/analytics/links/')) {
    return {
      link: null,
      totals: {
        clicks: 0,
        uniqueClicks: 0,
        clickThroughRate: '0.00'
      },
      breakdown: {
        daily: [],
        countries: [],
        devices: [],
        browsers: []
      },
      period: {
        range: req.query.period || '7d',
        start: new Date().toISOString(),
        end: new Date().toISOString()
      },
      meta: {
        dataSource: 'fallback',
        fallback: true,
        error: error.message,
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  return null;
};

// ===== ES6 MAIN ERROR HANDLER =====
const analyticsErrorHandler = (error, req, res, next) => {
  console.error('🚨 Analytics Error:', {
    error: error.message,
    stack: error.stack,
    endpoint: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  
  const errorResponse = buildErrorResponse(error, req);
  
  // For certain errors, provide fallback data
  const shouldProvideFallback = [
    ANALYTICS_ERROR_CODES.ELASTICSEARCH_UNAVAILABLE,
    ANALYTICS_ERROR_CODES.CONNECTION_REFUSED,
    ANALYTICS_ERROR_CODES.DATABASE_UNAVAILABLE
  ].includes(errorResponse.code);
  
  if (shouldProvideFallback && req.method === 'GET') {
    const fallbackData = getFallbackData(req, error);
    
    if (fallbackData) {
      // Return partial success with fallback data
      return res.status(200).json({
        success: true,
        message: 'Analytics retrieved using fallback data',
        data: fallbackData,
        warning: errorResponse.message,
        fallback: true,
        meta: {
          ...errorResponse.meta,
          fallbackReason: errorResponse.code,
          originalError: error.name
        }
      });
    }
  }
  
  // Return error response
  res.status(errorResponse.meta.statusCode).json(errorResponse);
};

// ===== ES6 ASYNC ERROR WRAPPER =====
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ===== ES6 SERVICE HEALTH CHECKER =====
const checkServiceHealth = async (req, res, next) => {
  // Add service status to request for controllers to use
  req.serviceStatus = {
    elasticsearch: false,
    database: true, // Assume database is available if we got here
    timestamp: new Date().toISOString()
  };
  
  try {
    // Check ElasticSearch health (non-blocking)
    const clickTrackingService = require('../services/ClickTrackingService');
    if (clickTrackingService.isReady()) {
      const health = await clickTrackingService.healthCheck();
      req.serviceStatus.elasticsearch = health.status === 'up';
    }
  } catch (error) {
    console.warn('⚠️ Service health check failed:', error.message);
    req.serviceStatus.elasticsearch = false;
  }
  
  next();
};

// ===== ES6 REQUEST LOGGER =====
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  console.log(`📊 Analytics Request: ${req.method} ${req.originalUrl}`, {
    userId: req.user?.id,
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    console.log(`📊 Analytics Response: ${res.statusCode} ${req.originalUrl}`, {
      success,
      duration: `${duration}ms`,
      size: data ? data.length : 0,
      userId: req.user?.id
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

// ===== ES6 EXPORTS =====
module.exports = {
  analyticsErrorHandler,
  asyncErrorHandler,
  checkServiceHealth,
  requestLogger,
  buildErrorResponse,
  getFallbackData,
  ANALYTICS_ERROR_CODES,
  ANALYTICS_ERROR_MESSAGES
};