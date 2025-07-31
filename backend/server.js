const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const authRoutes = require('./routes/auth');
const { authenticateToken } = require('./routes/auth');
const redisService = require('./services/redis');
const elasticsearchService = require('./services/elasticsearch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://192.168.68.122:3000'],
    credentials: true,
  }),
);
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Auth routes
app.use('/api/auth', authRoutes);

// Initialize database and Redis on startup
const initializeApp = async () => {
  console.log('🚀 Starting ShortLink Server...');

  // Test database connection
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Initialize database tables
  const dbInitialized = await db.initDatabase();
  if (!dbInitialized) {
    console.error('❌ Failed to initialize database. Exiting...');
    process.exit(1);
  }

  // Connect to Redis (optional - skip if fails)
  try {
    const redisConnected = await redisService.connect();
    if (redisConnected) {
      console.log('✅ Redis connected successfully');
    } else {
      console.warn('⚠️ Redis connection failed - continuing without cache');
    }
  } catch (error) {
    console.warn('⚠️ Skipping Redis due to connection error:', error.message);
  }

  // Connect to Elasticsearch
  console.log('🔍 Attempting Elasticsearch connection...');
  try {
    const esConnected = await elasticsearchService.connect();
    if (esConnected) {
      console.log('✅ Elasticsearch connected successfully');
    } else {
      console.warn('⚠️ Elasticsearch connection failed - continuing without search');
    }
  } catch (error) {
    console.warn('⚠️ Skipping Elasticsearch due to connection error:', error.message);
  }

  console.log('✅ All services ready!');
};

// =================== SETUP ROUTES ===================

// Check if system needs setup
app.get('/api/setup/status', async (req, res) => {
  try {
    const setupStatus = await db.checkSetupStatus();

    res.json({
      needsSetup: setupStatus.needsSetup,
      adminCount: setupStatus.adminCount,
      message: setupStatus.needsSetup ? 'System needs initial setup' : 'System already configured',
    });
  } catch (error) {
    console.error('Setup status error:', error);
    res.json({ needsSetup: true, error: 'Could not check setup status' });
  }
});

// Create first admin user
app.post('/api/setup/admin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if admin already exists
    const setupStatus = await db.checkSetupStatus();
    if (!setupStatus.needsSetup) {
      return res
        .status(400)
        .json({ error: 'Admin user already exists. System is already set up.' });
    }

    // Check if email already exists
    const emailExists = await db.checkEmailExists(email);
    if (emailExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const newAdmin = await db.createUser(email, hashedPassword, 'admin');

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: newAdmin.id, email: newAdmin.email, role: newAdmin.role },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '7d' },
    );

    console.log(`🎉 Admin user created: ${email} (ID: ${newAdmin.id})`);
    console.log(`🔧 System setup completed!`);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully! System is now ready.',
      user: {
        id: newAdmin.id,
        email: newAdmin.email,
        role: newAdmin.role,
        createdAt: newAdmin.created_at,
      },
      token,
      setupComplete: true,
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// =================== BASIC ROUTES ===================

// Test routes
app.get('/health', async (req, res) => {
  const dbConnected = await db.testConnection();
  const redisConnected = await redisService.ping();
  const esConnected = await elasticsearchService.ping();

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'ShortLink Backend API',
    database: dbConnected ? 'Connected' : 'Disconnected',
    redis: redisConnected ? 'Connected' : 'Disconnected',
    elasticsearch: esConnected ? 'Connected' : 'Disconnected',
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working with PostgreSQL!',
    frontend_connected: true,
    database: 'PostgreSQL',
  });
});

