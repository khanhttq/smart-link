// frontend/src/pages/auth/LoginPage.js - SMART VERSION
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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      console.log('🔍 Starting login process...');
      
      const result = await login(values.email, values.password);
      
      console.log('🔍 Login result:', result);
      
      if (result.success) {
        console.log('✅ Login successful, navigating to dashboard');
        // Small delay to let user see success message
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      }
      // If login fails with invalid_credentials, the smart auth system 
      // will handle showing the registration modal automatically
      
    } catch (error) {
      console.error('🚨 Login exception:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      const googleUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/auth/google`;
      console.log('🌐 Redirecting to Google OAuth:', googleUrl);
      window.location.href = googleUrl;
    } catch (error) {
      console.error('🚨 Google login error:', error);
      message.error('Không thể kết nối đến Google. Vui lòng thử lại!');
    }
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
                  placeholder="Email của bạn" 
                  autoComplete="email"
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
                  placeholder="Mật khẩu của bạn" 
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
                  disabled={loading}
                >
                  {loading ? 'Đang xử lý...' : '🚀 Đăng nhập / Tạo tài khoản'}
                </Button>
              </Form.Item>
            </Form>

            {/* How it works */}
            <div style={{ textAlign: 'left', padding: '0 8px' }}>
              <Text strong style={{ fontSize: '14px', color: '#1890ff' }}>
                💡 Cách hoạt động:
              </Text>
              <ul style={{ fontSize: '12px', color: '#666', marginTop: 8, paddingLeft: 16 }}>
                <li>Nếu bạn đã có tài khoản → Đăng nhập ngay</li>
                <li>Nếu chưa có tài khoản → Tự động tạo tài khoản mới</li>
                <li>Không cần phải nhớ có tài khoản hay chưa!</li>
              </ul>
            </div>

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
                disabled={loading}
                style={{ 
                  borderColor: '#db4437',
                  color: '#db4437'
                }}
              >
                Đăng nhập với Google
              </Button>
            </div>

            {/* Traditional Register Link (optional) */}
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Muốn tạo tài khoản thủ công? {' '}
                <Link to="/register" style={{ fontWeight: 500 }}>
                  Đăng ký truyền thống
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