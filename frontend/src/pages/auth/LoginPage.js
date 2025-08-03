// frontend/src/pages/auth/LoginPage.js - FIXED with safe smartRegistration
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Divider,
  Row,
  Col,
  Space,
  Checkbox
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  LoginOutlined,
  GoogleOutlined
} from '@ant-design/icons';
// ✅ FIXED: Default import
import useAuthStore from '../../stores/authStore';
import SmartRegistrationModal from '../../components/SmartRegistrationModal';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [form] = Form.useForm();
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // ✅ FIXED: Safe destructuring with fallback
  const authStore = useAuthStore();
  const { 
    login, 
    loading, 
    smartRegistration = { isVisible: false, email: '', password: '' }, // ✅ Fallback
    hideSmartRegistration 
  } = authStore;

  // ✅ FIXED: Enhanced submit handler
  const handleSubmit = async (values) => {
    console.log('🚀 Form submit with values:', values);
    try {
      const credentials = {
        email: values.email?.trim(),
        password: values.password
      };
      
      console.log('📤 Sending credentials:', { 
        email: credentials.email, 
        passwordProvided: !!credentials.password 
      });

      const result = await login(credentials);
      console.log('📥 Login result:', result);

      if (result.success) {
        const redirectTo = location.state?.from?.pathname || '/dashboard';
        console.log(`✅ Login successful, redirecting to: ${redirectTo}`);
        navigate(redirectTo, { replace: true });
      } else if (result.showSmartRegistration) {
        console.log('📝 Showing smart registration modal');
        // Modal will show automatically via state change
      }
      // Không cần hiển thị lỗi ở đây vì notificationService đã xử lý
    } catch (error) {
      console.error('❌ Login submission error:', error);
      // Để notificationService xử lý lỗi từ authStore
    }
  };

  // Google login handler
  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    console.log('Google login clicked');
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
  };

  // Smart registration success handler
  const handleRegistrationSuccess = (result) => {
    if (result.success) {
      hideSmartRegistration();
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      setTimeout(() => {
        navigate(redirectTo, { replace: true });
      }, 1000);
    }
  };

  return (
    <div className="login-page">
      <Row justify="center" align="middle" className="login-container">
        <Col xs={22} sm={16} md={12} lg={8}>
          <Card className="login-card" variant="borderless">
            <div className="login-header">
              <Link to="/">
                <div className="login-logo">📎</div>
              </Link>
              <Title level={3} className="login-title">Shortlink System</Title>
              <Text type="secondary" className="login-subtitle">
                Hệ thống rút gọn liên kết thông minh
              </Text>
            </div>

            <Form
              form={form}
              name="login"
              onFinish={handleSubmit}
              size="large"
              layout="vertical"
              className="login-form"
              initialValues={{
                email: '',
                password: ''
              }}
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email!' },
                  { type: 'email', message: 'Email không hợp lệ!' }
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Email"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Mật khẩu"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item>
                <Space className="login-extras" direction="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  >
                    Ghi nhớ đăng nhập
                  </Checkbox>
                  <Link to="/forgot-password">Quên mật khẩu?</Link>
                </Space>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  icon={<LoginOutlined />}
                >
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>

            <Divider>Hoặc</Divider>

            <Button
              icon={<GoogleOutlined />}
              onClick={handleGoogleLogin}
              className="social-login-btn"
              block
            >
              Đăng nhập với Google
            </Button>

            <div className="register-link">
              <Text type="secondary">Chưa có tài khoản? </Text>
              <Link to="/register">Đăng ký ngay</Link>
            </div>
          </Card>

          <div className="login-footer">
            <Space split={<Divider type="vertical" />}>
              <Link to="/help">Trợ giúp</Link>
              <Link to="/privacy">Quyền riêng tư</Link>
              <Link to="/terms">Điều khoản</Link>
            </Space>
            <Text type="secondary" className="copyright">
              © 2024 Shortlink System. All rights reserved.
            </Text>
          </div>
        </Col>
      </Row>

      {/* ✅ FIXED: Safe smart registration modal with fallback */}
      {smartRegistration && (
        <SmartRegistrationModal
          visible={smartRegistration.isVisible || false}
          onCancel={hideSmartRegistration}
          email={smartRegistration.email || ''}
          password={smartRegistration.password || ''}
          onSuccess={handleRegistrationSuccess}
        />
      )}
    </div>
  );
};

export default LoginPage;