// domains/auth/services/OAuthService.js
const { urlValidatorInstance } = require('../../../config/axios');
const oauthConfig = require('../config/oauth');

class OAuthService {
  // Generate Google OAuth URL
  generateGoogleAuthUrl(state) {
    // For testing, return a mock URL if no real Google credentials
    if (!oauthConfig.google.clientId || oauthConfig.google.clientId === 'your-google-client-id') {
      return 'https://accounts.google.com/o/oauth2/v2/auth?client_id=mock&redirect_uri=mock&scope=email%20profile&response_type=code&access_type=offline&prompt=consent';
    }

    const params = new URLSearchParams({
      client_id: oauthConfig.google.clientId,
      redirect_uri: oauthConfig.google.redirectUri,
      scope: oauthConfig.google.scope.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: state || ''
    });

    return `${oauthConfig.urls.google.auth}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code) {
    try {
      // Mock response for testing
      if (!oauthConfig.google.clientId || oauthConfig.google.clientId === 'your-google-client-id') {
        return {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600
        };
      }

      const response = await urlValidatorInstance.post(oauthConfig.urls.google.token, {
        client_id: oauthConfig.google.clientId,
        client_secret: oauthConfig.google.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: oauthConfig.google.redirectUri
      });

      return response.data;
    } catch (error) {
      console.error('Token exchange error:', error.response?.data);
      throw new Error('Failed to exchange authorization code');
    }
  }

  // Get user info from Google
  async getGoogleUserInfo(accessToken) {
    try {
      // Mock response for testing
      if (accessToken === 'mock_access_token') {
        return {
          id: 'mock_google_id_123',
          email: 'mockuser@gmail.com',
          name: 'Mock Google User',
          picture: 'https://via.placeholder.com/150'
        };
      }

      const response = await urlValidatorInstance.get(oauthConfig.urls.google.userInfo, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Get user info error:', error.response?.data);
      throw new Error('Failed to get user information');
    }
  }

  // Complete Google OAuth flow
  async completeGoogleAuth(code) {
    try {
      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(code);
      
      // Get user info
      const userInfo = await this.getGoogleUserInfo(tokenData.access_token);
      
      return {
        googleUser: userInfo,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token
      };
    } catch (error) {
      throw new Error(`OAuth authentication failed: ${error.message}`);
    }
  }
}

module.exports = new OAuthService();