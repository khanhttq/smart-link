// domains/admin/index.js
const adminRoutes = require('./routes/adminRoutes');
const adminController = require('./controllers/AdminController');

module.exports = {
  routes: adminRoutes,
  controllers: {
    admin: adminController
  }
};