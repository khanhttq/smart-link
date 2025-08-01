// frontend/src/pages/auth/LoginPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Divider, 
  Space,
  Row,
  Col
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  LoginOutlined,
  GoogleOutlined,
  LinkOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (values) => {
    setLoading(true);
    
    const result = await login(values.email, values.password);
    
    if (result.success) {
      navigate('/dashboard');
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
  };

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
                Chào mừng trở lại với Shortlink System
              </Text>
            </div>

            {/* Login Form */}
            <Form
              form={form}
              name="login"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              style={{ width: '100%' }}
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
                Chưa có tài khoản? {' '}
                <Link to="/register" style={{ fontWeight: 500 }}>
                  Đăng ký ngay
                </Link>
              </Text>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default LoginPage;