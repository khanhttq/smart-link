// frontend/src/stores/authStore.js - COMPLETE FILE WITH SMART AUTH
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { message } from 'antd';
import axios from 'axios';

// ===== API CLIENT SETUP =====
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== ENHANCED ERROR HANDLING =====
const getErrorMessage = (error) => {
  if (!error) return 'Có lỗi không xác định xảy ra';
  
  // Handle network errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Kết nối bị timeout. Vui lòng kiểm tra internet và thử lại';
  }
  
  if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại';
  }

  const errorMessage = error.response?.data?.message || error.message;
  
  // Map backend error codes to user-friendly messages
  switch (errorMessage) {
    case 'USER_NOT_FOUND':
      return 'EMAIL_NOT_REGISTERED';
    case 'INVALID_PASSWORD':
      return 'Mật khẩu không chính xác';
    case 'ACCOUNT_DEACTIVATED':
      return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ';
    case 'OAUTH_USER_NO_PASSWORD':
      return 'Tài khoản này được tạo qua Google. Vui lòng đăng nhập bằng Google';
    case 'Too many login attempts':
    case 'Too many login attempts. Please try again later.':
      return 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút';
    case 'Email already exists':
    case 'User already exists with this email':
      return 'Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác';
    case 'Password must be at least 8 characters with uppercase, lowercase, and number':
      return 'Mật khẩu phải có ít nhất 8 ký tự bao gồm chữ hoa, chữ thường và số';
    case 'Invalid email format':
      return 'Định dạng email không hợp lệ';
    case 'Token has been revoked':
    case 'Token version mismatch - invalidated':
      return 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại';
    case 'Invalid or expired refresh token':
      return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại';
    default:
      return errorMessage || 'Có lỗi không mong muốn xảy ra';
  }
};

