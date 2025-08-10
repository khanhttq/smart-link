// backend/domains/security/middleware/corsConfig.js
// Enhanced CORS configuration that handles mixed environments

const getCorsConfig = (environment = process.env.NODE_ENV || 'development') => {
  const isDevelopment = environment === 'development';
  const isProduction = environment === 'production';
  const frontendUrl = process.env.FRONTEND_URL;

  console.log(`🔧 CORS Environment: ${environment}`);
  console.log(`🔧 Frontend URL: ${frontendUrl}`);

  // Always include development origins if FRONTEND_URL is localhost
  const includeDevOrigins = !isProduction || (frontendUrl && frontendUrl.includes('localhost'));

  let allowedOrigins = [];

  // Development origins
  if (isDevelopment || includeDevOrigins) {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://[::1]:3000',
      'http://localhost:5173',
      'http://localhost:8080'
    );
  }

  // Production origins
  if (isProduction) {
    allowedOrigins.push(
      'https://shortlink.com',
      'https://www.shortlink.com',
      'https://app.shortlink.com',
      'https://admin.shortlink.com'
    );
  }

  // Add FRONTEND_URL if specified and not already included
  if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }

  // Remove duplicates and undefined values
  allowedOrigins = [...new Set(allowedOrigins.filter(Boolean))];

  console.log(`🔧 Allowed Origins: ${allowedOrigins.join(', ')}`);

  return {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-ID'],
    maxAge: isDevelopment ? 600 : 86400, // 10 minutes in dev, 24 hours in prod
    optionsSuccessStatus: 200,
  };
};

module.exports = {
  getCorsConfig,
};
