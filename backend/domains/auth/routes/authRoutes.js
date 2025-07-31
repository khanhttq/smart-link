// domains/auth/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Basic auth routes
router.post('/register', (req, res) => {
  res.json({
    message: 'Register endpoint',
    status: 'coming_soon',
    body: req.body
  });
});

router.post('/login', (req, res) => {
  res.json({
    message: 'Login endpoint',
    status: 'coming_soon',
    body: req.body
  });
});

router.post('/logout', (req, res) => {
  res.json({
    message: 'Logout endpoint',
    status: 'coming_soon'
  });
});

router.get('/me', (req, res) => {
  res.json({
    message: 'Get current user endpoint',
    status: 'coming_soon'
  });
});

module.exports = router;