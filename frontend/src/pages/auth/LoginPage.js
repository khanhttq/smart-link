import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  message,
  Checkbox
} from 'antd';
import {
  LockOutlined,
  LoginOutlined,
  GoogleOutlined,
  MailOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import SmartRegistrationModal from '../../components/SmartRegistrationModal';
import './LoginPage.less';

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { 
    login, 
    isAuthenticated, 
    showRegistrationModal, 
    registrationData, 
    hideSmartRegistration 
  } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      if (result.success) {
        const redirectTo = location.state?.from?.pathname || '/dashboard';
        message.success('Đăng nhập thành công!');
        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1000);
      } else if (result.showRegistration) {
        console.log('Showing smart registration modal');
      }
    } catch (error) {
      message.error('Đăng nhập thất bại. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      const googleUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
      sessionStorage.setItem('oauth_redirect', location.state?.from?.pathname || '/dashboard');
      window.location.href = googleUrl;
    } catch (error) {
      message.error('Không thể kết nối đến Google. Vui lòng thử lại!');
    }
  };

  const handleRegistrationSuccess = (result) => {
    if (result.success) {
      hideSmartRegistration();
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      message.success('Đăng ký thành công!');
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
                <img src="/logo.png" alt="Shortlink System" className="login-logo" />
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
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Mật khẩu"
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

      <SmartRegistrationModal
        visible={showRegistrationModal}
        onCancel={hideSmartRegistration}
        email={registrationData?.email}
        password={registrationData?.password}
        onSuccess={handleRegistrationSuccess}
      />
    </div>
  );
};

export default LoginPage;