// domains/links/routes/redirectRoutes.js
const express = require('express');
const redirectController = require('../controllers/RedirectController');
const router = express.Router();

// Redirect route
router.get('/preview/:shortCode', redirectController.preview);

router.get('/:shortCode', redirectController.handleRedirect);

module.exports = router;