// frontend/src/stores/authStore.js - SMART VERSION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { message, Modal } from 'antd';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// Create axios instance with proper error handling
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request/response interceptors for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('🚨 Request error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('🚨 API Error:', error);
    return Promise.reject(error);
  }
);

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: true,

      // Smart login with user-friendly messages
      login: async (email, password) => {
        try {
          console.log('🔑 Attempting login...');
          
          // Validate inputs
          if (!email || !password) {
            message.error('Vui lòng nhập đầy đủ email và mật khẩu');
            return { success: false, error: 'Missing credentials' };
          }

          const response = await apiClient.post('/api/auth/login', { 
            email: email.trim().toLowerCase(), 
            password 
          });
          
          console.log('✅ Login successful:', response.data);

          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          // Set auth headers and update state
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, isAuthenticated: true });

          message.success(`Chào mừng ${user.name}! Đăng nhập thành công 🎉`);
          return { success: true, user, token };

        } catch (error) {
          console.error('❌ Login failed:', error);
          
          if (error.response?.status === 401) {
            const errorMsg = error.response.data?.message || '';
            
            console.log('🔍 401 Error detected:', errorMsg);
            
            if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Invalid email or password')) {
              console.log('🚀 Showing account not found modal...');
              // Show smart popup for account not found
              get().showAccountNotFoundModal(email, password);
              return { success: false, error: 'invalid_credentials' };
            }
          }
          
          // Handle other errors
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Show smart modal when account not found
      showAccountNotFoundModal: (email, password) => {
        const modal = Modal.confirm({
          title: '🤔 Tài khoản không tồn tại',
          content: `Không tìm thấy tài khoản với email: ${email}\n\nBạn có muốn tạo tài khoản mới với thông tin này không?`,
          okText: '✨ Tạo tài khoản mới',
          cancelText: '❌ Hủy',
          onOk: () => {
            // Ask for name
            const name = prompt('👤 Nhập họ và tên của bạn:');
            if (name && name.trim()) {
              get().quickRegister(email, password, name.trim());
            } else {
              message.error('Vui lòng nhập họ và tên!');
            }
          },
          onCancel: () => {
            message.info('Vui lòng kiểm tra lại thông tin đăng nhập');
          }
        });
      },

      // Quick register and auto login
      quickRegister: async (email, password, name) => {
        try {
          console.log('👤 Quick registering user...');
          
          const response = await apiClient.post('/api/auth/register', {
            email: email.trim().toLowerCase(),
            password,
            name: name.trim()
          });
          
          console.log('✅ Registration successful:', response.data);

          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          // Set auth headers and update state
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, isAuthenticated: true });

          message.success(`🎉 Tài khoản đã được tạo thành công! Chào mừng ${user.name}!`);
          return { success: true, user, token };

        } catch (error) {
          console.error('❌ Registration failed:', error);
          
          const errorMessage = get().getErrorMessage(error);
          message.error(`Tạo tài khoản thất bại: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      },

      // Standard register function
      register: async (userData) => {
        try {
          console.log('👤 Registering user...');
          
          const response = await apiClient.post('/api/auth/register', userData);
          console.log('✅ Registration successful:', response.data);
          
          const { user, tokens } = response.data.data;
          const token = tokens.accessToken;

          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          set({ user, token, isAuthenticated: true });

          message.success(`🎉 Đăng ký thành công! Chào mừng ${user.name}!`);
          return { success: true, user, token };
          
        } catch (error) {
          console.error('❌ Registration error:', error);
          
          const errorMessage = get().getErrorMessage(error);
          message.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // Logout
      logout: async () => {
        try {
          console.log('👋 Logging out...');
          
          if (get().token) {
            await apiClient.post('/api/auth/logout');
          }
        } catch (error) {
          console.error('❌ Logout error:', error);
        } finally {
          delete apiClient.defaults.headers.common['Authorization'];
          set({ user: null, token: null, isAuthenticated: false });
          message.success('👋 Đã đăng xuất thành công');
        }
      },

      // Check authentication
      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ loading: false });
          return;
        }

        try {
          console.log('🔍 Checking authentication...');
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          const response = await apiClient.get('/api/auth/me');
          console.log('✅ Auth check successful');
          
          const user = response.data.data.user;
          set({ user, isAuthenticated: true, loading: false });
          
        } catch (error) {
          console.error('❌ Auth check failed:', error);
          
          delete apiClient.defaults.headers.common['Authorization'];
          set({ user: null, token: null, isAuthenticated: false, loading: false });
        }
      },

      // Update user data
      updateUser: (userData) => {
        set(state => ({ 
          user: { ...state.user, ...userData } 
        }));
      },

      // Clear auth state
      clearAuth: () => {
        delete apiClient.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false, loading: false });
      },

      // Helper function to get user-friendly error messages
      getErrorMessage: (error) => {
        if (error.response) {
          const status = error.response.status;
          const serverMessage = error.response.data?.message || '';
          
          if (status === 400) {
            if (serverMessage.includes('already exists')) {
              return 'Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.';
            }
            if (serverMessage.includes('password')) {
              return 'Mật khẩu không đủ mạnh. Cần ít nhất 8 ký tự với chữ hoa, chữ thường và số.';
            }
            return serverMessage || 'Thông tin không hợp lệ';
          }
          
          if (status === 401) {
            return 'Thông tin đăng nhập không chính xác';
          }
          
          if (status === 403) {
            return 'Tài khoản bị khóa hoặc không có quyền truy cập';
          }
          
          if (status >= 500) {
            return 'Lỗi server. Vui lòng thử lại sau.';
          }
          
          return serverMessage || `Lỗi ${status}`;
        }
        
        if (error.request) {
          return 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.';
        }
        
        if (error.code === 'ECONNABORTED') {
          return 'Kết nối quá chậm. Vui lòng thử lại.';
        }
        
        return error.message || 'Có lỗi không xác định xảy ra';
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export { useAuthStore };