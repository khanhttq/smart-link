// frontend/src/services/notificationService.js
import { App } from 'antd';
import { 
  ERROR_CODES, 
  SUCCESS_MESSAGES, 
  getErrorMessage, 
  getSuccessMessage,
  mapBackendError,
  NOTIFICATION_TYPES 
} from '../constants/errorCodes';

class NotificationService {
  constructor() {
    this.messageApi = null;
    this.notificationApi = null;
    this.modalApi = null;
  }

  // Initialize APIs (called from App component)
  init(messageApi, notificationApi, modalApi) {
    this.messageApi = messageApi;
    this.notificationApi = notificationApi;
    this.modalApi = modalApi;
    console.log('✅ NotificationService initialized');
  }

  // ===== CORE MESSAGE METHODS =====
  
  success(content, duration = 3) {
    if (this.messageApi) {
      return this.messageApi.success(content, duration);
    }
    console.log('✅ Success:', content);
  }

  error(content, duration = 4) {
    if (this.messageApi) {
      return this.messageApi.error(content, duration);
    }
    console.error('❌ Error:', content);
  }

  warning(content, duration = 3) {
    if (this.messageApi) {
      return this.messageApi.warning(content, duration);
    }
    console.warn('⚠️ Warning:', content);
  }

  info(content, duration = 3) {
    if (this.messageApi) {
      return this.messageApi.info(content, duration);
    }
    console.info('ℹ️ Info:', content);
  }

  loading(content, duration = 0) {
    if (this.messageApi) {
      return this.messageApi.loading(content, duration);
    }
    console.log('⏳ Loading:', content);
  }

  // ===== ERROR HANDLING METHODS =====

  /**
   * Handle error with proper error code mapping
   * @param {Error|Object} error - Error object from backend/frontend
   * @param {string} context - Context where error occurred
   * @param {Object} options - Additional options
   */
  handleError(error, context = '', options = {}) {
    const { 
      showToast = true, 
      duration = 4,
      logError = true,
      fallbackMessage = null 
    } = options;

    // Map backend error to frontend error code
    const errorCode = mapBackendError(error);
    const errorMessage = getErrorMessage(errorCode, fallbackMessage);

    // Log error for debugging
    if (logError) {
      console.error(`❌ ${context} Error:`, {
        code: errorCode,
        message: errorMessage,
        originalError: error,
        status: error?.response?.status,
        data: error?.response?.data,
        timestamp: new Date().toISOString()
      });
    }

    // Show toast notification (skip for rate limiting)
    if (showToast && error?.response?.status !== 429) {
      this.error(errorMessage, duration);
    }

    // Special handling for certain error types
    this._handleSpecialErrors(errorCode, error);

    return {
      code: errorCode,
      message: errorMessage,
      handled: true
    };
  }

  /**
   * Handle success with proper success code mapping
   * @param {string} successCode - Success code constant
   * @param {string} customMessage - Custom success message
   * @param {Object} options - Additional options
   */
  handleSuccess(successCode, customMessage = null, options = {}) {
    const { duration = 3, showToast = true } = options;
    
    const message = customMessage || getSuccessMessage(successCode);
    
    if (showToast) {
      this.success(message, duration);
    }

    console.log('✅ Success:', successCode, message);
    
    return {
      code: successCode,
      message,
      handled: true
    };
  }

  // ===== SPECIAL ERROR HANDLING =====
  
  _handleSpecialErrors(errorCode, originalError) {
    switch (errorCode) {
      case ERROR_CODES.AUTH_TOKEN_EXPIRED:
      case ERROR_CODES.AUTH_SESSION_EXPIRED:
        this._handleSessionExpiry();
        break;
        
      case ERROR_CODES.AUTH_RATE_LIMITED:
      case ERROR_CODES.AUTH_TOO_MANY_ATTEMPTS:
        this._handleRateLimit(originalError);
        break;
        
      case ERROR_CODES.NETWORK_CONNECTION_ERROR:
        this._handleNetworkError();
        break;
        
      case ERROR_CODES.SYSTEM_MAINTENANCE:
        this._handleMaintenanceMode();
        break;
        
      default:
        // No special handling needed
        break;
    }
  }

  _handleSessionExpiry() {
    // Clear local storage
    try {
      localStorage.removeItem('auth-storage');
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }

    // Emit custom event for auth store to handle
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  }

