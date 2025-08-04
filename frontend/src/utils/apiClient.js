// frontend/src/utils/apiClient.js - ES6 Enhanced with Modern JavaScript
import axios from 'axios';

// ===== ES6 CONSTANTS =====
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const TOKEN_STORAGE_KEY = 'auth_state';
const MAX_RETRY_ATTEMPTS = 3;
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ===== ES6 CLASS FOR TOKEN MANAGEMENT =====
class TokenManager {
  static getAuthState() {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('❌ Error parsing auth storage:', error);
      return null;
    }
  }

  static getToken() {
    const authState = this.getAuthState();
    return authState?.token || null;
  }

  static setAuthState(authState) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(authState));
    } catch (error) {
      console.error('❌ Error saving auth state:', error);
    }
  }

  static clearAuthState() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  static isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Date.now() / 1000;
      return payload.exp < now;
    } catch {
      return true;
    }
  }
}

// ===== ES6 ERROR CLASSES =====
class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class NetworkError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

// ===== ES6 RETRY LOGIC =====
const retryRequest = async (requestFn, maxAttempts = MAX_RETRY_ATTEMPTS) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) except 401
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 401) {
        break;
      }
      
      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ API retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// ===== AXIOS INSTANCE WITH ES6 CONFIG =====
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== ES6 REFRESH TOKEN QUEUE =====
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  
  failedQueue = [];
};

// ===== ES6 REQUEST INTERCEPTOR =====
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    
    if (token && !TokenManager.isTokenExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`✅ Added Authorization header: Bearer ${token.substring(0, 10)}...`);
    }
    
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('🚨 Request interceptor error:', error);
    return Promise.reject(new NetworkError('Request setup failed', error));
  }
);

// ===== ES6 RESPONSE INTERCEPTOR WITH ASYNC/AWAIT =====
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config?.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle network errors
    if (!error.response) {
      const networkError = new NetworkError(
        'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại.',
        error
      );
      return Promise.reject(networkError);
    }

    const { status, data } = error.response;
    
    // Skip refresh for specific auth endpoints
    const skipRefreshUrls = ['/api/auth/login', '/api/auth/register'];
    const skipRefreshCodes = ['INVALID_PASSWORD', 'USER_NOT_FOUND', 'AUTH_USER_NOT_FOUND'];
    
    if (status === 401) {
      if (skipRefreshUrls.some(url => originalRequest.url?.includes(url)) ||
          skipRefreshCodes.includes(data?.code)) {
        console.log(`⏭️ Skipping refresh for: ${data?.code} on ${originalRequest.url}`);
        return Promise.reject(new ApiError(
          data?.message || 'Authentication failed',
          status,
          data?.code,
          data
        ));
      }

      // Handle token refresh
      if (!originalRequest._retry) {
        originalRequest._retry = true;

        if (isRefreshing) {
          try {
            const token = await new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            });
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        }

        isRefreshing = true;

        try {
          const refreshResponse = await retryRequest(async () => {
            return apiClient.post('/api/auth/refresh', {}, {
              headers: {
                Authorization: `Bearer ${TokenManager.getToken()}`
              }
            });
          });

          const { token: newToken, user } = refreshResponse.data.data;
          const newAuthState = { token: newToken, user };
          
          TokenManager.setAuthState(newAuthState);
          apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          
          console.log('✅ Token refreshed successfully');
          return apiClient(originalRequest);
          
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          
          // Clear auth state and redirect to login
          TokenManager.clearAuthState();
          delete apiClient.defaults.headers.common.Authorization;
          
          processQueue(refreshError, null);
          
          // Dispatch logout event
          window.dispatchEvent(new CustomEvent('auth:logout', {
            detail: { reason: 'token_refresh_failed' }
          }));
          
          return Promise.reject(new ApiError(
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            401,
            'TOKEN_REFRESH_FAILED'
          ));
        } finally {
          isRefreshing = false;
        }
      }
    }

    // Handle other HTTP errors
    const apiError = new ApiError(
      data?.message || `HTTP ${status} Error`,
      status,
      data?.code || `HTTP_${status}`,
      data
    );

    console.error(`❌ API Error: ${status} ${originalRequest?.url}`, apiError);
    return Promise.reject(apiError);
  }
);

// ===== ES6 ENHANCED API METHODS =====
class ApiService {
  // Generic request method with retry logic
  static async request(config) {
    return retryRequest(() => apiClient(config));
  }

