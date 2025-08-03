// frontend/src/constants/errorCodes.js
/**
 * Hệ thống mã lỗi thống nhất cho toàn bộ ứng dụng
 * Format: DOMAIN_TYPE_SPECIFIC
 * 
 * DOMAIN: AUTH, LINK, USER, SYSTEM, NETWORK
 * TYPE: ERROR, WARNING, INFO
 * SPECIFIC: Chi tiết lỗi cụ thể
 */

export const ERROR_CODES = {
  // ===== AUTHENTICATION ERRORS =====
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
  AUTH_EMAIL_EXISTS: 'AUTH_EMAIL_EXISTS',
  AUTH_INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
  AUTH_WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  AUTH_PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',
  AUTH_ACCOUNT_DEACTIVATED: 'AUTH_ACCOUNT_DEACTIVATED',
  AUTH_OAUTH_NO_PASSWORD: 'AUTH_OAUTH_NO_PASSWORD',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_REVOKED: 'AUTH_TOKEN_REVOKED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  AUTH_TOO_MANY_ATTEMPTS: 'AUTH_TOO_MANY_ATTEMPTS',

  // ===== VALIDATION ERRORS =====
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_MIN_LENGTH: 'VALIDATION_MIN_LENGTH',
  VALIDATION_MAX_LENGTH: 'VALIDATION_MAX_LENGTH',

  // ===== LINK ERRORS =====
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  LINK_EXPIRED: 'LINK_EXPIRED',
  LINK_PASSWORD_REQUIRED: 'LINK_PASSWORD_REQUIRED',
  LINK_INVALID_URL: 'LINK_INVALID_URL',
  LINK_DUPLICATE_ALIAS: 'LINK_DUPLICATE_ALIAS',
  LINK_QUOTA_EXCEEDED: 'LINK_QUOTA_EXCEEDED',

  // ===== NETWORK ERRORS =====
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_ERROR: 'NETWORK_CONNECTION_ERROR',
  NETWORK_SERVER_ERROR: 'NETWORK_SERVER_ERROR',
  NETWORK_BAD_REQUEST: 'NETWORK_BAD_REQUEST',
  NETWORK_FORBIDDEN: 'NETWORK_FORBIDDEN',
  NETWORK_NOT_FOUND: 'NETWORK_NOT_FOUND',

  // ===== SYSTEM ERRORS =====
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  SYSTEM_OVERLOAD: 'SYSTEM_OVERLOAD',
  SYSTEM_UNKNOWN_ERROR: 'SYSTEM_UNKNOWN_ERROR',
  SYSTEM_DATABASE_ERROR: 'SYSTEM_DATABASE_ERROR',
  SYSTEM_CACHE_ERROR: 'SYSTEM_CACHE_ERROR',

  // ===== USER ERRORS =====
  USER_PERMISSION_DENIED: 'USER_PERMISSION_DENIED',
  USER_PROFILE_INCOMPLETE: 'USER_PROFILE_INCOMPLETE',
  USER_QUOTA_EXCEEDED: 'USER_QUOTA_EXCEEDED'
};

// Error message mappings
export const ERROR_MESSAGES = {
  // Authentication
  [ERROR_CODES.AUTH_USER_NOT_FOUND]: 'Email chưa được đăng ký trong hệ thống',
  [ERROR_CODES.AUTH_INVALID_PASSWORD]: 'Mật khẩu không chính xác',
  [ERROR_CODES.AUTH_EMAIL_EXISTS]: 'Email đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
  [ERROR_CODES.AUTH_INVALID_EMAIL]: 'Định dạng email không hợp lệ',
  [ERROR_CODES.AUTH_WEAK_PASSWORD]: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số',
  [ERROR_CODES.AUTH_PASSWORD_MISMATCH]: 'Mật khẩu xác nhận không khớp',
  [ERROR_CODES.AUTH_ACCOUNT_DEACTIVATED]: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ',
  [ERROR_CODES.AUTH_OAUTH_NO_PASSWORD]: 'Tài khoản này được tạo qua Google. Vui lòng đăng nhập bằng Google',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại',
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Token không hợp lệ',
  [ERROR_CODES.AUTH_TOKEN_REVOKED]: 'Token đã bị thu hồi',
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: 'Phiên làm việc đã hết hạn',
  [ERROR_CODES.AUTH_REQUIRED]: 'Vui lòng đăng nhập để tiếp tục',
  [ERROR_CODES.AUTH_RATE_LIMITED]: 'Quá nhiều requests. Vui lòng thử lại sau',
  [ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS]: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút',

  // Validation
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Trường này là bắt buộc',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Định dạng không hợp lệ',
  [ERROR_CODES.VALIDATION_MIN_LENGTH]: 'Độ dài tối thiểu không đủ',
  [ERROR_CODES.VALIDATION_MAX_LENGTH]: 'Vượt quá độ dài tối đa cho phép',

  // Links
  [ERROR_CODES.LINK_NOT_FOUND]: 'Không tìm thấy link',
  [ERROR_CODES.LINK_EXPIRED]: 'Link đã hết hạn',
  [ERROR_CODES.LINK_PASSWORD_REQUIRED]: 'Link yêu cầu mật khẩu',
  [ERROR_CODES.LINK_INVALID_URL]: 'URL không hợp lệ',
  [ERROR_CODES.LINK_DUPLICATE_ALIAS]: 'Tên rút gọn đã được sử dụng',
  [ERROR_CODES.LINK_QUOTA_EXCEEDED]: 'Đã vượt quá giới hạn link cho phép',

  // Network
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Kết nối bị timeout. Vui lòng kiểm tra internet và thử lại',
  [ERROR_CODES.NETWORK_CONNECTION_ERROR]: 'Lỗi kết nối mạng. Vui lòng kiểm tra internet và thử lại',
  [ERROR_CODES.NETWORK_SERVER_ERROR]: 'Lỗi server. Vui lòng thử lại sau',
  [ERROR_CODES.NETWORK_BAD_REQUEST]: 'Yêu cầu không hợp lệ',
  [ERROR_CODES.NETWORK_FORBIDDEN]: 'Không có quyền truy cập',
  [ERROR_CODES.NETWORK_NOT_FOUND]: 'Không tìm thấy tài nguyên',

  // System
  [ERROR_CODES.SYSTEM_MAINTENANCE]: 'Hệ thống đang bảo trì. Vui lòng thử lại sau',
  [ERROR_CODES.SYSTEM_OVERLOAD]: 'Hệ thống đang quá tải. Vui lòng thử lại sau',
  [ERROR_CODES.SYSTEM_UNKNOWN_ERROR]: 'Có lỗi không xác định xảy ra',
  [ERROR_CODES.SYSTEM_DATABASE_ERROR]: 'Lỗi cơ sở dữ liệu',
  [ERROR_CODES.SYSTEM_CACHE_ERROR]: 'Lỗi cache hệ thống',

  // User
  [ERROR_CODES.USER_PERMISSION_DENIED]: 'Không có quyền thực hiện thao tác này',
  [ERROR_CODES.USER_PROFILE_INCOMPLETE]: 'Thông tin hồ sơ chưa đầy đủ',
  [ERROR_CODES.USER_QUOTA_EXCEEDED]: 'Đã vượt quá giới hạn cho phép'
};

