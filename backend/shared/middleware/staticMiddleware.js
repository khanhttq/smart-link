// backend/shared/middleware/staticMiddleware.js - NEW
const path = require('path');
const fs = require('fs');

/**
 * Handle static files like favicon.ico, robots.txt, etc.
 * This prevents them from being processed as shortCodes
 */
const staticMiddleware = (req, res, next) => {
  const { path: requestPath } = req;
  
  // List of static files that should be handled separately
  const staticFiles = [
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known',
    '/apple-touch-icon',
    '/manifest.json',
    '/service-worker.js'
  ];
  
  // Check if request is for a static file
  const isStaticFile = staticFiles.some(file => 
    requestPath.startsWith(file) || 
    requestPath.includes('.') && !requestPath.includes('/')
  );
  
  if (isStaticFile) {
    // Handle favicon specifically
    if (requestPath === '/favicon.ico') {
      // Check if favicon exists in public folder
      const faviconPath = path.join(__dirname, '../../public/favicon.ico');
      
      if (fs.existsSync(faviconPath)) {
        return res.sendFile(faviconPath);
      } else {
        // Return a simple 204 No Content for favicon
        return res.status(204).end();
      }
    }
    
    // Handle robots.txt
    if (requestPath === '/robots.txt') {
      return res.type('text/plain').send(`User-agent: *
Disallow: /api/
Disallow: /admin/
Allow: /

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
    }
    
    // For other static files, return 404
    return res.status(404).json({
      success: false,
      message: 'Static file not found',
      path: requestPath
    });
  }
  
  // Not a static file, continue to next middleware
  next();
};

module.exports = staticMiddleware;