// domains/links/routes/linkRoutes.js
const express = require('express');
const linkController = require('../controllers/LinkController');
const router = express.Router();

// CRUD routes cho links
router.post('/', linkController.create);
router.get('/stats', linkController.stats); // Must be before /:id route
router.get('/', linkController.list);
router.get('/:id', linkController.get);
router.put('/:id', linkController.update);
router.delete('/:id', linkController.delete);
router.get('/:id/analytics', linkController.analytics);

module.exports = router;