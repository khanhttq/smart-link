// backend/domains/security/middleware/securityHeaders.js
const helmet = require('helmet');

// ===== CONTENT SECURITY POLICY =====
const getCSPDirectives = (isDevelopment = false) => {
  const baseDirectives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    blockAllMixedContent: [],
    fontSrc: ["'self'", "https:", "data:"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"], // Prevent clickjacking
    imgSrc: [
      "'self'", 
      "data:", 
      "https:",
      "blob:",
      // Allow QR code generation services
      "https://api.qrserver.com",
      "https://chart.googleapis.com"
    ],
    objectSrc: ["'none'"],
    scriptSrc: [
      "'self'",
      // Only allow specific CDNs for production
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net"
    ],
    scriptSrcAttr: ["'none'"],
    styleSrc: [
      "'self'", 
      "https:", 
      "'unsafe-inline'" // Required for some UI libraries
    ],
    connectSrc: [
      "'self'",
      // API endpoints
      "https://api.shortlink.com", // Your production API
      // Analytics and monitoring
      "https://*.sentry.io",
      "https://api.mixpanel.com"
    ],
    mediaSrc: ["'self'"],
    workerSrc: ["'self'"],
    upgradeInsecureRequests: []
  };

  // Development specific allowances
  if (isDevelopment) {
    baseDirectives.scriptSrc.push(
      "'unsafe-eval'", // For dev tools and HMR
      "http://localhost:*",
      "ws://localhost:*"
    );
    baseDirectives.connectSrc.push(
      "http://localhost:*",
      "ws://localhost:*",
      "wss://localhost:*"
    );
    baseDirectives.styleSrc.push("'unsafe-inline'");
  }

  return baseDirectives;
};

// ===== SECURITY HEADERS CONFIGURATION =====
const getSecurityHeadersConfig = (environment = 'development') => {
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';

  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: getCSPDirectives(isDevelopment),
      reportOnly: isDevelopment, // Only report in dev, enforce in prod
      ...(isProduction && {
        reportUri: '/api/security/csp-report' // CSP violation reporting endpoint
      })
    },

    // Cross-Origin Policies
    crossOriginEmbedderPolicy: {
      policy: "credentialless" // More permissive than "require-corp"
    },
    crossOriginOpenerPolicy: {
      policy: "same-origin-allow-popups" // Allow OAuth popups
    },
    crossOriginResourcePolicy: {
      policy: "cross-origin" // Allow cross-origin requests
    },

    // HTTP Strict Transport Security (HSTS)
    strictTransportSecurity: {
      maxAge: isProduction ? 31536000 : 0, // 1 year in production, disabled in dev
      includeSubDomains: isProduction,
      preload: isProduction
    },

    // Other security headers
    referrerPolicy: {
      policy: ["origin-when-cross-origin", "strict-origin-when-cross-origin"]
    },

    // Disable X-Powered-By header
    hidePoweredBy: true,

    // X-Content-Type-Options
    noSniff: true,

    // X-Frame-Options (backup for frame-ancestors CSP)
    frameguard: {
      action: 'deny'
    },

    // X-XSS-Protection (legacy, but still useful for older browsers)
    xssFilter: {
      setOnOldIE: true
    },

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // X-Download-Options (IE only)
    ieNoOpen: true,

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: "none"
    }
  };
};

// ===== CUSTOM SECURITY HEADERS =====
const customSecurityHeaders = (req, res, next) => {
  // Security headers not covered by Helmet
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Request-ID', req.id || 'unknown');
  
  // Cache control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // CSRF protection header
  res.setHeader('X-CSRF-Protection', '1; mode=block');

  // Feature policy / Permissions policy
  res.setHeader('Permissions-Policy', [
    'geolocation=()', // Block geolocation
    'microphone=()', // Block microphone
    'camera=()', // Block camera
    'payment=()', // Block payment API
    'usb=()', // Block USB API
    'magnetometer=()', // Block magnetometer
    'accelerometer=()', // Block accelerometer
    'gyroscope=()', // Block gyroscope
    'autoplay=()', // Block autoplay
    'encrypted-media=()', // Block encrypted media
    'picture-in-picture=(self)' // Allow picture-in-picture for same origin
  ].join(', '));

  // Server information hiding
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

// ===== CSP VIOLATION REPORTING =====
const cspViolationReporter = (req, res, next) => {
  if (req.path === '/api/security/csp-report' && req.method === 'POST') {
    console.log('🚨 CSP Violation Report:', {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      report: req.body
    });

    // Log to security monitoring service
    // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
    
    return res.status(204).end();
  }
  next();
};

// ===== MAIN SECURITY HEADERS MIDDLEWARE =====
const createSecurityHeadersMiddleware = (environment = 'development') => {
  const config = getSecurityHeadersConfig(environment);
  
  return [
    // Helmet with enhanced configuration
    helmet(config),
    
    // Custom security headers
    customSecurityHeaders,
    
    // CSP violation reporting
    cspViolationReporter
  ];
};

module.exports = {
  createSecurityHeadersMiddleware,
  getCSPDirectives,
  getSecurityHeadersConfig,
  customSecurityHeaders,
  cspViolationReporter
};