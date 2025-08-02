// frontend/src/pages/auth/LoginPage.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Divider, 
  Space,
  Row,
  Col,
  Alert,
  message
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
  GoogleOutlined,
  LinkOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      console.log('🔍 Starting login process...');
      
      const result = await login(values.email, values.password);
      
      console.log('🔍 Login result:', result);
      
      if (result.success) {
        console.log('✅ Login successful, navigating to dashboard');
        
        // Get redirect path from location state or default to dashboard
        const redirectTo = location.state?.from?.pathname || '/dashboard';
        
        // Small delay to let user see success message
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1000);
      }
      // If login fails, the smart auth system handles showing error/registration modal
      
    } catch (error) {
      console.error('🚨 Login exception:', error);
      message.error('Có lỗi không mong muốn xảy ra. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      const googleUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
      console.log('🌐 Redirecting to Google OAuth:', googleUrl);
      
      // Store current location for redirect after OAuth
      sessionStorage.setItem('oauth_redirect', location.state?.from?.pathname || '/dashboard');
      
      window.location.href = googleUrl;
    } catch (error) {
      console.error('🚨 Google login error:', error);
      message.error('Không thể kết nối đến Google. Vui lòng thử lại!');
    }
  };

  // Show loading state during auth check
  if (isAuthenticated) {
    return (
      <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
        <Col>
          <div style={{ textAlign: 'center' }}>
            <LinkOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Text>Đang chuyển hướng...</Text>
          </div>
        </Col>
      </Row>
    );
  }

  return (
    <Row justify="center" align="middle" style={{ minHeight: '80vh' }}>
      <Col xs={22} sm={16} md={12} lg={8} xl={6}>
        <Card style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
            {/* Logo & Title */}
            <div>
              <LinkOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Title level={2} style={{ margin: 0 }}>
                Đăng nhập
              </Title>
              <Text type="secondary">
                Chào mừng đến với Shortlink System
              </Text>
            </div>

            {/* Smart Login Info */}
            <Alert
              message="🚀 Đăng nhập thông minh"
              description="Chưa có tài khoản? Không sao! Chúng tôi sẽ tự động tạo tài khoản mới cho bạn."
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              style={{ textAlign: 'left' }}
            />

            {/* Login Form */}
            <Form
              form={form}
              name="login"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              style={{ width: '100%' }}
              autoComplete="on"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email!' },
                  { type: 'email', message: 'Email không hợp lệ!' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
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
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<LoginOutlined />}
                  block
                  size="large"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </Form.Item>
            </Form>

            {/* Google Login */}
            <div style={{ width: '100%' }}>
              <Divider>
                <Text type="secondary">hoặc</Text>
              </Divider>
              
              <Button 
                icon={<GoogleOutlined />}
                onClick={handleGoogleLogin}
                loading={loading}
                block
                size="large"
                style={{ 
                  borderColor: '#db4437',
                  color: '#db4437'
                }}
              >
                Đăng nhập với Google
              </Button>
            </div>

            {/* Register Link */}
            <div>
              <Text type="secondary">
                Muốn tạo tài khoản thủ công? {' '}
                <Link to="/register" style={{ fontWeight: 500 }}>
                  Đăng ký tại đây
                </Link>
              </Text>
            </div>

            {/* Demo Account Info */}
            <Alert
              message="🧪 Tài khoản demo"
              description={
                <div>
                  <div>Email: demo@shortlink.com</div>
                  <div>Mật khẩu: Demo123!</div>
                </div>
              }
              type="warning"
              style={{ textAlign: 'left' }}
            />
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default LoginPage;