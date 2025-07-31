// domains/links/routes/linkRoutes.js
const express = require('express');
const router = express.Router();

// CRUD routes cho links
router.post('/', (req, res) => {
  res.json({
    message: 'Create shortlink endpoint',
    status: 'coming_soon',
    body: req.body
  });
});

router.get('/', (req, res) => {
  res.json({
    message: 'List links endpoint',
    status: 'coming_soon',
    query: req.query
  });
});

router.get('/:id', (req, res) => {
  res.json({
    message: 'Get single link endpoint',
    status: 'coming_soon',
    id: req.params.id
  });
});

router.put('/:id', (req, res) => {
  res.json({
    message: 'Update link endpoint',
    status: 'coming_soon',
    id: req.params.id,
    body: req.body
  });
});

router.delete('/:id', (req, res) => {
  res.json({
    message: 'Delete link endpoint',
    status: 'coming_soon',
    id: req.params.id
  });
});

module.exports = router;