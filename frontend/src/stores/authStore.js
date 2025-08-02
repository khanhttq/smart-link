// frontend/src/stores/authStore.js - COMPLETE VERSION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../utils/apiClient'; // Use shared apiClient
import { message, Modal } from 'antd';

// ===== REMOVE DUPLICATE AXIOS SETUP - Use shared apiClient =====

// ===== REMOVE DUPLICATE INTERCEPTOR - Use shared apiClient =====
// Token refresh is now handled in shared apiClient

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: true,
      lastActivity: null,
      sessionExpiresAt: null,

      // ===== AUTH ACTIONS =====

      // Enhanced login with comprehensive error handling
      login: async (email, password) => {
        try {
          console.log('🔑 Attempting login...');
          set({ loading: true });
          
          // Validate inputs
          if (!email || !password) {
            const error = 'Vui lòng nhập đầy đủ email và mật khẩu';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          // Clear any existing auth data first
          delete apiClient.defaults.headers.common['Authorization'];

          const response = await apiClient.post('/api/auth/login', { 
            email: email.trim().toLowerCase(), 
            password 
          });
          
          console.log('✅ Login successful:', response.data);

          const { user, tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;

          // Calculate session expiration
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          // Set auth headers and update state
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          set({ 
            user, 
            token: accessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
            loading: false,
            lastActivity: new Date(),
            sessionExpiresAt
          });

          message.success(`🎉 Chào mừng ${user.name}!`);
          return { success: true, user, token: accessToken };
          
        } catch (error) {
          console.error('❌ Login error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Enhanced register with validation
      register: async (userData) => {
        try {
          console.log('👤 Registering user...');
          set({ loading: true });
          
          // Validate required fields
          const { email, password, name } = userData;
          if (!email || !password || !name) {
            const error = 'Vui lòng điền đầy đủ thông tin';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          const response = await apiClient.post('/api/auth/register', {
            email: email.trim().toLowerCase(),
            password,
            name: name.trim()
          });
          
          console.log('✅ Registration successful:', response.data);
          
          const { user, tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;

          // Calculate session expiration
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

          // Set auth headers and update state
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          set({ 
            user, 
            token: accessToken,
            refreshToken: newRefreshToken,
            isAuthenticated: true,
            loading: false,
            lastActivity: new Date(),
            sessionExpiresAt
          });

          message.success(`🎉 Đăng ký thành công! Chào mừng ${user.name}!`);
          return { success: true, user, token: accessToken };
          
        } catch (error) {
          console.error('❌ Registration error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Enhanced logout with cleanup
      logout: async () => {
        try {
          console.log('👋 Logging out...');
          
          const { token } = get();
          
          // Call server logout if authenticated
          if (token) {
            try {
              await apiClient.post('/api/auth/logout', {}, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 5000 // Short timeout for logout
              });
              console.log('✅ Server logout successful');
            } catch (error) {
              console.error('❌ Server logout error:', error);
              // Continue with client logout even if server fails
            }
          }
          
        } catch (error) {
          console.error('❌ Logout error:', error);
        } finally {
          // Always clear client state
          get().clearAuth();
          message.success('👋 Đã đăng xuất thành công');
          
          // Redirect to login
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);
        }
      },

      // Force logout without server call (for expired sessions)
      forceLogout: () => {
        console.log('🚨 Force logout triggered');
        get().clearAuth();
        message.warning('Phiên đăng nhập đã hết hạn');
      },

      // Logout from all devices
      logoutAll: async () => {
        try {
          console.log('🚪 Logging out from all devices...');
          
          const { token } = get();
          if (token) {
            await apiClient.post('/api/auth/logout-all', {}, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
          
          get().clearAuth();
          message.success('🔒 Đã đăng xuất khỏi tất cả thiết bị');
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);
          
        } catch (error) {
          console.error('❌ Logout all error:', error);
          // Still clear local state
          get().clearAuth();
          message.error('Có lỗi xảy ra, nhưng đã đăng xuất cục bộ');
        }
      },

      // Check authentication status
      checkAuth: async () => {
        const { token, sessionExpiresAt } = get();
        
        if (!token) {
          set({ loading: false, isAuthenticated: false });
          return false;
        }

        // Check if session is expired
        if (sessionExpiresAt && new Date() > new Date(sessionExpiresAt)) {
          console.log('⏰ Session expired');
          get().forceLogout();
          return false;
        }

        try {
          console.log('🔍 Checking authentication...');
          
          // Set auth header
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          const response = await apiClient.get('/api/auth/me');
          console.log('✅ Auth check successful');
          
          const user = response.data.data.user;
          set({ 
            user, 
            isAuthenticated: true, 
            loading: false,
            lastActivity: new Date()
          });
          
          return true;
          
        } catch (error) {
          console.error('❌ Auth check failed:', error);
          
          // Clear invalid auth state
          get().clearAuth();
          return false;
        }
      },

      // Manual token refresh
      refreshToken: async () => {
        try {
          const { refreshToken } = get();
          
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          console.log('🔄 Manually refreshing token...');
          
          const response = await apiClient.post('/api/auth/refresh', {
            refreshToken
          });
          
          const { tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;
          
          // Calculate new session expiration
          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));
          
          // Update auth headers and state
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          
          set({ 
            token: accessToken,
            refreshToken: newRefreshToken,
            sessionExpiresAt,
            lastActivity: new Date()
          });
          
          console.log('✅ Token refreshed successfully');
          return { success: true, token: accessToken };
          
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
          get().forceLogout();
          return { success: false, error: error.message };
        }
      },

      // ===== UTILITY ACTIONS =====

      // Update user data
      updateUser: (userData) => {
        set(state => ({ 
          user: { ...state.user, ...userData },
          lastActivity: new Date()
        }));
        console.log('👤 User data updated:', userData);
      },

      // Clear all auth state
      clearAuth: () => {
        console.log('🧹 Clearing auth state...');
        
        // Remove auth header
        delete apiClient.defaults.headers.common['Authorization'];
        
        // Clear state
        set({ 
          user: null, 
          token: null, 
          refreshToken: null,
          isAuthenticated: false, 
          loading: false,
          lastActivity: null,
          sessionExpiresAt: null
        });
        
        // Clear localStorage manually
        try {
          localStorage.removeItem('auth-storage');
          sessionStorage.removeItem('auth-storage');
        } catch (error) {
          console.error('Error clearing storage:', error);
        }
      },

      // Update last activity (call this on user interactions)
      updateActivity: () => {
        set({ lastActivity: new Date() });
      },

      // Check if session is near expiry (within 5 minutes)
      isSessionNearExpiry: () => {
        const { sessionExpiresAt } = get();
        if (!sessionExpiresAt) return false;
        
        const fiveMinutes = 5 * 60 * 1000;
        const timeLeft = new Date(sessionExpiresAt) - new Date();
        return timeLeft <= fiveMinutes && timeLeft > 0;
      },

      // Get time until session expires
      getTimeUntilExpiry: () => {
        const { sessionExpiresAt } = get();
        if (!sessionExpiresAt) return null;
        
        return new Date(sessionExpiresAt) - new Date();
      },

      // ===== ERROR HANDLING =====

      // Enhanced error message handler
      getErrorMessage: (error) => {
        if (error.response) {
          const status = error.response.status;
          const serverMessage = error.response.data?.message || '';
          
          // Handle specific status codes
          switch (status) {
            case 400:
              if (serverMessage.includes('already exists')) {
                return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.';
              }
              if (serverMessage.includes('password')) {
                if (serverMessage.includes('strength') || serverMessage.includes('weak')) {
                  return 'Mật khẩu quá yếu. Cần ít nhất 8 ký tự với chữ hoa, chữ thường và số.';
                }
                return 'Mật khẩu không hợp lệ.';
              }
              if (serverMessage.includes('email')) {
                return 'Định dạng email không hợp lệ.';
              }
              if (serverMessage.includes('required')) {
                return 'Vui lòng điền đầy đủ thông tin bắt buộc.';
              }
              return serverMessage || 'Dữ liệu không hợp lệ';
              
            case 401:
              if (serverMessage.includes('credentials')) {
                return 'Email hoặc mật khẩu không chính xác';
              }
              if (serverMessage.includes('token')) {
                return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
              }
              return 'Không có quyền truy cập. Vui lòng đăng nhập.';
              
            case 403:
              return 'Tài khoản bị khóa hoặc không có đủ quyền truy cập';
              
            case 404:
              return 'Không tìm thấy tài khoản hoặc tài nguyên';
              
            case 409:
              return 'Dữ liệu bị trung lặp. Vui lòng kiểm tra lại.';
              
            case 422:
              return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra và thử lại.';
              
            case 429:
              return 'Quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.';
              
            case 500:
              return 'Lỗi server nội bộ. Vui lòng thử lại sau.';
              
            case 502:
            case 503:
            case 504:
              return 'Server tạm thời không khả dụng. Vui lòng thử lại sau.';
              
            default:
              return serverMessage || `Lỗi ${status}. Vui lòng thử lại.`;
          }
        }
        
        // Handle network errors
        if (error.request) {
          if (error.code === 'ECONNABORTED') {
            return 'Kết nối quá chậm. Vui lòng kiểm tra mạng và thử lại.';
          }
          if (error.code === 'NETWORK_ERROR') {
            return 'Lỗi mạng. Vui lòng kiểm tra kết nối internet.';
          }
          return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
        }
        
        // Handle other errors
        return error.message || 'Có lỗi không xác định xảy ra. Vui lòng thử lại.';
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        sessionExpiresAt: state.sessionExpiresAt
      }),
      // Add version for future migrations
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Migration logic for older versions
          console.log('🔄 Migrating auth store from version 0 to 1');
          return {
            ...persistedState,
            refreshToken: null,
            sessionExpiresAt: null
          };
        }
        return persistedState;
      }
    }
  )
);

// Export the store and apiClient for use in other parts of the app
export { useAuthStore, apiClient };