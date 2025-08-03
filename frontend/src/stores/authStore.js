// frontend/src/stores/authStore.js - FIXED VERSION with smartRegistration
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../utils/apiClient';
import notificationService from '../services/notificationService';

// ===== INITIAL STATE with smartRegistration =====
const initialState = {
  user: null,
  token: null,           // Access token - sử dụng cho tất cả API calls
  refreshToken: null,    // Refresh token - chỉ dùng để refresh
  isAuthenticated: false,
  loading: false,
  error: null,
  // ✅ CRITICAL: Initialize smartRegistration object
  smartRegistration: {
    isVisible: false,
    email: '',
    password: ''
  }
};

const useAuthStore = create()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * ✅ FIXED: Thống nhất cách set token 
       */
      setTokens: (tokens) => {
        const { accessToken, refreshToken } = tokens;
        
        // ✅ Lưu vào store
        set({ 
          token: accessToken,           // Sử dụng tên này cho tất cả
          refreshToken: refreshToken 
        });
        
        // ✅ Set global axios header ngay lập tức
        if (accessToken) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          console.log('✅ Set global Authorization header:', `Bearer ${accessToken.substring(0, 10)}...`);
        }
      },

      /**
       * ✅ FIXED: Login với token management thống nhất
       */
      login: async (credentials) => {
        set({ loading: true, error: null });
        
        try {
          console.log('🔑 Attempting login...');
          
          const response = await apiClient.post('/api/auth/login', credentials);
          const { user, tokens } = response.data.data;
          
          console.log('✅ Login response received:', { 
            user: user.email, 
            hasTokens: !!tokens 
          });
          
          // ✅ Set tokens using unified method
          get().setTokens(tokens);
          
          // ✅ Set user and auth state
          set({ 
            user,
            isAuthenticated: true,
            loading: false,
            error: null
          });
          
          console.log('✅ Login successful, tokens set');
          notificationService.success(`Chào mừng ${user.email}!`);
          
          return { success: true, user, tokens };
          
        } catch (error) {
          console.error('❌ Login error:', error);
          set({ loading: false });
          
          // ✅ Handle special case: User not found → Show smart registration
          if (error.response?.status === 404 || 
              error.response?.data?.code === 'USER_NOT_FOUND') {
            
            console.log('👤 User not found, showing smart registration');
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
              error: 'USER_NOT_FOUND'
            };
          }
          
          const errorResult = notificationService.handleError(error, 'Login');
          set({ error: errorResult.message });
          
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * ✅ FIXED: Register method
       */
      register: async (userData) => {
        set({ loading: true, error: null });
        
        try {
          const response = await apiClient.post('/api/auth/register', userData);
          const { user, tokens } = response.data.data;
          
          get().setTokens(tokens);
          
          set({ 
            user,
            isAuthenticated: true,
            loading: false,
            error: null
          });
          
          notificationService.success('Đăng ký thành công!');
          
          return { success: true, user, tokens };
          
        } catch (error) {
          console.error('❌ Registration error:', error);
          set({ loading: false });
          
          const errorResult = notificationService.handleError(error, 'Registration');
          set({ error: errorResult.message });
          
          return { 
            success: false, 
            error: errorResult.code,
            message: errorResult.message
          };
        }
      },

      /**
       * ✅ FIXED: Refresh token với error handling tốt hơn
       */
      refreshToken: async () => {
        try {
          const { refreshToken } = get();
          
          if (!refreshToken) {
            console.error('❌ No refresh token available');
            return false;
          }
          
          console.log('🔄 Refreshing token...');
          
          // ✅ Sử dụng fetch để tránh interceptor loop
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
          });
          
          if (!response.ok) {
            throw new Error('Refresh failed');
          }
          
          const data = await response.json();
          const { tokens } = data.data;
          
          // ✅ Set new tokens
          get().setTokens(tokens);
          
          console.log('✅ Token refreshed successfully');
          return true;
          
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
          
          // Clear all auth data
          get().logout();
          return false;
        }
      },

      /**
       * ✅ FIXED: Logout với cleanup đầy đủ
       */
      logout: async () => {
        try {
          const { token } = get();
          
          // Try to call logout API if token exists
          if (token) {
            try {
              await apiClient.post('/api/auth/logout');
            } catch (error) {
              console.log('Logout API call failed, continuing with local cleanup');
            }
          }
          
        } catch (error) {
          console.log('Logout error, continuing with cleanup');
        } finally {
          // ✅ AGGRESSIVE CLEANUP - Reset to initial state
          set({
            ...initialState // This includes smartRegistration reset
          });
          
          // Clear axios headers
          delete apiClient.defaults.headers.common['Authorization'];
          
          // Clear all storage
          try {
            localStorage.removeItem('auth-storage');
            sessionStorage.clear();
          } catch (error) {
            console.error('Storage clear error:', error);
          }
          
          console.log('✅ Logout completed, all auth data cleared');
        }
      },

      /**
       * ✅ Check authentication status
       */
      checkAuth: async () => {
        try {
          const { token } = get();
          
          if (!token) {
            console.log('No token found, user not authenticated');
            return false;
          }
          
          // Verify token with server
          const response = await apiClient.get('/api/auth/info');
          const { user } = response.data.data;
          
          set({ user, isAuthenticated: true });
          console.log('✅ Auth check successful');
          
          return true;
          
        } catch (error) {
          console.error('❌ Auth check failed:', error);
          
          // Try to refresh token
          const refreshSuccess = await get().refreshToken();
          if (!refreshSuccess) {
            get().logout();
          }
          
          return false;
        }
      },

      // ===== SMART REGISTRATION ACTIONS =====

      /**
       * ✅ Show smart registration modal
       */
      showSmartRegistration: (email, password) => {
        set({
          smartRegistration: {
            isVisible: true,
            email: email || '',
            password: password || ''
          }
        });
      },

      /**
       * ✅ Hide smart registration modal
       */
      hideSmartRegistration: () => {
        set({
          smartRegistration: {
            isVisible: false,
            email: '',
            password: ''
          }
        });
      },

      /**
       * ✅ Clear errors
       */
      clearError: () => {
        set({ error: null });
      },

      /**
       * ✅ Get password strength (optional)
       */
      getPasswordStrength: (password) => {
        if (!password) return null;
        
        let score = 0;
        let feedback = '';
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        // Feedback
        if (score < 3) feedback = 'Mật khẩu yếu';
        else if (score < 5) feedback = 'Mật khẩu trung bình';
        else feedback = 'Mật khẩu mạnh';
        
        return { score, feedback };
      }
    }),
    {
      name: 'auth-storage',
      // ✅ CRITICAL: Chỉ persist những field cần thiết
      partialize: (state) => ({
        user: state.user,
        token: state.token,                    // ✅ Thống nhất tên
        refreshToken: state.refreshToken,      // ✅ Thống nhất tên  
        isAuthenticated: state.isAuthenticated
        // ✅ DON'T persist smartRegistration (should be session-only)
      }),
      
      // ✅ CRITICAL: Restore axios header khi reload
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          console.log('✅ Restored Authorization header on reload');
          
          // Verify token is still valid
          state.checkAuth().catch(() => {
            console.log('Token verification failed on rehydration');
          });
        }
      }
    }
  )
);

export default useAuthStore;