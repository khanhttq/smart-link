// domains/links/index.js
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const linkController = require('./controllers/LinkController');
const redirectController = require('./controllers/RedirectController');
const linkService = require('./services/LinkService');
const linkRepository = require('./repositories/LinkRepository');

module.exports = {
  routes: {
    main: linkRoutes,      // /api/links/*
    redirect: redirectRoutes // /:shortCode
  },
  controllers: {
    link: linkController,
    redirect: redirectController
  },
  services: {
    link: linkService
  },
  repositories: {
    link: linkRepository
  }
};