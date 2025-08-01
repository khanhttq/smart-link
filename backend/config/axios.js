// config/axios.js
const axios = require('axios');

// Create axios instance for external API calls
const createAxiosInstance = (config = {}) => {
  const instance = axios.create({
    timeout: 10000,
    headers: {
      'User-Agent': 'Shortlink-System/1.0',
      'Accept': 'application/json',
      ...config.headers
    },
    ...config
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      console.log(`[AXIOS] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      console.error('[AXIOS] Request error:', error.message);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      console.log(`[AXIOS] Response ${response.status} from ${response.config.url}`);
      return response;
    },
    (error) => {
      const { config, response } = error;
      console.error(`[AXIOS] Error ${response?.status || 'NETWORK'} from ${config?.url}`);
      return Promise.reject(error);
    }
  );

  return instance;
};

// OAuth Google Instance
const googleOAuthInstance = createAxiosInstance({
  baseURL: 'https://oauth2.googleapis.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// URL Validator Instance (for external URL checks)
const urlValidatorInstance = createAxiosInstance({
  timeout: 3000,
  maxRedirects: 5,
  validateStatus: (status) => status < 500
});

// External API Instance
const externalApiInstance = createAxiosInstance({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

module.exports = {
  googleOAuthInstance,
  urlValidatorInstance,
  externalApiInstance,
  createAxiosInstance
};