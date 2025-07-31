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

// Routes (sẽ setup sau)
// app.use('/api/auth', authDomain.routes);
// app.use('/api/links', linksDomain.routes);
// app.use('/api/analytics', analyticsDomain.routes);
// app.use('/api/users', usersDomain.routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Shortlink Backend - Domain Structure Ready',
    environment: config.nodeEnv,
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Shortlink API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth (coming soon)',
      links: '/api/links (coming soon)',
      analytics: '/api/analytics (coming soon)',
      users: '/api/users (coming soon)'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

module.exports = app;