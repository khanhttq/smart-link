// frontend/src/pages/auth/LoginPage.js - FIXED with Admin Redirect Logic
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

  // ✅ ENHANCED: Smart redirect based on user role
  const getRedirectPath = (user) => {
    // Check if there's a specific redirect path from navigation state
    const intendedPath = location.state?.from?.pathname;
    
    // If user is admin and no specific path intended, redirect to admin dashboard
    if (user?.role === 'admin' && !intendedPath) {
      return '/admin';
    }
    
    // If there's an intended path, go there (respecting user's original navigation)
    if (intendedPath && intendedPath !== '/login' && intendedPath !== '/register') {
      return intendedPath;
    }
    
    // Default redirect based on role
    switch (user?.role) {
      case 'admin':
        return '/admin';
      case 'editor':
        return '/dashboard'; // Editors go to regular dashboard for now
      default:
        return '/dashboard';
    }
  };

  // ✅ ENHANCED: Submit handler with smart redirect
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
        const { user } = result;
        const redirectPath = getRedirectPath(user);
        
        console.log(`✅ Login successful for ${user.role || 'user'}, redirecting to: ${redirectPath}`);
        
        // Show role-specific welcome message
        if (user.role === 'admin') {
          console.log('👑 Admin user logged in, redirecting to admin panel');
        }
        
        navigate(redirectPath, { replace: true });
        
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
      const { user } = result;
      const redirectPath = getRedirectPath(user);
      
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
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
                <Row justify="space-between" align="middle">
                  <Col>
                    <Checkbox 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)}
                    >
                      Ghi nhớ đăng nhập
                    </Checkbox>
                  </Col>
                  <Col>
                    <Link to="/forgot-password" className="login-link">
                      Quên mật khẩu?
                    </Link>
                  </Col>
                </Row>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  icon={<LoginOutlined />}
                  block
                  className="login-button"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </Form.Item>

              <Divider>
                <Text type="secondary">hoặc</Text>
              </Divider>

              <Form.Item>
                <Button
                  type="default"
                  size="large"
                  icon={<GoogleOutlined />}
                  block
                  onClick={handleGoogleLogin}
                  className="google-login-button"
                >
                  Đăng nhập với Google
                </Button>
              </Form.Item>
            </Form>

            <div className="login-footer">
              <Text type="secondary">
                Chưa có tài khoản?{' '}
                <Link to="/register" className="login-link">
                  <strong>Đăng ký ngay</strong>
                </Link>
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Smart Registration Modal */}
      <SmartRegistrationModal 
        onRegistrationSuccess={handleRegistrationSuccess}
      />
    </div>
  );
};

export default LoginPage;