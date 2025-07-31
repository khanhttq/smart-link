// domains/auth/index.js
const authRoutes = require('./routes/authRoutes');
module.exports = {
  routes: authRoutes,
  services: null,      // Sẽ setup sau
  middleware: null,    // Sẽ setup sau
  controllers: null    // Sẽ setup sau
};