// Success messages
export const SUCCESS_MESSAGES = {
  AUTH_LOGIN_SUCCESS: 'Đăng nhập thành công!',
  AUTH_REGISTER_SUCCESS: 'Tài khoản đã được tạo thành công!',
  AUTH_LOGOUT_SUCCESS: 'Đăng xuất thành công. Hẹn gặp lại!',
  AUTH_PASSWORD_CHANGED: 'Mật khẩu đã được thay đổi thành công',
  
  LINK_CREATED: 'Link đã được tạo thành công!',
  LINK_UPDATED: 'Link đã được cập nhật',
  LINK_DELETED: 'Link đã được xóa thành công',
  LINK_COPIED: 'Link đã được sao chép vào clipboard',
  
  PROFILE_UPDATED: 'Hồ sơ đã được cập nhật',
  SETTINGS_SAVED: 'Cài đặt đã được lưu'
};

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error', 
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading'
};

// Get error message by code
export const getErrorMessage = (errorCode, fallback = 'Có lỗi xảy ra') => {
  return ERROR_MESSAGES[errorCode] || fallback;
};

// Get success message by code
export const getSuccessMessage = (successCode, fallback = 'Thành công') => {
  return SUCCESS_MESSAGES[successCode] || fallback;
};

// Convert backend error to frontend error code
export const mapBackendError = (backendError) => {
  const errorMessage = backendError?.response?.data?.message || backendError?.message || '';
  
  // Network errors
  if (backendError?.code === 'ECONNABORTED' || errorMessage.includes('timeout')) {
    return ERROR_CODES.NETWORK_TIMEOUT;
  }
  
  if (backendError?.code === 'ERR_NETWORK' || errorMessage.includes('Network Error')) {
    return ERROR_CODES.NETWORK_CONNECTION_ERROR;
  }

  // HTTP status codes
  const status = backendError?.response?.status;
  switch (status) {
    case 400:
      return ERROR_CODES.NETWORK_BAD_REQUEST;
    case 401:
      return ERROR_CODES.AUTH_INVALID_PASSWORD;
    case 403:
      return ERROR_CODES.USER_PERMISSION_DENIED;
    case 404:
      return ERROR_CODES.NETWORK_NOT_FOUND;
    case 429:
      return ERROR_CODES.AUTH_RATE_LIMITED;
    case 500:
    case 502:
    case 503:
      return ERROR_CODES.NETWORK_SERVER_ERROR;
    default:
      break;
  }

  // Backend error messages mapping
  switch (errorMessage) {
    case 'USER_NOT_FOUND':
      return ERROR_CODES.AUTH_USER_NOT_FOUND;
    case 'INVALID_PASSWORD':
      return ERROR_CODES.AUTH_INVALID_PASSWORD;
    case 'ACCOUNT_DEACTIVATED':
      return ERROR_CODES.AUTH_ACCOUNT_DEACTIVATED;
    case 'OAUTH_USER_NO_PASSWORD':
      return ERROR_CODES.AUTH_OAUTH_NO_PASSWORD;
    case 'Too many login attempts':
    case 'Too many login attempts. Please try again later.':
      return ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS;
    case 'Email already exists':
    case 'User already exists with this email':
      return ERROR_CODES.AUTH_EMAIL_EXISTS;
    case 'Token expired':
    case 'jwt expired':
      return ERROR_CODES.AUTH_TOKEN_EXPIRED;
    case 'Token revoked':
    case 'Token has been revoked':
      return ERROR_CODES.AUTH_TOKEN_REVOKED;
    case 'Invalid token':
    case 'jwt malformed':
      return ERROR_CODES.AUTH_TOKEN_INVALID;
    default:
      return ERROR_CODES.SYSTEM_UNKNOWN_ERROR;
  }
};