  _handleRateLimit(error) {
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      this.warning(`Vui lòng thử lại sau ${minutes} phút`);
    }
  }

  _handleNetworkError() {
    // Could trigger a network status check or offline mode
    window.dispatchEvent(new CustomEvent('network:connection-error'));
  }

  _handleMaintenanceMode() {
    // Could redirect to maintenance page
    window.dispatchEvent(new CustomEvent('system:maintenance-mode'));
  }

  // ===== NOTIFICATION METHODS =====
  
  notify(config) {
    if (this.notificationApi) {
      return this.notificationApi.open({
        placement: 'topRight',
        duration: 4,
        ...config
      });
    }
    console.log('🔔 Notification:', config);
  }

  notifySuccess(config) {
    return this.notify({
      type: 'success',
      ...config
    });
  }

  notifyError(config) {
    return this.notify({
      type: 'error',
      duration: 6,
      ...config
    });
  }

  notifyWarning(config) {
    return this.notify({
      type: 'warning',
      duration: 5,
      ...config
    });
  }

  notifyInfo(config) {
    return this.notify({
      type: 'info',
      ...config
    });
  }

  // ===== MODAL METHODS =====
  
  confirm(config) {
    if (this.modalApi) {
      return this.modalApi.confirm({
        okText: 'Xác nhận',
        cancelText: 'Hủy',
        centered: true,
        ...config
      });
    }
    return Promise.resolve(true);
  }

  // ===== AUTHENTICATION SPECIFIC METHODS =====
  
  loginSuccess(userName) {
    this.handleSuccess('AUTH_LOGIN_SUCCESS', `Chào mừng ${userName}!`);
  }

  loginError(error) {
    this.handleError(error, 'Login');
  }

  registerSuccess(userName) {
    this.handleSuccess('AUTH_REGISTER_SUCCESS', `Chào mừng ${userName}! Tài khoản đã được tạo thành công.`);
  }

  registerError(error) {
    this.handleError(error, 'Register');
  }

  logoutSuccess() {
    this.handleSuccess('AUTH_LOGOUT_SUCCESS');
  }

  passwordChangeSuccess() {
    this.handleSuccess('AUTH_PASSWORD_CHANGED');
  }

  // ===== LINK SPECIFIC METHODS =====
  
  linkCreated(shortUrl) {
    this.notifySuccess({
      message: getSuccessMessage('LINK_CREATED'),
      description: `Link rút gọn: ${shortUrl}`,
      duration: 4
    });
  }

  linkUpdated() {
    this.handleSuccess('LINK_UPDATED');
  }

  linkDeleted() {
    this.handleSuccess('LINK_DELETED');
  }

  linkCopied() {
    this.handleSuccess('LINK_COPIED');
  }

  linkError(error) {
    this.handleError(error, 'Link Operation');
  }

  // ===== SYSTEM SPECIFIC METHODS =====
  
  securityAlert(message, details = '') {
    this.notifyError({
      message: 'Cảnh báo bảo mật',
      description: message + (details ? `\n${details}` : ''),
      duration: 8
    });
  }

  maintenanceNotice(message = 'Hệ thống đang bảo trì') {
    this.notifyWarning({
      message: 'Thông báo bảo trì',
      description: message,
      duration: 0 // Stay until manually closed
    });
  }

  // ===== CONFIRMATION DIALOGS =====
  
  confirmDelete(itemName = 'mục này') {
    return this.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa ${itemName}?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okType: 'danger',
      icon: '🗑️'
    });
  }

  confirmLogout() {
    return this.confirm({
      title: 'Xác nhận đăng xuất',
      content: 'Bạn có chắc chắn muốn đăng xuất?',
      okText: 'Đăng xuất',
      cancelText: 'Hủy',
      icon: '🚪'
    });
  }

  confirmAction(title, content, options = {}) {
    return this.confirm({
      title,
      content,
      ...options
    });
  }

  // ===== VALIDATION METHODS =====
  
  validationError(fieldName, errorCode) {
    const message = getErrorMessage(errorCode, 'Dữ liệu không hợp lệ');
    this.error(`${fieldName}: ${message}`);
  }

  // ===== UTILITY METHODS =====
  
  /**
   * Show progress notification for long-running operations
   * @param {string} message - Progress message
   * @param {number} percent - Progress percentage (0-100)
   */
  progress(message, percent = 0) {
    return this.loading(`${message} (${percent}%)`);
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    if (this.messageApi) {
      this.messageApi.destroy();
    }
    if (this.notificationApi) {
      this.notificationApi.destroy();
    }
  }

  /**
   * Test notification system
   */
  test() {
    console.log('🧪 Testing notification system...');
    
    this.info('Notification system test');
    
    setTimeout(() => {
      this.success('Test completed successfully!');
    }, 1000);
  }
}

// Export singleton instance
export default new NotificationService();