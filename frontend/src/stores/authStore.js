// frontend/src/stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { message } from 'antd';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
axios.defaults.baseURL = API_URL;

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: true,

      login: async (email, password) => {
        try {
          const response = await axios.post('/api/auth/login', { email, password });
          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
          const response = await axios.post('/api/auth/register', userData);
          console.log('Phản hồi API đăng ký:', response.data); // Log để kiểm tra
          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
            await axios.post('/api/auth/logout');
          }
        } catch (error) {
          console.log('Logout error:', error);
        } finally {
          delete axios.defaults.headers.common['Authorization'];
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
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('Axios header set:', axios.defaults.headers.common['Authorization']);
          const response = await axios.get('/api/auth/me');
          const user = response.data.data;
          set({ user, isAuthenticated: true, loading: false });
        } catch (error) {
          delete axios.defaults.headers.common['Authorization'];
          set({ user: null, token: null, isAuthenticated: false, loading: false });
        }
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export { useAuthStore };