// domains/links/index.js
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');

module.exports = {
  routes: {
    main: linkRoutes,      // /api/links/*
    redirect: redirectRoutes // /:shortCode
  },
  services: null,        // Sẽ setup sau
  controllers: null,     // Sẽ setup sau
  repositories: null     // Sẽ setup sau
};