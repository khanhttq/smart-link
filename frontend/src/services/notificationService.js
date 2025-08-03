// frontend/src/services/notificationService.js
import { App } from 'antd';

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
  }

  // ===== MESSAGE METHODS =====
  success(content, duration = 3) {
    if (this.messageApi) {
      return this.messageApi.success(content, duration);
    }
    // Fallback for development
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

  // ===== NOTIFICATION METHODS =====
  notify(config) {
    if (this.notificationApi) {
      return this.notificationApi.open(config);
    }
    console.log('🔔 Notification:', config);
  }

  notifySuccess(config) {
    if (this.notificationApi) {
      return this.notificationApi.success(config);
    }
    console.log('✅ Success Notification:', config);
  }

  notifyError(config) {
    if (this.notificationApi) {
      return this.notificationApi.error(config);
    }
    console.error('❌ Error Notification:', config);
  }

  // ===== MODAL METHODS =====
  confirm(config) {
    if (this.modalApi) {
      return this.modalApi.confirm(config);
    }
    return Promise.resolve(true); // Fallback
  }

  // ===== ADVANCED METHODS =====
  
  // Authentication notifications
  loginSuccess(userName) {
    this.success(`Chào mừng ${userName}! Đăng nhập thành công.`);
  }

  loginError(message) {
    this.error(message || 'Đăng nhập thất bại. Vui lòng thử lại.');
  }

  logoutSuccess() {
    this.success('Đăng xuất thành công. Hẹn gặp lại!');
  }

  // Link operations
  linkCreated(shortUrl) {
    this.notifySuccess({
      message: 'Link đã được tạo!',
      description: `Link rút gọn: ${shortUrl}`,
      duration: 4
    });
  }

  linkDeleted() {
    this.success('Link đã được xóa thành công.');
  }

  linkUpdated() {
    this.success('Link đã được cập nhật.');
  }

  // Security notifications
  securityAlert(message) {
    this.notifyError({
      message: 'Cảnh báo bảo mật',
      description: message,
      duration: 6
    });
  }

  sessionExpired() {
    this.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  // Network errors
  networkError() {
    this.error('Lỗi kết nối mạng. Vui lòng kiểm tra internet.');
  }

  serverError() {
    this.error('Lỗi server. Vui lòng thử lại sau.');
  }

  // Confirmation dialogs
  confirmDelete(itemName = 'mục này') {
    return this.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc chắn muốn xóa ${itemName}?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okType: 'danger'
    });
  }

  confirmLogout() {
    return this.confirm({
      title: 'Xác nhận đăng xuất',
      content: 'Bạn có chắc chắn muốn đăng xuất?',
      okText: 'Đăng xuất',
      cancelText: 'Hủy'
    });
  }
}

// Export singleton instance
export default new NotificationService();