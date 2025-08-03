// frontend/src/stores/authStore.js - CLEAN VERSION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import notificationService from '../services/notificationService';

// ===== API CLIENT SETUP =====
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== ERROR HANDLING =====
const getErrorMessage = (error) => {
  if (!error) return 'Có lỗi không xác định xảy ra';
  
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'Kết nối bị timeout. Vui lòng kiểm tra internet và thử lại';
  }
  
  if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại';
  }

  const errorMessage = error.response?.data?.message || error.message;
  
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
    default:
      return errorMessage || 'Có lỗi xảy ra';
  }
};

// ===== ZUSTAND STORE =====
export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
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

      // Login action
      login: async (credentials) => {
        if (get().loading) {
          return { success: false, error: 'Login already in progress' };
        }

        set({ loading: true });
        
        try {
          console.log('🔐 Login attempt for:', credentials.email);
          
          const response = await apiClient.post('/api/auth/login', credentials);
          const { user, tokens } = response.data.data;

          // Update state
          set({
            user,
            tokens,
            isAuthenticated: true,
            loading: false
          });

          // Set authorization header
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;

          notificationService.loginSuccess(user.name);
          console.log('✅ Login successful');
          return { success: true, user, tokens };

        } catch (error) {
          console.error('❌ Login error:', error);
          set({ loading: false });

          const errorMessage = getErrorMessage(error);
          
          // Handle special case for unregistered email
          if (errorMessage === 'EMAIL_NOT_REGISTERED') {
            set({
              smartRegistration: {
                isVisible: true,
                email: credentials.email,
                password: credentials.password
              }
            });
            return { success: false, showSmartRegistration: true };
          }

          // Only show error notification if not rate limited
          if (!error.response || error.response.status !== 429) {
            notificationService.loginError(errorMessage);
          }
          
          return { success: false, error: errorMessage };
        }
      },

      // Register action
      register: async (userData) => {
        set({ loading: true });
        
        try {
          const response = await apiClient.post('/api/auth/register', userData);
          const { user, tokens } = response.data.data;

          set({
            user,
            tokens,
            isAuthenticated: true,
            loading: false
          });

          apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`;
          notificationService.success(`Chào mừng ${user.name}! Tài khoản đã được tạo thành công.`);
          
          return { success: true, user, tokens };

        } catch (error) {
          console.error('❌ Registration error:', error);
          set({ loading: false });

          const errorMessage = getErrorMessage(error);
          notificationService.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Logout action
      logout: async () => {
        try {
          if (get().tokens?.accessToken) {
            await apiClient.post('/api/auth/logout');
          }
        } catch (error) {
          console.error('Logout API error:', error);
        }

        // Clear state
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          loading: false
        });

        // Clear API headers
        delete apiClient.defaults.headers.common['Authorization'];
        notificationService.logoutSuccess();
      },

      // Smart registration actions
      showSmartRegistration: (email, password) => {
        set({
          smartRegistration: {
            isVisible: true,
            email,
            password
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

      // Check authentication status
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
          get().logout();
          return false;
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
        // Restore Authorization header on app restart
        if (state?.tokens?.accessToken) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${state.tokens.accessToken}`;
        }
      }
    }
  )
);

// ===== API INTERCEPTORS =====

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const state = useAuthStore.getState();
    if (state.tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${state.tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - NO LOOPS
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip auth routes to prevent loops
    if (originalRequest.url?.includes('/api/auth/')) {
      return Promise.reject(error);
    }

    // Only try refresh for 401 errors on protected routes
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

export default useAuthStore;