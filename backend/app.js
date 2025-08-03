// backend/app.js - Updated with Analytics Routes
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');

const container = require('./shared/container/Container');

// Import domains
const authDomain = require('./domains/auth');
const linksDomain = require('./domains/links');
const analyticsDomain = require('./domains/analytics');
const usersDomain = require('./domains/users');
const securityDomain = require('./domains/security');

// Import security middleware
const {
  generalLimiter,
  authLimiter,
  createLinkLimiter
} = securityDomain.middleware.rateLimiter;

const { createSecurityHeadersMiddleware } = securityDomain.middleware.securityHeaders;
const { getCorsConfig, corsErrorHandler, corsSecurityMonitor } = securityDomain.middleware.corsConfig;
const { sanitizeInput } = securityDomain.middleware.inputValidation;
const { sqlInjectionProtection } = securityDomain.middleware.sqlInjectionProtection;
const adminRoutes = require('./domains/admin/routes/adminRoutes');

const app = express();

// Get config from container
const config = container.get('config');
const logger = container.get('logger');

// ===== SECURITY MIDDLEWARE FIRST =====

app.set('trust proxy', 1);

const securityHeadersMiddleware = createSecurityHeadersMiddleware(config.nodeEnv);
app.use(securityHeadersMiddleware);

const corsConfig = getCorsConfig(config.nodeEnv);
app.use(cors(corsConfig));

app.use(corsSecurityMonitor);

app.use(hpp({
  whitelist: ['tags', 'categories', 'sort', 'filter']
}));

app.use(mongoSanitize({
  replaceWith: '_'
}));

app.use(compression());

// ===== BASIC MIDDLEWARE =====

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced request logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms :remote-addr'));
}

// ===== INPUT VALIDATION & SANITIZATION =====

app.use(sanitizeInput);
app.use(sqlInjectionProtection);

// ===== HEALTH CHECK =====

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
    security: {
      corsEnabled: 'yes',
      helmetEnabled: 'yes',
      rateLimiting: config.nodeEnv === 'development' ? 'relaxed' : 'enforced',
      inputSanitization: 'enabled',
      sqlInjectionProtection: 'enabled',
      inputValidation: 'ready',
      bruteForceProtection: 'enabled'
    },
    services: {
      database: 'connected',
      redis: 'connected',
      elasticsearch: 'available'
    },
    routes: {
      auth: '/api/auth/* (rate limited + brute force protection + validation)',
      links: '/api/links/* (rate limited + validation)',
      analytics: '/api/analytics/* (ElasticSearch integrated)',
      domains: '/api/domains/*',
      users: '/api/users/*',
      admin: '/api/admin/*',
      redirect: '/:shortCode'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Shortlink API - ElasticSearch Enhanced',
    version: '1.0.0',
    security: '🛡️ Enhanced',
    analytics: '📊 ElasticSearch Integrated',
    endpoints: {
      health: '/health',
      auth: '/api/auth (rate limited)',
      links: '/api/links (rate limited)',
      analytics: '/api/analytics (real-time analytics)',
      domains: '/api/domains (custom domains)',
      users: '/api/users',
      admin: '/api/admin',
      redirect: '/:shortCode'
    },
    examples: {
      'POST /api/auth/login': 'Login user (10 requests/15min)',
      'POST /api/links': 'Create shortlink (20 requests/min)',
      'GET /api/analytics/dashboard': 'Get real-time analytics dashboard',
      'GET /api/analytics/links/:id': 'Get detailed link analytics',
      'GET /api/analytics/export/:id': 'Export analytics data',
      'GET /api/admin/system-status': 'System monitoring',
      'GET /abc123': 'Redirect shortlink'
    },
    newFeatures: {
      elasticsearch: 'Real-time click tracking and analytics',
      exportAnalytics: 'Export data in JSON/CSV format',
      realTimeData: 'Live analytics dashboard',
      customDomains: 'Support for custom domains'
    }
  });
});

// ===== API ROUTES WITH RATE LIMITING =====

// Auth routes (strict rate limiting)
app.use('/api/auth', authLimiter, authDomain.routes);

// Links routes (moderate rate limiting for creation)
app.use('/api/links', linksDomain.routes.main);

// Domain management routes
app.use('/api/domains', linksDomain.routes.domains);

// Analytics routes (NEW - ElasticSearch integrated)
app.use('/api/analytics', analyticsDomain.routes);

// Other routes (general rate limiting only)
app.use('/api/users', usersDomain.routes);
app.use('/api/admin', adminRoutes);

// Redirect routes (no additional rate limiting, already has general)
app.use('/', linksDomain.routes.redirect);

// ===== ERROR HANDLERS =====

// CORS error handler (before general error handler)
app.use(corsErrorHandler);

// 404 handler
app.use('*', (req, res) => {
  console.log(`🔍 404 - Route not found: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    availableRoutes: [
      '/health',
      '/api/auth/*',
      '/api/links/*', 
      '/api/analytics/* (NEW)',
      '/api/domains/*',
      '/api/users/*',
      '/api/admin/*',
      '/:shortCode (redirect)'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  // Rate limiting errors
  if (err.message?.includes('Too many requests')) {
    return res.status(429).json({
      success: false,
      message: 'Quá nhiều requests. Vui lòng thử lại sau.',
      retryAfter: err.retryAfter
    });
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication Error',
      message: 'Invalid or expired token'
    });
  }
  
  // Security errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Payload Too Large',
      message: 'Request body exceeds maximum allowed size'
    });
  }
  
  // ElasticSearch errors
  if (err.name === 'ResponseError' && err.meta?.connection) {
    console.warn('⚠️ ElasticSearch error, falling back to PostgreSQL');
    return res.status(503).json({
      success: false,
      error: 'Analytics Service Temporarily Unavailable',
      message: 'Analytics service is temporarily unavailable, trying backup system',
      fallback: true
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;