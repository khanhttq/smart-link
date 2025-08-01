// domains/links/routes/linkRoutes.js
const express = require('express');
const linkController = require('../controllers/LinkController');
const authMiddleware = require('../../auth/middleware/authMiddleware');
const router = express.Router();

// Protected routes (require authentication)
router.post('/', authMiddleware.verifyToken, linkController.create);
router.get('/stats', authMiddleware.verifyToken, linkController.stats);
router.get('/', authMiddleware.verifyToken, linkController.list);
router.get('/:id', authMiddleware.verifyToken, linkController.get);
router.put('/:id', authMiddleware.verifyToken, linkController.update);
router.delete('/:id', authMiddleware.verifyToken, linkController.delete);
router.get('/:id/analytics', authMiddleware.verifyToken, linkController.analytics);

module.exports = router;