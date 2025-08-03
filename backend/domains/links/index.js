// backend/domains/links/index.js - UPDATED với Domain Support
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const domainRoutes = require('./routes/domainRoutes'); // ✅ NEW

const linkController = require('./controllers/LinkController');
const redirectController = require('./controllers/RedirectController');
const domainController = require('./controllers/DomainController'); // ✅ NEW

const linkService = require('./services/LinkService');
const domainService = require('./services/DomainService'); // ✅ NEW

const linkRepository = require('./repositories/LinkRepository');

module.exports = {
  routes: {
    main: linkRoutes,         // /api/links/*
    redirect: redirectRoutes, // /:shortCode
    domains: domainRoutes     // ✅ NEW: /api/domains/*
  },
  controllers: {
    link: linkController,
    redirect: redirectController,
    domain: domainController  // ✅ NEW
  },
  services: {
    link: linkService,
    domain: domainService     // ✅ NEW
  },
  repositories: {
    link: linkRepository
  }
};