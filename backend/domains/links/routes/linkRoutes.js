// backend/domains/links/routes/linkRoutes.js - SIMPLIFIED VERSION
const express = require('express');
const linkController = require('../controllers/LinkController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// Import rate limiting từ security domain  
const securityDomain = require('../../security');
const { createLinkLimiter } = securityDomain.middleware.rateLimiter;

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware.verifyToken);

// ===== WORKING ROUTES (confirmed methods exist) =====

// Get user stats
router.get('/stats', linkController.stats);

// Create new short link with rate limiting
router.post('/', 
  createLinkLimiter,  // 20 links per minute
  linkController.create
);

// Get user's links with pagination
router.get('/', linkController.list);

// Get specific link details
router.get('/:id', linkController.getById);

// Update link
router.put('/:id', linkController.update);

// Delete link
router.delete('/:id', linkController.delete);

// Get link analytics
router.get('/:id/analytics', linkController.analytics);

// ===== TODO: IMPLEMENT THESE FEATURES LATER =====
/*
// Bulk operations
router.post('/bulk-delete',
  authMiddleware.verifyToken,
  linkController.bulkDeleteLinks
);

router.post('/bulk-update',
  authMiddleware.verifyToken,
  linkController.bulkUpdateLinks
);

// Toggle link status (active/inactive)
router.patch('/:linkId/toggle',
  authMiddleware.verifyToken,
  linkController.toggleLinkStatus
);

// Set link expiration
router.patch('/:linkId/expiration',
  authMiddleware.verifyToken,
  linkController.setLinkExpiration
);

// Set link password protection
router.patch('/:linkId/password',
  authMiddleware.verifyToken,
  linkController.setLinkPassword
);

// Remove link password
router.delete('/:linkId/password',
  authMiddleware.verifyToken,
  linkController.removeLinkPassword
);

// Get link click history
router.get('/:linkId/clicks',
  authMiddleware.verifyToken,
  linkController.getLinkClicks
);

// Export link analytics
router.get('/:linkId/export',
  authMiddleware.verifyToken,
  linkController.exportLinkAnalytics
);

// Generate QR code for link
router.get('/:linkId/qr',
  authMiddleware.verifyToken,
  linkController.generateQRCode
);

// Get link metadata (title, description, image) - with optional auth
router.get('/meta/:shortCode',
  authMiddleware.optionalAuth,
  linkController.getLinkMetadata
);

// Get public link info (for preview, social sharing, etc.)
router.get('/info/:shortCode', linkController.getLinkInfo);
*/

module.exports = router;