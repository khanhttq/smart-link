// backend/app.js - Safe Application Setup with Error Handling
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import CORS configuration
const { getCorsConfig } = require('./domains/security/middleware/corsConfig');

const app = express();

// ===== SECURITY MIDDLEWARE (FIRST) =====
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ===== CORS CONFIGURATION =====
const corsConfig = getCorsConfig(process.env.NODE_ENV);
app.use(cors(corsConfig));

// Debug CORS setup
console.log('🔧 App Configuration:');
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'not set'}`);
console.log(`   CORS Origins: ${JSON.stringify(corsConfig.origin)}`);

// ===== LOGGING =====
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ===== BODY PARSING MIDDLEWARE (CRITICAL FOR LOGIN) =====
app.use(
  express.json({
    limit: '10mb',
    strict: true,
    type: 'application/json',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 1000,
  })
);

// ===== IMPORT DOMAINS SAFELY =====
let securityDomain, authDomain, linksDomain, analyticsDomain, usersDomain, adminDomain;

try {
  securityDomain = require('./domains/security');
  console.log('✅ Security domain loaded');
} catch (error) {
  console.error('❌ Security domain failed to load:', error.message);
  process.exit(1); // Security is critical
}

try {
  authDomain = require('./domains/auth');
  console.log('✅ Auth domain loaded');
} catch (error) {
  console.error('❌ Auth domain failed to load:', error.message);
  process.exit(1); // Auth is critical
}

try {
  linksDomain = require('./domains/links');
  console.log('✅ Links domain loaded');
} catch (error) {
  console.warn('⚠️ Links domain failed to load:', error.message);
}

try {
  analyticsDomain = require('./domains/analytics');
  console.log('✅ Analytics domain loaded');
} catch (error) {
  console.warn('⚠️ Analytics domain failed to load:', error.message);
}

try {
  usersDomain = require('./domains/users');
  console.log('✅ Users domain loaded');
} catch (error) {
  console.warn('⚠️ Users domain failed to load:', error.message);
}

try {
  adminDomain = require('./domains/admin');
  console.log('✅ Admin domain loaded');
} catch (error) {
  console.warn('⚠️ Admin domain failed to load:', error.message);
}

// ===== RATE LIMITING =====
if (securityDomain && securityDomain.middleware && securityDomain.middleware.rateLimiter) {
  const { generalLimiter } = securityDomain.middleware.rateLimiter;
  app.use(generalLimiter);
  console.log('✅ Rate limiting applied');
} else {
  console.warn('⚠️ Rate limiting not available');
}

// ===== HEALTH CHECK ENDPOINT =====
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    domains: {
      security: !!securityDomain,
      auth: !!authDomain,
      links: !!linksDomain,
      analytics: !!analyticsDomain,
      users: !!usersDomain,
      admin: !!adminDomain,
    },
  });
});

// ===== MAIN API ROUTES =====
console.log('🛤️ Setting up routes...');

// Auth routes (CRITICAL FOR LOGIN)
if (authDomain && authDomain.routes) {
  app.use('/api/auth', authDomain.routes);
  console.log('✅ Auth routes mounted at /api/auth');
} else {
  console.error('❌ CRITICAL: Auth routes not available!');
  process.exit(1);
}

// Links domain routes
if (linksDomain) {
  if (linksDomain.routes && linksDomain.routes.main) {
    // New structure with multiple route types
    app.use('/api/links', linksDomain.routes.main);
    console.log('✅ Links routes mounted at /api/links');

    if (linksDomain.routes.domains) {
      app.use('/api/domains', linksDomain.routes.domains);
      console.log('✅ Domain routes mounted at /api/domains');
    }

    if (linksDomain.routes.redirect) {
      app.use('/', linksDomain.routes.redirect);
      console.log('✅ Redirect routes mounted at / (short code redirects)');
    }
  } else if (linksDomain.routes) {
    // Fallback to simple routes
    app.use('/api/links', linksDomain.routes);
    console.log('✅ Links routes mounted at /api/links (simple)');
  } else {
    console.warn('⚠️ Links routes not properly exported');
  }
}

// Analytics routes
if (analyticsDomain && analyticsDomain.routes) {
  app.use('/api/analytics', analyticsDomain.routes);
  console.log('✅ Analytics routes mounted at /api/analytics');
}

// Users routes
if (usersDomain && usersDomain.routes) {
  app.use('/api/users', usersDomain.routes);
  console.log('✅ Users routes mounted at /api/users');
}

// Admin routes
if (adminDomain && adminDomain.routes) {
  app.use('/api/admin', adminDomain.routes);
  console.log('✅ Admin routes mounted at /api/admin');
}

console.log('✅ All available routes mounted successfully');

// ===== API INFO ENDPOINT =====
app.get('/api', (req, res) => {
  const availableEndpoints = {};

  if (authDomain) availableEndpoints.auth = '/api/auth';
  if (linksDomain) availableEndpoints.links = '/api/links';
  if (analyticsDomain) availableEndpoints.analytics = '/api/analytics';
  if (usersDomain) availableEndpoints.users = '/api/users';
  if (adminDomain) availableEndpoints.admin = '/api/admin';

  res.json({
    name: 'ShortLink API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: availableEndpoints,
    health: '/health',
  });
});

// ===== ERROR HANDLING MIDDLEWARE =====

// 404 Handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error Handler:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDevelopment && {
      stack: err.stack,
      details: err.details,
    }),
    timestamp: new Date().toISOString(),
  });
});

// ===== GRACEFUL SHUTDOWN HANDLING =====
process.on('SIGTERM', () => {
  console.log('📤 SIGTERM received, shutting down gracefully...');
});

process.on('SIGINT', () => {
  console.log('📤 SIGINT received, shutting down gracefully...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
