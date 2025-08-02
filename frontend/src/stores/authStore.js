// frontend/src/stores/authStore.js - FIXED VERSION (NO DUPLICATE INTERCEPTOR)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../utils/apiClient'; // Use shared apiClient - NO duplicate interceptor
import { message, Modal } from 'antd';

// ✅ REMOVED DUPLICATE AXIOS SETUP - Use shared apiClient only
// ✅ REMOVED DUPLICATE INTERCEPTOR - Handled in apiClient.js

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

      // Enhanced login
      login: async (email, password) => {
        try {
          console.log('🔑 Attempting login...');
          set({ loading: true });
          
          if (!email || !password) {
            const error = 'Vui lòng nhập đầy đủ email và mật khẩu';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          // ✅ FIXED: Clear existing auth before login
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

          // ✅ FIXED: Set auth headers properly
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

      // Enhanced register
      register: async (userData) => {
        try {
          console.log('👤 Registering user...');
          set({ loading: true });
          
          if (!userData.email || !userData.password || !userData.name) {
            const error = 'Vui lòng nhập đầy đủ thông tin';
            message.error(error);
            set({ loading: false });
            return { success: false, error };
          }

          const response = await apiClient.post('/api/auth/register', {
            email: userData.email.trim().toLowerCase(),
            password: userData.password,
            name: userData.name.trim()
          });

          const { user, tokens } = response.data.data;
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = tokens;

          const sessionExpiresAt = new Date(Date.now() + (expiresIn * 1000));

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
          console.error('❌ Registration error:', error);
          set({ loading: false });
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // ✅ CRITICAL FIX: Enhanced logout with proper backend sync
      // Tìm function logout và SỬA thành:
logout: async () => {
  try {
    console.log('👋 Starting logout process...');
    const { token } = get();
    
    // Step 1: Call backend logout FIRST
    if (token) {
      try {
        await apiClient.post('/api/auth/logout', {}, {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 5000
        });
        console.log('✅ Backend logout successful');
      } catch (error) {
        console.error('❌ Backend logout failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Logout error:', error);
  } finally {
    // ✅ CRITICAL FIX: Clear ALL auth data IMMEDIATELY
    console.log('🧹 Clearing all auth data...');
    
    // Clear store state
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
      lastActivity: null,
      sessionExpiresAt: null
    });
    
    // ✅ FIX: Clear API headers IMMEDIATELY
    delete apiClient.defaults.headers.common['Authorization'];
    
    // ✅ FIX: Force clear localStorage/sessionStorage
    try {
      localStorage.removeItem('auth-storage');
      sessionStorage.removeItem('auth-storage');
      
      // ✅ EXTRA: Clear any other auth-related items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('auth') || key.includes('token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
    
    message.success('👋 Đã đăng xuất thành công');
    
    // ✅ FIX: Redirect without delay
    window.location.href = '/login';
  }
},

      // Force logout (for expired sessions)
      forceLogout: () => {
        console.log('🚨 Force logout triggered');
        get().clearAuth();
        delete apiClient.defaults.headers.common['Authorization'];
        message.warning('Phiên đăng nhập đã hết hạn');
        
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      },

      // Enhanced logout from all devices
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
          delete apiClient.defaults.headers.common['Authorization'];
          message.success('🔒 Đã đăng xuất khỏi tất cả thiết bị');
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 1000);
          
        } catch (error) {
          console.error('❌ Logout all error:', error);
          // Still clear local state
          get().clearAuth();
          delete apiClient.defaults.headers.common['Authorization'];
          message.error('Có lỗi xảy ra, nhưng đã đăng xuất cục bộ');
          
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
      },

      // ✅ REMOVED: Manual refresh function - handled by apiClient interceptor

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
          get().forceLogout();
          return false;
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

      // ✅ ENHANCED: Clear all auth state
      clearAuth: () => {
          console.log('🧹 Clearing auth state...');
          
          // Clear store state
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false,
            lastActivity: null,
            sessionExpiresAt: null
          });
          
          // ✅ FIX: Clear API headers
          delete apiClient.defaults.headers.common['Authorization'];
          
          // ✅ FIX: Aggressive storage clearing
          try {
            localStorage.clear(); // Clear everything
            sessionStorage.clear();
          } catch (error) {
            console.error('Error clearing storage:', error);
          }
        },

      // Get error message from API response
      getErrorMessage: (error) => {
        if (error.response?.data?.message) {
          return error.response.data.message;
        } else if (error.message) {
          return error.message;
        } else {
          return 'Có lỗi xảy ra. Vui lòng thử lại!';
        }
      },

      // Initialize auth state
      initializeAuth: async () => {
        try {
          set({ loading: true });
          
          const { token } = get();
          if (token) {
            await get().checkAuth();
          } else {
            set({ loading: false, isAuthenticated: false });
          }
        } catch (error) {
          console.error('❌ Auth initialization error:', error);
          set({ loading: false, isAuthenticated: false });
        }
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
    }
  )
);

export { useAuthStore };