// ===== REQUEST/RESPONSE INTERCEPTORS =====
let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (token) => {
  refreshSubscribers.map(callback => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve) => {
          addRefreshSubscriber((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await apiClient.post('/api/auth/refresh', {
          refreshToken: refreshToken
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
        
        // Update store with new tokens
        useAuthStore.setState({
          token: accessToken,
          refreshToken: newRefreshToken,
          lastActivity: new Date()
        });

        // Update default header
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        // Notify all waiting requests
        onRefreshed(accessToken);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);

      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        
        // Force logout on refresh failure
        useAuthStore.getState().logout();
        
        // Redirect to homepage if not already there
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ===== ZUSTAND STORE =====
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ===== CORE STATE =====
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      lastActivity: null,
      sessionExpiresAt: null,

      // ===== SMART AUTH STATE =====
      showRegistrationModal: false,
      registrationData: null,

      // ===== UTILITY FUNCTIONS =====
      getErrorMessage,

      // ===== SMART AUTH FUNCTIONS =====

      // Check if email exists in system
      checkEmailExists: async (email) => {
        try {
          const response = await apiClient.post('/api/auth/check-email', {
            email: email.trim().toLowerCase()
          });
          
          return response.data.data;
        } catch (error) {
          console.error('❌ Check email error:', error);
          return { exists: false, hasPassword: false, isOAuthUser: false };
        }
      },

      // Show smart registration modal
      showSmartRegistration: (email, password) => {
        console.log('🚀 Showing smart registration modal for:', email);
        set({
          showRegistrationModal: true,
          registrationData: { email, password }
        });
      },

      // Hide smart registration modal
      hideSmartRegistration: () => {
        set({
          showRegistrationModal: false,
          registrationData: null
        });
      },

      // ===== AUTHENTICATION FUNCTIONS =====

      // Enhanced login with smart auth
      login: async (email, password) => {
        console.log('🔍 Starting smart login process for:', email);
        
        try {
          set({ loading: true });
          
          // Validation
          if (!email || !password) {
            const error = 'Vui lòng nhập đầy đủ email và mật khẩu';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          // Normalize email
          const normalizedEmail = email.trim().toLowerCase();

          // Attempt login
          const response = await apiClient.post('/api/auth/login', {
            email: normalizedEmail,
            password: password
          });

          const { user, tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;

          // Calculate session expiry
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          // Update API client default headers
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Update store state
          set({ 
            user, 
            token: accessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
            loading: false,
            lastActivity: new Date(),
            sessionExpiresAt,
            // Clear any smart auth modals
            showRegistrationModal: false,
            registrationData: null
          });

          console.log('✅ Login successful for:', user.email);
          message.success(`🎉 Chào mừng ${user.name}!`);
          return { success: true, user, token: accessToken };
          
        } catch (error) {
          console.error('❌ Login error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          
          // Smart auth logic: if email not registered, show registration modal
          if (errorMessage === 'EMAIL_NOT_REGISTERED') {
            console.log('🚀 Email not registered, triggering smart registration...');
            
            // Don't show error message, instead show registration modal
            get().showSmartRegistration(email.trim().toLowerCase(), password);
            
            return { 
              success: false, 
              error: errorMessage,
              showRegistration: true 
            };
          }
          
          // For other errors, show normal error message
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Enhanced register with smart auth
      register: async (userData) => {
        console.log('👤 Registering new user:', userData.email);
        
        try {
          set({ loading: true });
          
          // Validation
          if (!userData.email || !userData.password || !userData.name) {
            const error = 'Vui lòng nhập đầy đủ thông tin';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          // Normalize data
          const normalizedData = {
            email: userData.email.trim().toLowerCase(),
            password: userData.password,
            name: userData.name.trim()
          };

          // Attempt registration
          const response = await apiClient.post('/api/auth/register', normalizedData);

          const { user, tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;

          // Calculate session expiry
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          // Update API client default headers
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Update store state
          set({ 
            user, 
            token: accessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
            loading: false,
            lastActivity: new Date(),
            sessionExpiresAt,
            // Hide registration modal after success
            showRegistrationModal: false,
            registrationData: null
          });

          console.log('✅ Registration successful for:', user.email);
          message.success(`🎉 Chào mừng ${user.name}! Tài khoản đã được tạo thành công`);
          return { success: true, user, token: accessToken };
          
        } catch (error) {
          console.error('❌ Registration error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Enhanced logout
      logout: async (showMessage = true) => {
        console.log('🚪 Logging out user...');
        
        try {
          set({ loading: true });
          
          const { token } = get();
          
          // Call logout API if token exists
          if (token) {
            try {
              await apiClient.post('/api/auth/logout');
              console.log('✅ Server logout successful');
            } catch (error) {
              console.log('⚠️ Server logout failed, proceeding with client logout:', error.message);
            }
          }

        } catch (error) {
          console.error('❌ Logout error:', error);
        } finally {
          // Always clear client state regardless of server response
          delete apiClient.defaults.headers.common['Authorization'];
          
          // Clear all auth data
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            lastActivity: null,
            sessionExpiresAt: null,
            showRegistrationModal: false,
            registrationData: null
          });
          
          if (showMessage) {
            message.info('Đã đăng xuất thành công');
          }
          
          // Redirect to homepage after logout
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
          
          console.log('✅ Client logout completed');
        }
      },

      // Logout from all devices
      logoutAll: async () => {
        console.log('🚪 Logging out from all devices...');
        
        try {
          set({ loading: true });
          
          await apiClient.post('/api/auth/logout-all');
          
          // Clear client state
          delete apiClient.defaults.headers.common['Authorization'];
          
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            lastActivity: null,
            sessionExpiresAt: null,
            showRegistrationModal: false,
            registrationData: null
          });
          
          message.success('Đã đăng xuất khỏi tất cả thiết bị');
          
          // Redirect to homepage after logout all
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
          
          console.log('✅ Logout all completed');
          
        } catch (error) {
          console.error('❌ Logout all error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
        }
      },

      // ===== USER MANAGEMENT =====

      // Update user profile
      updateUser: (userData) => {
        const currentUser = get().user;
        const updatedUser = { ...currentUser, ...userData };
        
        set({ user: updatedUser });
        
        console.log('✅ User profile updated:', updatedUser.email);
      },

      // Refresh user data from server
      refreshUserData: async () => {
        try {
          const response = await apiClient.get('/api/auth/me');
          const userData = response.data.data.user;
          
          set({ user: userData });
          console.log('✅ User data refreshed');
          
          return userData;
        } catch (error) {
          console.error('❌ Refresh user data error:', error);
          throw error;
        }
      },

      // ===== SESSION MANAGEMENT =====

      // Manually refresh tokens
      refreshSession: async () => {
        try {
          const { refreshToken } = get();
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const response = await apiClient.post('/api/auth/refresh', {
            refreshToken
          });

          const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data.data.tokens;
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          // Update API client default headers
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          // Update store state
          set({ 
            token: accessToken,
            refreshToken: newRefreshToken,
            sessionExpiresAt,
            lastActivity: new Date()
          });

          console.log('✅ Session refreshed manually');
          return true;
        } catch (error) {
          console.error('❌ Manual session refresh failed:', error);
          get().logout(false);
          return false;
        }
      },

      // Check if session is valid
      isSessionValid: () => {
        const { sessionExpiresAt, isAuthenticated, token } = get();
        
        if (!isAuthenticated || !token || !sessionExpiresAt) {
          return false;
        }
        
        return new Date() < new Date(sessionExpiresAt);
      },

      // Update last activity timestamp
      updateActivity: () => {
        set({ lastActivity: new Date() });
      },

      // ===== UTILITY FUNCTIONS =====

      // Initialize store (call this on app startup)
      initialize: async () => {
        const { isAuthenticated, token, isSessionValid } = get();
        
        if (isAuthenticated && token) {
          if (isSessionValid()) {
            // Set default auth header
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            // Try to refresh user data
            try {
              await get().refreshUserData();
              console.log('✅ Auth store initialized with valid session');
            } catch (error) {
              console.log('⚠️ Failed to refresh user data on init, keeping stored data');
            }
          } else {
            console.log('⚠️ Session expired on init, logging out');
            get().logout(false);
          }
        }
      },

      // Clear all data (for testing/debugging)
      clearAll: () => {
        delete apiClient.defaults.headers.common['Authorization'];
        
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          loading: false,
          lastActivity: null,
          sessionExpiresAt: null,
          showRegistrationModal: false,
          registrationData: null
        });
        
        console.log('🧹 Auth store cleared');
      },

      // Get current auth status summary
      getAuthStatus: () => {
        const state = get();
        return {
          isAuthenticated: state.isAuthenticated,
          hasValidSession: state.isSessionValid(),
          user: state.user ? {
            id: state.user.id,
            email: state.user.email,
            name: state.user.name,
            role: state.user.role
          } : null,
          lastActivity: state.lastActivity,
          sessionExpiresAt: state.sessionExpiresAt
        };
      }
    }),
    {
      name: 'auth-storage',
      version: 1,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        lastActivity: state.lastActivity,
        sessionExpiresAt: state.sessionExpiresAt
      }),
      // Migrate function for future updates
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Migration logic for version 0 to 1
          return {
            ...persistedState,
            showRegistrationModal: false,
            registrationData: null
          };
        }
        return persistedState;
      }
    }
  )
);

// ===== INITIALIZATION =====
// Auto-initialize on import
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();
}

// ===== EXPORTS =====
export default useAuthStore;