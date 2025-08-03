// frontend/src/pages/auth/RegisterPage.js - FIXED VERSION
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Form, 
  Input, 
  Button, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Card, 
  Divider,
  Progress,
  Checkbox
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  GoogleOutlined,
  UserAddOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';
import notificationService from '../../services/notificationService';
import { ERROR_CODES } from '../../constants/errorCodes';
import './RegisterPage.less';

const { Title, Text } = Typography;

// ✅ FIX: Unified validation rules
const VALIDATION_RULES = {
  name: [
    { required: true, message: 'Vui lòng nhập họ tên!' },
    { min: 2, message: 'Họ tên phải có ít nhất 2 ký tự!' },
    { max: 50, message: 'Họ tên không được quá 50 ký tự!' },
    { pattern: /^[a-zA-ZÀ-ỹ\s]+$/, message: 'Họ tên chỉ được chứa chữ cái và khoảng trắng!' }
  ],
  email: [
    { required: true, message: 'Vui lòng nhập email!' },
    { type: 'email', message: 'Định dạng email không hợp lệ!' },
    { max: 100, message: 'Email không được quá 100 ký tự!' }
  ],
  password: [
    { required: true, message: 'Vui lòng nhập mật khẩu!' },
    { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự!' },
    { 
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số!' 
    }
  ],
  confirmPassword: [
    { required: true, message: 'Vui lòng xác nhận mật khẩu!' }
  ],
  terms: [
    { required: true, message: 'Vui lòng đồng ý với điều khoản sử dụng!' }
  ]
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { register, getPasswordStrength } = useAuthStore();

  // ✅ FIX: Enhanced form submission with proper error handling
  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      console.log('📝 Submitting registration form...');
      
      // Additional client-side validation
      if (!acceptTerms) {
        notificationService.error('Vui lòng đồng ý với điều khoản sử dụng!');
        setLoading(false);
        return;
      }

      if (values.password !== values.confirmPassword) {
        notificationService.error('Mật khẩu xác nhận không khớp!');
        setLoading(false);
        return;
      }

      // Call register function from store
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password
      });
      
      console.log('📝 Registration result:', result);
      
      // ✅ FIX: Proper result handling
      if (result && result.success) {
        console.log('✅ Registration successful, redirecting...');
        
        // Clear form
        form.resetFields();
        setAcceptTerms(false);
        
        // Navigate to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
        
      } else {
        // ✅ FIX: Handle specific error cases
        const errorCode = result?.error || ERROR_CODES.SYSTEM_UNKNOWN_ERROR;
        const errorMessage = result?.message || 'Đăng ký thất bại. Vui lòng thử lại!';
        
        console.error('❌ Registration failed:', errorCode, errorMessage);
        
        // Error already handled by authStore/notificationService
        // Just focus on the first error field if validation failed
        if (errorCode === ERROR_CODES.VALIDATION_REQUIRED_FIELD || 
            errorCode === ERROR_CODES.VALIDATION_INVALID_FORMAT) {
          const firstErrorField = form.getFieldsError().find(field => field.errors.length > 0);
          if (firstErrorField) {
            form.scrollToField(firstErrorField.name);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Registration form error:', error);
      notificationService.handleError(error, 'Registration Form');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: Enhanced Google OAuth with error handling
  const handleGoogleRegister = () => {
    try {
      const googleUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
      
      // Store registration intent
      sessionStorage.setItem('oauth_action', 'register');
      sessionStorage.setItem('oauth_redirect', '/dashboard');
      
      console.log('🔗 Redirecting to Google OAuth:', googleUrl);
      window.location.href = googleUrl;
      
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      notificationService.error('Không thể kết nối đến Google. Vui lòng thử lại!');
    }
  };

  // Watch password field for strength indicator
  const passwordValue = Form.useWatch('password', form);
  const passwordStrength = passwordValue ? getPasswordStrength(passwordValue) : null;

  // ✅ FIX: Custom password confirmation validator
  const validateConfirmPassword = ({ getFieldValue }) => ({
    validator(_, value) {
      if (!value || getFieldValue('password') === value) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
    },
  });

  return (
    <div className="register-page">
      <Row justify="center" align="middle" className="register-container">
        <Col xs={22} sm={18} md={14} lg={10} xl={8}>
          <Card className="register-card" bordered={false}>
            
            {/* Header */}
            <div className="register-header">
              <Link to="/" className="logo-link">
                <img src="/logo.png" alt="Shortlink System" className="register-logo" />
              </Link>
              <Title level={2} className="register-title">
                Tạo tài khoản mới
              </Title>
              <Text type="secondary" className="register-subtitle">
                Đăng ký để bắt đầu sử dụng dịch vụ rút gọn link
              </Text>
            </div>

            {/* Registration Form */}
            <Form
              form={form}
              name="register"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              className="register-form"
              scrollToFirstError
              requiredMark={false}
            >
              
              {/* Full Name */}
              <Form.Item
                name="name"
                label="Họ và tên"
                rules={VALIDATION_RULES.name}
                hasFeedback
              >
                <Input
                  prefix={<UserOutlined className="input-prefix" />}
                  placeholder="Nhập họ và tên đầy đủ"
                  autoComplete="name"
                  maxLength={50}
                  showCount
                />
              </Form.Item>

              {/* Email */}
              <Form.Item
                name="email"
                label="Địa chỉ email"
                rules={VALIDATION_RULES.email}
                hasFeedback
              >
                <Input
                  prefix={<MailOutlined className="input-prefix" />}
                  placeholder="Nhập địa chỉ email"
                  autoComplete="email"
                  maxLength={100}
                />
              </Form.Item>

              {/* Password with strength indicator */}
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={VALIDATION_RULES.password}
                hasFeedback
              >
                <div>
                  <Input.Password
                    prefix={<LockOutlined className="input-prefix" />}
                    placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)"
                    autoComplete="new-password"
                    iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                  />
                  
                  {/* Password strength indicator */}
                  {passwordStrength && (
                    <div className="password-strength-container">
                      <Progress
                        percent={passwordStrength.score}
                        status={passwordStrength.status}
                        showInfo={false}
                        strokeWidth={4}
                        trailColor="#f0f0f0"
                      />
                      <Text 
                        type="secondary" 
                        className={`strength-text strength-${passwordStrength.level}`}
                      >
                        Độ mạnh: {passwordStrength.text}
                      </Text>
                    </div>
                  )}
                </div>
              </Form.Item>

              {/* Confirm Password */}
              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu"
                dependencies={['password']}
                rules={[
                  ...VALIDATION_RULES.confirmPassword,
                  validateConfirmPassword
                ]}
                hasFeedback
              >
                <Input.Password
                  prefix={<LockOutlined className="input-prefix" />}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              {/* Terms and Conditions */}
              <Form.Item
                name="terms"
                valuePropName="checked"
                rules={VALIDATION_RULES.terms}
              >
                <Checkbox
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                >
                  Tôi đồng ý với{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">
                    Điều khoản sử dụng
                  </Link>
                  {' '}và{' '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                    Chính sách bảo mật
                  </Link>
                </Checkbox>
              </Form.Item>

              {/* Submit Button */}
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={!acceptTerms}
                  block
                  size="large"
                  icon={<UserAddOutlined />}
                  className="submit-button"
                >
                  {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                </Button>
              </Form.Item>
            </Form>

            {/* Divider */}
            <Divider className="form-divider">
              <Text type="secondary">Hoặc</Text>
            </Divider>

            {/* Google Registration */}
            <Button
              icon={<GoogleOutlined />}
              onClick={handleGoogleRegister}
              className="google-register-btn"
              size="large"
              block
            >
              Đăng ký với Google
            </Button>

            {/* Login Link */}
            <div className="auth-switch">
              <Text type="secondary">Đã có tài khoản? </Text>
              <Link to="/login" className="switch-link">
                Đăng nhập ngay
              </Link>
            </div>
          </Card>

          {/* Footer */}
          <div className="register-footer">
            <Space split={<Divider type="vertical" />} className="footer-links">
              <Link to="/help">Trợ giúp</Link>
              <Link to="/privacy">Quyền riêng tư</Link>
              <Link to="/terms">Điều khoản</Link>
              <Link to="/contact">Liên hệ</Link>
            </Space>
            <Text type="secondary" className="copyright">
              © 2024 Shortlink System. All rights reserved.
            </Text>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default RegisterPage;