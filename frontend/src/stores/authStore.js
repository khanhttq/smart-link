// frontend/src/stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { message } from 'antd';
import apiClient, { setAuthToken } from '../utils/apiClient';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: true,

      login: async (email, password) => {
        try {
          const response = await apiClient.post('/api/auth/login', { email, password });
          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          // FIXED: Use shared API client token setter
          setAuthToken(token);
          set({ user, token, isAuthenticated: true });

          message.success('Đăng nhập thành công!');
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.message || 'Đăng nhập thất bại';
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      register: async (userData) => {
        try {
          const response = await apiClient.post('/api/auth/register', userData);
          console.log('Phản hồi API đăng ký:', response.data);
          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          // FIXED: Use shared API client token setter
          setAuthToken(token);
          set({ user, token, isAuthenticated: true });

          message.success('Đăng ký thành công!');
          return { success: true };
        } catch (error) {
          const errorMessage = error.response?.data?.message || 'Đăng ký thất bại';
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      logout: async () => {
        try {
          if (get().token) {
            await apiClient.post('/api/auth/logout');
          }
        } catch (error) {
          console.log('Logout error:', error);
        } finally {
          // FIXED: Use shared API client token setter
          setAuthToken(null);
          set({ user: null, token: null, isAuthenticated: false });
          message.success('Đăng xuất thành công!');
        }
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ loading: false });
          return;
        }

        try {
          // FIXED: Set token before making request
          setAuthToken(token);
          console.log('Checking auth with token:', token.substring(0, 20) + '...');
          
          const response = await apiClient.get('/api/auth/me');
          const user = response.data.data;
          set({ user, isAuthenticated: true, loading: false });
        } catch (error) {
          console.error('Auth check failed:', error);
          // FIXED: Clear invalid token
          setAuthToken(null);
          set({ user: null, token: null, isAuthenticated: false, loading: false });
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      },

      // FIXED: Initialize token on store hydration
      _hasHydrated: false,
      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated });
        
        // Set token when store is hydrated
        if (hasHydrated) {
          const token = get().token;
          if (token) {
            setAuthToken(token);
            console.log('Token restored from storage');
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

export { useAuthStore };