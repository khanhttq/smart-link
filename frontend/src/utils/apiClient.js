// frontend/src/utils/apiClient.js - FIXED to prevent refresh loop
import axios from 'axios';
import { message } from 'antd';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// ===== PREVENT REFRESH LOOP VARIABLES =====
let isRefreshing = false;
let failedQueue = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 2;

// Process failed queue
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

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add timestamp to prevent caching (only for non-refresh requests)
    if (!config.url.includes('/refresh')) {
      if (!config.params) config.params = {};
      config.params._t = Date.now();
    }
    
    // Add auth token if available
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch (error) {
        console.error('Error parsing auth storage:', error);
      }
    }
    
    return config;
  },
  (error) => {
    console.error('🚨 Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with enhanced refresh logic
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} from ${response.config.url}`);
    
    // Reset refresh attempts on successful request
    if (!response.config.url.includes('/refresh')) {
      refreshAttempts = 0;
    }
    
    return response;
  },
  async (error) => {
    console.error('🚨 API Error:', error);
    
    const originalRequest = error.config;
    
    // ===== PREVENT REFRESH LOOP =====
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Check if this is a refresh endpoint failing
      if (originalRequest.url.includes('/refresh')) {
        console.log('❌ Refresh endpoint failed, clearing auth');
        isRefreshing = false;
        refreshAttempts = 0;
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // Check max refresh attempts
      if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
        console.log('❌ Max refresh attempts reached, clearing auth');
        isRefreshing = false;
        refreshAttempts = 0;
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      // Mark as retry attempt
      originalRequest._retry = true;

      // If already refreshing, queue the request
      if (isRefreshing) {
        console.log('🔄 Already refreshing, queuing request...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      // Start refresh process
      isRefreshing = true;
      refreshAttempts++;

      try {
        const authStorage = localStorage.getItem('auth-storage');
        if (!authStorage) {
          throw new Error('No auth storage found');
        }

        const { state } = JSON.parse(authStorage);
        const refreshToken = state?.refreshToken;
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        console.log(`🔄 Attempting token refresh (attempt ${refreshAttempts}/${MAX_REFRESH_ATTEMPTS})...`);
        
        // ===== IMPORTANT: Use a separate axios instance for refresh =====
        const refreshResponse = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // Shorter timeout for refresh
        });
        
        const { tokens } = refreshResponse.data.data;
        
        // Update localStorage
        const newAuthData = {
          ...JSON.parse(authStorage),
          state: {
            ...state,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            sessionExpiresAt: new Date(Date.now() + (tokens.expiresIn * 1000))
          }
        };
        
        localStorage.setItem('auth-storage', JSON.stringify(newAuthData));
        
        // Update default headers
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        
        // Process queued requests
        processQueue(null, tokens.accessToken);
        
        console.log('✅ Token refreshed successfully');
        
        // Reset refresh state
        isRefreshing = false;
        
        // Retry original request
        return apiClient(originalRequest);
        
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // Process queued requests with error
        processQueue(refreshError, null);
        
        // Reset refresh state
        isRefreshing = false;
        refreshAttempts = MAX_REFRESH_ATTEMPTS; // Prevent further attempts
        
        // Clear auth and redirect
        clearAuthAndRedirect();
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function to clear auth and redirect
const clearAuthAndRedirect = () => {
  console.log('🧹 Clearing auth and redirecting to login...');
  
  // ✅ FIX: Aggressive clear
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
  
  // Clear axios headers
  delete apiClient.defaults.headers.common['Authorization'];
  
  // Show message and redirect
  message.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
  
  // ✅ FIX: Immediate redirect
  window.location.href = '/login';
};
export default apiClient;