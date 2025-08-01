// domains/links/routes/linkRoutes.js
const express = require('express');
const linkController = require('../controllers/LinkController');
const authMiddleware = require('../../auth/middleware/authMiddleware');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Routes - THỨ TỰ QUAN TRỌNG: specific routes trước, dynamic routes sau
router.get('/stats', linkController.stats);         // GET /api/links/stats
router.post('/', linkController.create);            // POST /api/links
router.get('/', linkController.list);               // GET /api/links
router.get('/:id/analytics', linkController.analytics); // GET /api/links/:id/analytics
router.get('/:id', linkController.getById);         // GET /api/links/:id
router.put('/:id', linkController.update);          // PUT /api/links/:id
router.delete('/:id', linkController.delete);       // DELETE /api/links/:id

module.exports = router;