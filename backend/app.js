// backend/app.js - UPDATED với Rate Limiting
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const hpp = require('hpp'); // HTTP Parameter Pollution protection
const mongoSanitize = require('express-mongo-sanitize'); // MongoDB injection protection

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

// Trust proxy (for accurate IP detection behind load balancer)
app.set('trust proxy', 1);

// Enhanced security headers with environment-aware CSP
const securityHeadersMiddleware = createSecurityHeadersMiddleware(config.nodeEnv);
app.use(securityHeadersMiddleware);

// Enhanced CORS configuration
const corsConfig = getCorsConfig(config.nodeEnv);
app.use(cors(corsConfig));

// CORS security monitoring
app.use(corsSecurityMonitor);

// HTTP Parameter Pollution protection
app.use(hpp({
  whitelist: ['tags', 'categories', 'sort', 'filter'] // Allow arrays for these parameters
}));

// MongoDB injection protection
app.use(mongoSanitize({
  replaceWith: '_' // Replace prohibited characters with underscore
}));

// Compression (after security headers)
app.use(compression({
  level: 6, // Compression level (1-9)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control no-transform directive
    if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Logging
app.use(morgan('combined', {
  skip: function (req, res) {
    return res.statusCode < 400; // Only log errors
  }
}));

// Request parsing with enhanced security
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.log(`🚫 Invalid JSON from IP: ${req.ip}`);
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== INPUT SECURITY MIDDLEWARE =====

// SQL injection protection (scan all inputs) - with improved patterns
app.use(sqlInjectionProtection);

// Input sanitization (clean XSS, etc.)
app.use(sanitizeInput);

// ===== RATE LIMITING =====

// Apply general rate limiting to all requests
app.use(generalLimiter);

logger.info('🚀 Shortlink Backend Starting...');
logger.info(`Environment: ${config.nodeEnv}`);

// ===== ROUTES SETUP =====

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Shortlink Backend - Security Enhanced v3',
    environment: config.nodeEnv,
    version: '1.0.0',
    security: {
      rateLimiting: 'enabled',
      helmet: 'enhanced',
      cors: 'configured',
      csp: config.nodeEnv === 'production' ? 'enforced' : 'report-only',
      inputSanitization: 'enabled',
      sqlInjectionProtection: 'enabled',
      inputValidation: 'ready',
      bruteForceProtection: 'enabled'
    },
    routes: {
      auth: '/api/auth/* (rate limited + brute force protection + validation)',
      links: '/api/links/* (rate limited + validation)',
      analytics: '/api/analytics/*',
      users: '/api/users/*',
      admin: '/api/admin/*',
      redirect: '/:shortCode'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Shortlink API - Security Enhanced',
    version: '1.0.0',
    security: '🛡️ Enhanced',
    endpoints: {
      health: '/health',
      auth: '/api/auth (rate limited)',
      links: '/api/links (rate limited)',
      analytics: '/api/analytics',
      users: '/api/users',
      admin: '/api/admin',
      redirect: '/:shortCode'
    },
    examples: {
      'POST /api/auth/login': 'Login user (10 requests/15min)',
      'POST /api/links': 'Create shortlink (20 requests/min)',
      'GET /api/analytics/dashboard': 'Get analytics',
      'GET /api/admin/system-status': 'System monitoring',
      'GET /abc123': 'Redirect shortlink'
    }
  });
});

// ===== API ROUTES WITH RATE LIMITING =====

// Auth routes (strict rate limiting)
app.use('/api/auth', authLimiter, authDomain.routes);

// Links routes (moderate rate limiting for creation)
app.use('/api/links', linksDomain.routes.main);

app.use('/api/domains', linksDomain.routes.domains);

// Other routes (general rate limiting only)
app.use('/api/analytics', analyticsDomain.routes);
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
      '/api/analytics/*',
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
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }
  
  // CORS errors (handled by corsErrorHandler above)
  if (err.message?.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: 'CORS_ERROR'
    });
  }
  
  // JSON parsing errors
  if (err.message?.includes('JSON')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format',
      error: 'INVALID_JSON'
    });
  }

  // Security errors
  if (err.message?.includes('CSP') || err.message?.includes('security')) {
    return res.status(400).json({
      success: false,
      message: 'Security policy violation',
      error: 'SECURITY_VIOLATION'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    error: config.nodeEnv === 'development' ? err.stack : 'INTERNAL_ERROR'
  });
});

module.exports = app;