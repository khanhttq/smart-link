// frontend/src/stores/authStore.js - COMPLETE VERSION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import notificationService from '../services/notificationService';
import { ERROR_CODES, mapBackendError } from '../constants/errorCodes';

// ===== API CLIENT SETUP =====
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== ZUSTAND STORE =====
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ===== STATE =====
      user: null,
      tokens: null,
      isAuthenticated: false,
      loading: false,
      smartRegistration: {
        isVisible: false,
        email: '',
        password: ''
      },

      // ===== AUTHENTICATION ACTIONS =====

      /**
       * Login user with enhanced error handling
       * @param {Object} credentials - { email, password }
       * @returns {Object} - { success, error?, user?, tokens?, showSmartRegistration? }
       */
      login: async (credentials) => {
        // Prevent multiple concurrent login attempts
        if (get().loading) {
          return { 
            success: false, 
            error: 'Đang xử lý đăng nhập. Vui lòng chờ...' 
          };
        }

        set({ loading: true });
        
        try {
          console.log('🔐 Login attempt for:', credentials.email);
          
          // Sanitize input
          const sanitizedCredentials = {
            email: credentials.email?.trim()?.toLowerCase(),
            password: credentials.password
          };

          const response = await apiClient.post('/api/auth/login', sanitizedCredentials);
          const { user, tokens } = response.data.data;

          // ✅ Update state properly
          set({
            user,
            tokens,
            isAuthenticated: true,
            loading: false
          });

          // Set authorization header
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

          // ✅ Use new notification service
          notificationService.loginSuccess(user.name);
          console.log('✅ Login successful');
          
          return { success: true, user, tokens };

        } catch (error) {
          console.error('❌ Login error:', error);
          set({ loading: false });

          // ✅ Use new error handling system
          const errorCode = mapBackendError(error);
          
          // Handle special case for unregistered email
          if (errorCode === ERROR_CODES.AUTH_USER_NOT_FOUND) {
            set({
              smartRegistration: {
                isVisible: true,
                email: credentials.email,
                password: credentials.password
              }
            });
            return { 
              success: false, 
              showSmartRegistration: true,
              error: errorCode
            };
          }

          // ✅ Handle error properly with notification service
          const errorResult = notificationService.handleError(error, 'Login', {
            showToast: error?.response?.status !== 429 // Don't show toast for rate limiting
          });
          
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * Register new user with validation
       * @param {Object} userData - { name, email, password }
       * @returns {Object} - { success, error?, user?, tokens? }
       */
      register: async (userData) => {
        set({ loading: true });
        
        try {
          console.log('📝 Registration attempt for:', userData.email);

          // ✅ Validate input before sending
          const validationError = get()._validateRegistrationData(userData);
          if (validationError) {
            set({ loading: false });
            notificationService.error(validationError);
            return { success: false, error: validationError };
          }

          // Sanitize input
          const sanitizedData = {
            name: userData.name?.trim(),
            email: userData.email?.trim()?.toLowerCase(),
            password: userData.password
          };

          const response = await apiClient.post('/api/auth/register', sanitizedData);
          const { user, tokens } = response.data.data;

          // ✅ Update state properly
          set({
            user,
            tokens,
            isAuthenticated: true,
            loading: false
          });

          // Set authorization header
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
          
          // ✅ Use new notification service
          notificationService.registerSuccess(user.name);
          
          return { success: true, user, tokens };

        } catch (error) {
          console.error('❌ Registration error:', error);
          set({ loading: false });

          // ✅ Use new error handling system
          const errorResult = notificationService.handleError(error, 'Registration');
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * Logout user with cleanup
       * @param {boolean} allDevices - Logout from all devices
       */
      logout: async (allDevices = false) => {
        try {
          const endpoint = allDevices ? '/api/auth/logout-all' : '/api/auth/logout';
          
          if (get().tokens?.accessToken) {
            await apiClient.post(endpoint);
          }
        } catch (error) {
          console.error('Logout API error:', error);
          // Continue with logout even if API fails
        }

        // ✅ Clear state properly
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          loading: false,
          smartRegistration: {
            isVisible: false,
            email: '',
            password: ''
          }
        });

        // Clear API headers
        delete apiClient.defaults.headers.common['Authorization'];
        
        // ✅ Use new notification service
        notificationService.logoutSuccess();
      },

      /**
       * Change password with validation
       * @param {Object} passwordData - { currentPassword, newPassword }
       */
      changePassword: async (passwordData) => {
        set({ loading: true });
        
        try {
          // ✅ Validate password before sending
          const validationError = get()._validatePasswordChange(passwordData);
          if (validationError) {
            set({ loading: false });
            notificationService.error(validationError);
            return { success: false, error: validationError };
          }

          await apiClient.post('/api/auth/change-password', passwordData);
          
          set({ loading: false });
          notificationService.passwordChangeSuccess();
          
          return { success: true };
          
        } catch (error) {
          console.error('❌ Change password error:', error);
          set({ loading: false });
          
          const errorResult = notificationService.handleError(error, 'Change Password');
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      // ===== SMART REGISTRATION ACTIONS =====

      showSmartRegistration: (email, password) => {
        set({
          smartRegistration: {
            isVisible: true,
            email: email || '',
            password: password || ''
          }
        });
      },

      hideSmartRegistration: () => {
        set({
          smartRegistration: {
            isVisible: false,
            email: '',
            password: ''
          }
        });
      },

      // ===== AUTH VERIFICATION =====

      /**
       * Check authentication status
       * @returns {boolean} - Authentication status
       */
      checkAuth: async () => {
        const { tokens } = get();
        if (!tokens?.accessToken) {
          return false;
        }

        try {
          // Set header before making request
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
          
          const response = await apiClient.get('/api/auth/me');
          const user = response.data.data.user;
          
          set({ user, isAuthenticated: true });
          return true;
          
        } catch (error) {
          console.error('Auth check failed:', error);
          
          // ✅ Handle token expiry properly
          const errorCode = mapBackendError(error);
          if (errorCode === ERROR_CODES.AUTH_TOKEN_EXPIRED || 
              errorCode === ERROR_CODES.AUTH_TOKEN_INVALID) {
            get().logout();
          }
          
          return false;
        }
      },

      /**
       * Refresh authentication token
       */
      refreshToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          return false;
        }

        try {
          const response = await apiClient.post('/api/auth/refresh', {
            refreshToken: tokens.refreshToken
          });
          
          const { tokens: newTokens } = response.data.data;
          
          set({ tokens: newTokens });
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${newTokens.accessToken}`;
          
          return true;
          
        } catch (error) {
          console.error('Token refresh failed:', error);
          get().logout();
          return false;
        }
      },

      // ===== VALIDATION HELPERS =====

      /**
       * Validate registration data
       * @param {Object} userData - Registration data
       * @returns {string|null} - Error message or null
       */
      _validateRegistrationData: (userData) => {
        if (!userData.name || userData.name.trim().length < 2) {
          return 'Họ tên phải có ít nhất 2 ký tự';
        }

        if (!userData.email) {
          return 'Email là bắt buộc';
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
          return 'Định dạng email không hợp lệ';
        }

        if (!userData.password) {
          return 'Mật khẩu là bắt buộc';
        }

        // ✅ Unified password validation
        const passwordError = get()._validatePassword(userData.password);
        if (passwordError) {
          return passwordError;
        }

        return null;
      },

      /**
       * Validate password strength
       * @param {string} password - Password to validate
       * @returns {string|null} - Error message or null
       */
      _validatePassword: (password) => {
        if (!password) {
          return 'Mật khẩu là bắt buộc';
        }

        if (password.length < 8) {
          return 'Mật khẩu phải có ít nhất 8 ký tự';
        }

        if (!/(?=.*[a-z])/.test(password)) {
          return 'Mật khẩu phải có ít nhất 1 chữ thường';
        }

        if (!/(?=.*[A-Z])/.test(password)) {
          return 'Mật khẩu phải có ít nhất 1 chữ hoa';
        }

        if (!/(?=.*\d)/.test(password)) {
          return 'Mật khẩu phải có ít nhất 1 chữ số';
        }

        return null;
      },

      /**
       * Validate password change data
       * @param {Object} passwordData - Password change data
       * @returns {string|null} - Error message or null
       */
      _validatePasswordChange: (passwordData) => {
        if (!passwordData.currentPassword) {
          return 'Mật khẩu hiện tại là bắt buộc';
        }

        if (!passwordData.newPassword) {
          return 'Mật khẩu mới là bắt buộc';
        }

        if (passwordData.currentPassword === passwordData.newPassword) {
          return 'Mật khẩu mới phải khác mật khẩu hiện tại';
        }

        const passwordError = get()._validatePassword(passwordData.newPassword);
        if (passwordError) {
          return passwordError;
        }

        return null;
      },

      // ===== UTILITY METHODS =====

      /**
       * Get password strength score
       * @param {string} password - Password to check
       * @returns {Object} - { score, level, text, status }
       */
      getPasswordStrength: (password) => {
        if (!password) return { score: 0, level: 'none', text: 'Chưa nhập mật khẩu', status: 'exception' };
        
        let score = 0;
        
        // Length scoring
        if (password.length >= 8) score += 25;
        if (password.length >= 12) score += 10;
        
        // Character types scoring
        if (/[a-z]/.test(password)) score += 15;
        if (/[A-Z]/.test(password)) score += 15;
        if (/\d/.test(password)) score += 15;
        if (/[^a-zA-Z\d]/.test(password)) score += 20;
        
        let level, text, status;
        if (score < 30) {
          level = 'weak';
          text = 'Yếu';
          status = 'exception';
        } else if (score < 60) {
          level = 'fair';
          text = 'Trung bình';
          status = 'active';
        } else if (score < 80) {
          level = 'good';
          text = 'Mạnh';
          status = 'normal';
        } else {
          level = 'strong';
          text = 'Rất mạnh';
          status = 'success';
        }
        
        return { score: Math.min(100, score), level, text, status };
      },

      /**
       * Clear all auth errors
       */
      clearErrors: () => {
        set({ loading: false });
      },

      /**
       * Update user profile
       * @param {Object} profileData - Updated profile data
       */
      updateProfile: async (profileData) => {
        set({ loading: true });
        
        try {
          const response = await apiClient.put('/api/auth/profile', profileData);
          const { user } = response.data.data;
          
          set({ user, loading: false });
          notificationService.success('Hồ sơ đã được cập nhật thành công');
          
          return { success: true, user };
          
        } catch (error) {
          console.error('❌ Update profile error:', error);
          set({ loading: false });
          
          const errorResult = notificationService.handleError(error, 'Update Profile');
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * Get user stats
       */
      getUserStats: async () => {
        try {
          const response = await apiClient.get('/api/auth/stats');
          return { success: true, stats: response.data.data };
          
        } catch (error) {
          console.error('❌ Get user stats error:', error);
          const errorResult = notificationService.handleError(error, 'Get Stats', { showToast: false });
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * Verify email address
       * @param {string} token - Email verification token
       */
      verifyEmail: async (token) => {
        set({ loading: true });
        
        try {
          await apiClient.post('/api/auth/verify-email', { token });
          
          // Update user verification status
          const { user } = get();
          if (user) {
            set({ 
              user: { ...user, emailVerified: true },
              loading: false 
            });
          }
          
          notificationService.success('Email đã được xác thực thành công!');
          return { success: true };
          
        } catch (error) {
          console.error('❌ Email verification error:', error);
          set({ loading: false });
          
          const errorResult = notificationService.handleError(error, 'Email Verification');
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * Resend email verification
       */
      resendEmailVerification: async () => {
        try {
          await apiClient.post('/api/auth/resend-verification');
          notificationService.success('Email xác thực đã được gửi lại');
          return { success: true };
          
        } catch (error) {
          console.error('❌ Resend email verification error:', error);
          const errorResult = notificationService.handleError(error, 'Resend Email Verification');
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.tokens?.accessToken) {
          // Restore authorization header
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${state.tokens.accessToken}`;
          
          // Verify token is still valid
          state.checkAuth().catch(() => {
            console.log('Token verification failed on rehydration');
          });
        }
      }
    }
  )
);

