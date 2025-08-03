// domains/links/routes/redirectRoutes.js - UPDATED with static middleware
const express = require('express');
const redirectController = require('../controllers/RedirectController');
const staticMiddleware = require('../../../shared/middleware/staticMiddleware');
const router = express.Router();

// ✅ FIX: Add static middleware to handle favicon.ico and other static files
router.use(staticMiddleware);

// Preview route (should come before the general shortCode route)
router.get('/preview/:shortCode', redirectController.preview);

// Password submission route
router.post('/:shortCode/password', redirectController.handlePasswordSubmission);

// Main redirect route (this should be last to catch all remaining shortCodes)
router.get('/:shortCode', redirectController.handleRedirect);

module.exports = router;