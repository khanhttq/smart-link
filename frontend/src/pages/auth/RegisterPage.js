// frontend/src/pages/auth/RegisterPage.js
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
  MailOutlined,
  GoogleOutlined,
  LinkOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();

  const handleSubmit = async (values) => {
    setLoading(true);
    
    const result = await register({
      name: values.name,
      email: values.email,
      password: values.password
    });
    
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
                Đăng ký
              </Title>
              <Text type="secondary">
                Tạo tài khoản mới để bắt đầu sử dụng
              </Text>
            </div>

            {/* Register Form */}
            <Form
              form={form}
              name="register"
              onFinish={handleSubmit}
              layout="vertical"
              size="large"
              style={{ width: '100%' }}
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
                  icon={<UserAddOutlined />}
                  block
                  size="large"
                >
                  {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                </Button>
              </Form.Item>
            </Form>

            {/* Google Register */}
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
                Đăng ký với Google
              </Button>
            </div>

            {/* Login Link */}
            <div>
              <Text type="secondary">
                Đã có tài khoản? {' '}
                <Link to="/login" style={{ fontWeight: 500 }}>
                  Đăng nhập ngay
                </Link>
              </Text>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
};

export default RegisterPage;