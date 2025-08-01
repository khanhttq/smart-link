// domains/auth/config/oauth.js
const config = require('../../../config');

module.exports = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
    scope: ['email', 'profile']
  },

  // OAuth URLs
  urls: {
    google: {
      auth: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: 'https://oauth2.googleapis.com/token',
      userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo'
    }
  }
};