// ===== EVENT LISTENERS =====

// Listen for session expiry events
window.addEventListener('auth:session-expired', () => {
  const { logout } = useAuthStore.getState();
  logout();
});

// Listen for network connection errors
window.addEventListener('network:connection-error', () => {
  console.log('🌐 Network connection error detected');
});

// Listen for system maintenance mode
window.addEventListener('system:maintenance-mode', () => {
  console.log('🔧 System maintenance mode detected');
});

// ===== AXIOS INTERCEPTORS =====

// Request interceptor
// Trong frontend/src/stores/authStore.js
apiClient.interceptors.request.use(
  (config) => {
    const { tokens } = useAuthStore.getState();
    if (tokens?.accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      console.log(`Added Authorization header for ${config.url}: Bearer ${tokens.accessToken.substring(0, 10)}...`); // Debug
    } else if (!tokens?.accessToken) {
      console.warn(`No access token available for ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auto token refresh
// Trong frontend/src/stores/authStore.js
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Bỏ qua lỗi không liên quan đến token
    if (
      error.response?.status === 401 &&
      (originalRequest.url.includes('/api/auth/login') ||
       error.response?.data?.code === 'INVALID_PASSWORD' ||
       error.response?.data?.code === 'AUTHORIZATION_REQUIRED')
    ) {
      console.log(`Skipping logout for error: ${error.response?.data?.code} on ${originalRequest.url}`); // Debug
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const { refreshToken } = useAuthStore.getState();
      const refreshSuccess = await refreshToken();
      
      if (refreshSuccess) {
        const { tokens } = useAuthStore.getState();
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        console.log(`Retrying ${originalRequest.url} with new token`); // Debug
        return apiClient(originalRequest);
      } else {
        console.log('Refresh token failed, logging out');
        useAuthStore.getState().logout();
      }
    }
    
    return Promise.reject(error);
  }
);

// ===== EXPORT =====
export default useAuthStore;