// frontend/src/utils/apiClient.js
import axios from 'axios';
import { message } from 'antd';

// Create axios instance with baseURL
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

// Function to set auth token
export const setAuthToken = (token) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now()
    };
    
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    const { response, config } = error;
    
    console.error(`[API] Error ${response?.status || 'NETWORK'} from ${config?.url}`);
    
    // Handle different error status codes
    if (response?.status === 401) {
      // Token expired or invalid
      message.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
      
      // Clear auth data
      setAuthToken(null);
      localStorage.removeItem('auth-storage');
      
      // Redirect to login
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
      
    } else if (response?.status === 403) {
      message.error('Bạn không có quyền thực hiện hành động này!');
    } else if (response?.status === 404) {
      message.error('Không tìm thấy tài nguyên!');
    } else if (response?.status >= 500) {
      message.error('Lỗi server! Vui lòng thử lại sau.');
    } else if (!response) {
      message.error('Lỗi mạng! Vui lòng kiểm tra kết nối internet.');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;