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
  message
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  GoogleOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import './RegisterPage.less';

const { Title, Text } = Typography;

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password
      });
      if (result.success) {
        message.success('Đăng ký thành công!');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
      } else {
        message.error('Đăng ký thất bại. Vui lòng thử lại!');
      }
    } catch (error) {
      message.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      const googleUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
      sessionStorage.setItem('oauth_redirect', '/dashboard');
      window.location.href = googleUrl;
    } catch (error) {
      message.error('Không thể kết nối đến Google. Vui lòng thử lại!');
    }
  };

  return (
    <div className="register-page">
      <Row justify="center" align="middle" className="register-container">
        <Col xs={22} sm={16} md={12} lg={8}>
          <Card className="register-card" variant="borderless">
            <div className="register-header">
              <Link to="/">
                <img src="/logo.png" alt="Shortlink System" className="register-logo" />
              </Link>
              <Title level={3} className="register-title">Shortlink System</Title>
              <Text type="secondary" className="register-subtitle">
                Tạo tài khoản mới để bắt đầu sử dụng
              </Text>
            </div>

            <Form
              form={form}
              name="register"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              className="register-form"
            >
              <Form.Item
                name="name"
                rules={[
                  { required: true, message: 'Vui lòng nhập họ tên!' },
                  { min: 2, message: 'Họ tên phải có ít nhất 2 ký tự!' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="Họ và tên" 
                />
              </Form.Item>

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
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu!' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Mật khẩu" 
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Xác nhận mật khẩu" 
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  block
                  icon={<UserAddOutlined />}
                >
                  Đăng ký
                </Button>
              </Form.Item>
            </Form>

            <Divider>Hoặc</Divider>

            <Button
              icon={<GoogleOutlined />}
              onClick={handleGoogleLogin}
              className="social-register-btn"
              block
            >
              Đăng ký với Google
            </Button>

            <div className="login-link">
              <Text type="secondary">Đã có tài khoản? </Text>
              <Link to="/login">Đăng nhập ngay</Link>
            </div>
          </Card>

          <div className="register-footer">
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
    </div>
  );
};

export default RegisterPage;