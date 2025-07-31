// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const container = require('./shared/container/Container');

// Import domains
const authDomain = require('./domains/auth');
const linksDomain = require('./domains/links');
const analyticsDomain = require('./domains/analytics');
const usersDomain = require('./domains/users');
const securityDomain = require('./domains/security');

const app = express();

// Get config from container
const config = container.get('config');
const logger = container.get('logger');

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

logger.info('🚀 Shortlink Backend Starting...');
logger.info(`Environment: ${config.nodeEnv}`);

// ===== ROUTES SETUP (THỨ TỰ QUAN TRỌNG) =====

// 1. SPECIFIC ROUTES TRƯỚC (không bị conflict)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Shortlink Backend - Routes Connected',
    environment: config.nodeEnv,
    version: '1.0.0',
    routes: {
      auth: '/api/auth/*',
      links: '/api/links/*',
      analytics: '/api/analytics/*',
      users: '/api/users/*',
      redirect: '/:shortCode'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Shortlink API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      links: '/api/links',
      analytics: '/api/analytics',
      users: '/api/users',
      redirect: '/:shortCode'
    },
    examples: {
      'POST /api/auth/login': 'Login user',
      'POST /api/links': 'Create shortlink',
      'GET /api/analytics/dashboard': 'Get analytics',
      'GET /abc123': 'Redirect shortlink'
    }
  });
});

// 2. API ROUTES
app.use('/api/auth', authDomain.routes);
app.use('/api/links', linksDomain.routes.main);
app.use('/api/analytics', analyticsDomain.routes);
app.use('/api/users', usersDomain.routes);

// 3. REDIRECT ROUTES (CUỐI CÙNG - wildcard)
app.use('/', linksDomain.routes.redirect);

// 4. 404 HANDLER (SAU TẤT CẢ)
app.use('*', (req, res) => {
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
      '/:shortCode (redirect)'
    ]
  });
});

// 5. ERROR HANDLING (CUỐI CÙNG)
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

module.exports = app;