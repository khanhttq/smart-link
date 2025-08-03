// backend/domains/links/routes/domainRoutes.js
const express = require('express');
const domainController = require('../controllers/DomainController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

// Import rate limiting từ security domain
const securityDomain = require('../../security');
const {
  generalLimiter,
  createLinkLimiter
} = securityDomain.middleware.rateLimiter;

const router = express.Router();

// ===== MIDDLEWARE =====
// All domain routes require authentication
router.use(authMiddleware.verifyToken);

// ===== DOMAIN MANAGEMENT ROUTES =====

/**
 * GET /api/domains
 * Get user's domains with pagination
 */
router.get('/', 
  generalLimiter,
  domainController.getUserDomains
);

/**
 * POST /api/domains
 * Add new custom domain
 */
router.post('/', 
  createLinkLimiter, // Use same rate limit as link creation
  domainController.addDomain
);

/**
 * GET /api/domains/available
 * Check domain availability
 */
router.get('/available',
  generalLimiter,
  domainController.checkAvailability
);

/**
 * GET /api/domains/:id
 * Get specific domain details and stats
 */
router.get('/:id',
  generalLimiter,
  domainController.getDomain
);

/**
 * PUT /api/domains/:id
 * Update domain settings
 */
router.put('/:id',
  generalLimiter,
  domainController.updateDomain
);

/**
 * DELETE /api/domains/:id
 * Delete domain (soft delete)
 */
router.delete('/:id',
  generalLimiter,
  domainController.deleteDomain
);

/**
 * POST /api/domains/:id/verify
 * Verify domain ownership via DNS
 */
router.post('/:id/verify',
  generalLimiter,
  domainController.verifyDomain
);

/**
 * GET /api/domains/:id/verification
 * Get verification instructions
 */
router.get('/:id/verification',
  generalLimiter,
  domainController.getVerificationInstructions
);

// ===== ADMIN/SYSTEM ROUTES =====

/**
 * POST /api/domains/reset-usage
 * Reset monthly usage for all domains (admin/cron only)
 * TODO: Add admin middleware when implemented
 */
router.post('/reset-usage',
  // adminMiddleware.requireAdmin, // TODO: Implement admin middleware
  domainController.resetMonthlyUsage
);

module.exports = router;