  // GET with query params support
  static async get(url, params = {}, config = {}) {
    return this.request({
      ...config,
      method: 'GET',
      url,
      params
    });
  }

  // POST with data
  static async post(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'POST',
      url,
      data
    });
  }

  // PUT with data
  static async put(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'PUT',
      url,
      data
    });
  }

  // DELETE
  static async delete(url, config = {}) {
    return this.request({
      ...config,
      method: 'DELETE',
      url
    });
  }

  // PATCH with data
  static async patch(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'PATCH',
      url,
      data
    });
  }

  // Upload file with progress
  static async upload(url, formData, onProgress = null) {
    return this.request({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    });
  }

  // Download binary data
  static async download(url, filename = null) {
    const response = await this.request({
      method: 'GET',
      url,
      responseType: 'blob'
    });

    if (filename && response.data) {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }

    return response;
  }
}

// ===== ES6 ANALYTICS API METHODS =====
export const analyticsApi = {
  // Get dashboard analytics
  async getDashboard(period = '30d') {
    const response = await ApiService.get('/api/analytics/dashboard', { period });
    return response.data;
  },

  // Get link analytics with enhanced error handling
  async getLinkAnalytics(linkId, period = '7d') {
    if (!linkId) {
      throw new ApiError('Link ID is required', 400, 'MISSING_LINK_ID');
    }

    try {
      const response = await ApiService.get(`/api/analytics/links/${linkId}`, { period });
      return response.data;
    } catch (error) {
      // Handle ElasticSearch service unavailable
      if (error.status === 503 && error.details?.fallback) {
        console.warn('⚠️ Analytics service temporarily unavailable, using fallback data');
        // Could implement fallback logic here or let component handle it
      }
      throw error;
    }
  },

  // Export analytics data
  async exportAnalytics(linkId, period = '7d', format = 'json') {
    const response = await ApiService.get(`/api/analytics/export/${linkId}`, { 
      period, 
      format 
    }, {
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  },

  // Get real-time analytics
  async getRealTimeAnalytics(linkId, minutes = 60) {
    const response = await ApiService.get(`/api/analytics/real-time/${linkId}`, { minutes });
    return response.data;
  },

  // Get analytics trends
  async getTrends(period = '30d') {
    const response = await ApiService.get('/api/analytics/trends', { period });
    return response.data;
  }
};

// ===== ES6 AUTH API METHODS =====
export const authApi = {
  async login(credentials) {
    const response = await ApiService.post('/api/auth/login', credentials);
    
    if (response.data.success) {
      const { token, user } = response.data.data;
      TokenManager.setAuthState({ token, user });
    }
    
    return response.data;
  },

  async register(userData) {
    const response = await ApiService.post('/api/auth/register', userData);
    return response.data;
  },

  async logout() {
    try {
      await ApiService.post('/api/auth/logout');
    } catch (error) {
      // Ignore logout errors, always clear local state
      console.warn('⚠️ Logout request failed, clearing local state anyway');
    } finally {
      TokenManager.clearAuthState();
      delete apiClient.defaults.headers.common.Authorization;
    }
  },

  async refreshToken() {
    const response = await ApiService.post('/api/auth/refresh');
    
    if (response.data.success) {
      const { token, user } = response.data.data;
      TokenManager.setAuthState({ token, user });
    }
    
    return response.data;
  }
};

// ===== ES6 LINKS API METHODS =====
export const linksApi = {
  async getLinks(page = 1, limit = 20, search = '') {
    const response = await ApiService.get('/api/links', { page, limit, search });
    return response.data;
  },

  async createLink(linkData) {
    const response = await ApiService.post('/api/links', linkData);
    return response.data;
  },

  async updateLink(linkId, updateData) {
    const response = await ApiService.put(`/api/links/${linkId}`, updateData);
    return response.data;
  },

  async deleteLink(linkId) {
    const response = await ApiService.delete(`/api/links/${linkId}`);
    return response.data;
  },

  async getStats() {
    const response = await ApiService.get('/api/links/stats');
    return response.data;
  }
};

// ===== ES6 EXPORTS =====
export { 
  apiClient as default, 
  ApiService, 
  TokenManager, 
  ApiError, 
  NetworkError 
};

// ===== BACKWARD COMPATIBILITY =====
// Support for existing code that imports apiClient directly
export { apiClient };