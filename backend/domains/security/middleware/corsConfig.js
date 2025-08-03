// backend/domains/security/middleware/corsConfig.js

// ===== CORS CONFIGURATION =====
const getCorsConfig = (environment = 'development') => {
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  // Define allowed origins based on environment
  const getAllowedOrigins = () => {
    const baseOrigins = [];

    if (isDevelopment) {
      baseOrigins.push(
        'http://localhost:3000',   // React dev server
        'http://localhost:3001',   // Alternative dev port
        'http://127.0.0.1:3000',   // IPv4 localhost
        'http://[::1]:3000',       // IPv6 localhost
        'http://localhost:5173',   // Vite dev server
        'http://localhost:8080'    // Webpack dev server
      );
    }

    if (isProduction) {
      baseOrigins.push(
        'https://shortlink.com',
        'https://www.shortlink.com',
        'https://app.shortlink.com',
        'https://admin.shortlink.com'
      );
    }

    // Add environment-specific origins from env vars
    const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];
    baseOrigins.push(...envOrigins);

    return baseOrigins;
  };

  return {
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (mobile apps, Postman, curl, etc.)
      if (!origin) {
        console.log('ℹ️ Allowing request with no origin');
        return callback(null, true);
      }

      // Check if origin is allowed
      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS allowed for origin: ${origin}`);
        callback(null, true);
      } else {
        console.log(`🚫 CORS blocked for origin: ${origin}`);
        console.log(`🔍 Allowed origins: ${allowedOrigins.join(', ')}`);
        
        const error = new Error(`Origin ${origin} not allowed by CORS policy`);
        error.status = 403;
        callback(error, false);
      }
    },

    // Credentials support (cookies, authorization headers)
    credentials: true,

    // Allowed HTTP methods
    methods: [
      'GET',
      'POST', 
      'PUT', 
      'PATCH',
      'DELETE', 
      'OPTIONS',
      'HEAD'
    ],

    // Allowed headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'X-CSRF-Token',
      'X-Request-ID',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'Cache-Control',
      'Connection',
      'Host',
      'Origin',
      'Referer',
      'User-Agent'
    ],

    // Exposed headers (accessible to frontend)
    exposedHeaders: [
      'X-Request-ID',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
      'Content-Range',
      'Content-Length'
    ],

    // Preflight cache duration (24 hours)
    maxAge: isDevelopment ? 600 : 86400, // 10 minutes in dev, 24 hours in prod

    // Continue to next middleware even if CORS fails
    optionsSuccessStatus: 200, // For legacy browser support (IE11)

    // Preflight handling
    preflightContinue: false
  };
};

// ===== CORS ERROR HANDLER =====
const corsErrorHandler = (err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    console.error('❌ CORS Error:', {
      origin: req.get('Origin'),
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      error: err.message
    });

    return res.status(403).json({
      success: false,
      error: 'CORS_POLICY_VIOLATION',
      message: 'Cross-Origin Request Blocked',
      details: process.env.NODE_ENV === 'development' ? {
        origin: req.get('Origin'),
        message: 'Check ALLOWED_ORIGINS environment variable or update CORS configuration'
      } : undefined
    });
  }
  next(err);
};

// ===== CORS PREFLIGHT OPTIMIZER =====
const corsPreflightOptimizer = (req, res, next) => {
  // Handle preflight requests efficiently
  if (req.method === 'OPTIONS') {
    console.log(`🔍 CORS Preflight: ${req.get('Origin')} → ${req.path}`);
    
    // Add custom preflight headers
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    res.header('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    
    // End preflight request
    return res.status(200).end();
  }
  next();
};

// ===== DYNAMIC CORS FOR WEBHOOKS =====
const createDynamicCors = (allowedDomains = []) => {
  return (req, res, next) => {
    const origin = req.get('Origin');
    
    // Check against dynamic allowed domains
    if (origin && allowedDomains.some(domain => origin.includes(domain))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    next();
  };
};

// ===== CORS SECURITY MONITORING =====
const corsSecurityMonitor = (req, res, next) => {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  
  // Get allowed origins for current environment
  const getAllowedOriginsForMonitoring = () => {
    const baseOrigins = [];
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    if (isDevelopment) {
      baseOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://[::1]:3000',
        'http://localhost:5173',
        'http://localhost:8080'
      );
    }

    if (isProduction) {
      baseOrigins.push(
        'https://shortlink.com',
        'https://www.shortlink.com',
        'https://app.shortlink.com',
        'https://admin.shortlink.com'
      );
    }

    // Add environment-specific origins from env vars
    const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];
    baseOrigins.push(...envOrigins);

    return baseOrigins;
  };
  
  // Log suspicious CORS attempts
  if (origin && !getAllowedOriginsForMonitoring().includes(origin)) {
    console.warn('🚨 Suspicious CORS attempt:', {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      origin,
      referer,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });

    // TODO: Send to security monitoring service
    // securityMonitor.logSuspiciousActivity('cors_violation', { ... });
  }

  next();
};

module.exports = {
  getCorsConfig,
  corsErrorHandler,
  corsPreflightOptimizer,
  createDynamicCors,
  corsSecurityMonitor
};