// frontend/src/utils/apiClient.js - FIXED VERSION  
import axios from 'axios';
import { message } from 'antd';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// ===== PREVENT REFRESH LOOP VARIABLES =====
let isRefreshing = false;
let failedQueue = [];

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

// ✅ CREATE SINGLE AXIOS INSTANCE
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ✅ REQUEST INTERCEPTOR - Đồng bộ với authStore
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add timestamp to prevent caching (only for non-refresh requests)
    //if (!config.url.includes('/refresh')) {
      //if (!config.params) config.params = {};
      //config.params._t = Date.now();
    //}
    
    // ✅ CRITICAL FIX: Đọc token từ authStore format thống nhất
    if (!config.headers.Authorization) {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        try {
          const { state } = JSON.parse(authStorage);
          
          // ✅ Sử dụng field "token" thống nhất với authStore
          if (state?.token) {
            config.headers.Authorization = `Bearer ${state.token}`;
            console.log(`✅ Added Authorization header: Bearer ${state.token.substring(0, 10)}...`);
          }
        } catch (error) {
          console.error('❌ Error parsing auth storage:', error);
        }
      }
    }
    
    return config;
  },
  (error) => {
    console.error('🚨 Request error:', error);
    return Promise.reject(error);
  }
);

// ✅ RESPONSE INTERCEPTOR - Simplified refresh logic  
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // ✅ Skip refresh for specific errors
    if (
      error.response?.status === 401 &&
      (originalRequest.url.includes('/api/auth/login') ||
       originalRequest.url.includes('/api/auth/register') ||
       error.response?.data?.code === 'INVALID_PASSWORD' ||
       error.response?.data?.code === 'USER_NOT_FOUND')
    ) {
      console.log(`⏭️ Skipping refresh for: ${error.response?.data?.code} on ${originalRequest.url}`);
      return Promise.reject(error);
    }

    // ✅ Handle 401 with refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If already refreshing, queue this request
      if (isRefreshing) {
        try {
          const token = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          });
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (err) {
          return Promise.reject(err);
        }
      }

      // Start refresh process
      isRefreshing = true;

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

        console.log('🔄 Attempting token refresh...');
        
        // ✅ Use fetch to avoid interceptor loop
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken })
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Refresh request failed');
        }
        
        const refreshData = await refreshResponse.json();
        const { tokens } = refreshData.data;
        
        // ✅ Update localStorage with new tokens (match authStore format)
        const newAuthData = {
          ...JSON.parse(authStorage),
          state: {
            ...state,
            token: tokens.accessToken,              // ✅ Thống nhất với authStore  
            refreshToken: tokens.refreshToken
          }
        };
        
        localStorage.setItem('auth-storage', JSON.stringify(newAuthData));
        
        // ✅ Update global axios headers
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
        
        // Clear auth and redirect
        clearAuthAndRedirect();
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ✅ HELPER: Clear auth and redirect
const clearAuthAndRedirect = () => {
  console.log('🧹 Clearing auth and redirecting to login...');
  
  try {
    localStorage.removeItem('auth-storage');
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
  
  // Clear axios headers
  delete apiClient.defaults.headers.common['Authorization'];
  
  // Show message and redirect
  message.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
  
  // Force redirect
  setTimeout(() => {
    window.location.href = '/login';
  }, 1000);
};

export default apiClient;