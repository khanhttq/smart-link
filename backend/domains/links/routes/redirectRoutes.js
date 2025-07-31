// domains/links/routes/redirectRoutes.js
const express = require('express');
const router = express.Router();

// Redirect route
router.get('/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  
  // Tạm thời return info, chưa redirect thật
  res.json({
    message: 'Redirect endpoint',
    status: 'coming_soon',
    shortCode: shortCode,
    note: 'Will redirect to original URL'
  });
});

module.exports = router;