// Debug route to see stored links
app.get('/api/links/debug', async (req, res) => {
  try {
    const links = await db.getAllLinks();
    res.json({
      totalLinks: links.length,
      links: links.map(link => ({
        id: link.id,
        shortCode: link.short_code,
        originalUrl: link.original_url,
        clickCount: link.click_count,
        createdAt: link.created_at,
        isActive: link.is_active,
        userId: link.user_id,
      })),
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// =================== LINK ROUTES ===================

// Create shortlink with database storage and Redis caching (protected route)
app.post('/api/links', authenticateToken, async (req, res) => {
  try {
    const { url, customAlias } = req.body;
    const userId = req.user.userId;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Clean and validate URL
    let fullUrl = url.trim();

    // Remove any existing protocol to avoid duplication
    fullUrl = fullUrl.replace(/^https?:\/\//, '');

    // Add https protocol
    fullUrl = 'https://' + fullUrl;

    // Basic URL validation
    try {
      new URL(fullUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Generate shortcode
    const shortCode = customAlias || Math.random().toString(36).substring(2, 8);

    // Check if custom alias already exists
    if (customAlias) {
      const existingLink = await db.getLinkByShortCode(shortCode);
      if (existingLink) {
        return res.status(400).json({ error: 'Custom alias already exists' });
      }
    }

    // Create link in database with user ID
    const createdLink = await db.createLink(shortCode, fullUrl, userId, customAlias);

    // Cache the link in Redis for fast lookups
    await redisService.cacheLink(shortCode, {
      id: createdLink.id,
      originalUrl: fullUrl,
      isActive: true,
      userId: userId,
    });

    // Index the link in Elasticsearch for search
    await elasticsearchService.indexLink({
      id: createdLink.id,
      shortCode,
      originalUrl: fullUrl,
      userId,
      clickCount: 0,
      isActive: true,
      createdAt: createdLink.created_at,
    });

    console.log(
      `📝 STORED IN DB: ${shortCode} -> ${fullUrl} (ID: ${createdLink.id}, User: ${userId})`,
    );
    console.log(`💾 CACHED IN REDIS: ${shortCode}`);
    console.log(`🔍 INDEXED IN ELASTICSEARCH: ${shortCode}`);

    res.json({
      success: true,
      shortCode,
      shortUrl: `http://localhost:4000/${shortCode}`,
      originalUrl: fullUrl,
      message: 'Link created and cached successfully!',
      linkId: createdLink.id,
    });
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Get user's links (protected route)
app.get('/api/links/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const links = await db.getUserLinks(userId);

    res.json({
      totalLinks: links.length,
      links: links.map(link => ({
        id: link.id,
        shortCode: link.short_code,
        originalUrl: link.original_url,
        clickCount: link.click_count,
        createdAt: link.created_at,
        isActive: link.is_active,
      })),
    });
  } catch (error) {
    console.error('Get user links error:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// =================== REDIRECT ROUTE ===================

// High-performance redirect with Redis caching
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Ignore favicon and other static files
    if (shortCode === 'favicon.ico' || shortCode.includes('.')) {
      return res.status(404).end();
    }

    console.log(`🔍 Looking up shortCode: ${shortCode}`);

    // Try Redis cache first (super fast)
    let linkData = await redisService.getCachedLink(shortCode);

    if (!linkData) {
      // Cache miss - fallback to database
      console.log(`💔 Cache miss, checking database: ${shortCode}`);
      linkData = await db.getLinkByShortCode(shortCode);

      if (!linkData) {
        console.log(`❌ Shortlink not found: ${shortCode}`);
        return res.status(404).json({
          error: 'Shortlink not found',
          shortCode,
        });
      }

      // Cache the result for next time
      await redisService.cacheLink(shortCode, {
        id: linkData.id,
        originalUrl: linkData.original_url,
        isActive: linkData.is_active,
        userId: linkData.user_id,
      });

      console.log(`💾 Cached link from DB: ${shortCode}`);
    }

    // Check if link is active
    if (!linkData.isActive) {
      console.log(`⚠️ Link is inactive: ${shortCode}`);
      return res.status(410).json({
        error: 'Link is no longer active',
        shortCode,
      });
    }

    console.log(`🔗 FOUND LINK:`, {
      shortCode,
      originalUrl: linkData.originalUrl,
      source: linkData.id ? 'cache' : 'database',
    });

    // Get client info for analytics
    const clientIP =
      req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers['referer'] || null;

    // Async analytics (don't wait for these)
    Promise.all([
      // Log click for database analytics
      db.logClick(linkData.id, clientIP, userAgent, referrer),
      // Increment database click count
      db.incrementClickCount(linkData.id),
      // Track in Redis for real-time analytics
      redisService.incrementClickCount(shortCode),
      // Track popular links
      redisService.trackPopularLink(shortCode),
      // Log analytics event in Redis
      redisService.logAnalytics('click', {
        shortCode,
        ip: clientIP,
        userAgent,
        referrer,
      }),
      // Log click in Elasticsearch for advanced analytics
      elasticsearchService.logClick({
        shortCode,
        linkId: linkData.id,
        ipAddress: clientIP,
        userAgent,
        referrer,
        clickedAt: new Date(),
      }),
    ]).catch(err => console.error('Analytics logging failed:', err));

    console.log(`🚀 REDIRECTING TO: ${linkData.originalUrl}`);

    // Redirect to the actual URL
    return res.redirect(302, linkData.originalUrl);
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =================== ANALYTICS ROUTES ===================

// Get analytics for a link
app.get('/api/analytics/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const linkData = await db.getLinkByShortCode(shortCode);
    if (!linkData) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Get both database and Redis analytics
    const [dbAnalytics, redisClickCount] = await Promise.all([
      db.getLinkAnalytics(linkData.id),
      redisService.getClickCount(shortCode),
    ]);

    res.json({
      shortCode,
      ...dbAnalytics,
      realTimeClicks: redisClickCount,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Get popular links
app.get('/api/analytics/popular/links', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const popularLinks = await redisService.getPopularLinks(limit);

    // Get additional details from database
    const enrichedLinks = await Promise.all(
      popularLinks.map(async item => {
        const linkData = await db.getLinkByShortCode(item.shortCode);
        return {
          shortCode: item.shortCode,
          score: item.score,
          originalUrl: linkData?.original_url || 'Unknown',
          totalClicks: linkData?.click_count || 0,
          createdAt: linkData?.created_at,
        };
      }),
    );

    res.json({
      popularLinks: enrichedLinks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Popular links error:', error);
    res.status(500).json({ error: 'Failed to get popular links' });
  }
});

// Search links with Elasticsearch
app.get('/api/search/links', authenticateToken, async (req, res) => {
  try {
    const { q, page = 1, limit = 10, tags, dateFrom, dateTo } = req.query;
    const userId = req.user.userId;

    const filters = {
      userId,
      isActive: true,
    };

    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags];
    }

    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const results = await elasticsearchService.searchLinks(
      q,
      filters,
      parseInt(page),
      parseInt(limit),
    );

    res.json({
      query: q,
      results: results.hits,
      total: results.total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(results.total / parseInt(limit)),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get advanced analytics from Elasticsearch
app.get('/api/analytics/advanced/:shortCode?', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { dateFrom, dateTo } = req.query;

    const filters = {};
    if (shortCode) filters.shortCode = shortCode;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const analytics = await elasticsearchService.getClickAnalytics(filters);

    res.json({
      shortCode: shortCode || 'all',
      analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Advanced analytics error:', error);
    res.status(500).json({ error: 'Failed to get advanced analytics' });
  }
});

// =================== ERROR HANDLERS ===================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// =================== GRACEFUL SHUTDOWN ===================

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await db.close();
  process.exit(0);
});

// =================== START SERVER ===================

// Start server
const startServer = async () => {
  await initializeApp();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API test: http://localhost:${PORT}/api/test`);
    console.log(`🐛 Debug links: http://localhost:${PORT}/api/links/debug`);
    console.log(`⚙️ Setup status: http://localhost:${PORT}/api/setup/status`);
    console.log(`📈 Analytics: http://localhost:${PORT}/api/analytics/[shortcode]`);
  });
};

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
