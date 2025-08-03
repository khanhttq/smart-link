// frontend/src/pages/ProfilePage.js
import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Space, 
  Avatar,
  Row,
  Col,
  Divider,
  message
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  SaveOutlined,
  CameraOutlined
} from '@ant-design/icons';
import useAuthStore from '../stores/authStore';
import axios from 'axios';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  // Initialize form with user data
  React.useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        name: user.name,
        email: user.email
      });
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values) => {
    setLoading(true);
    try {
      const response = await axios.put('/api/users/profile', {
        name: values.name,
        email: values.email
      });
      
      const updatedUser = response.data.data;
      updateUser(updatedUser);
      message.success('Cập nhật hồ sơ thành công!');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Cập nhật thất bại';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    setPasswordLoading(true);
    try {
      await axios.put('/api/users/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      
      message.success('Đổi mật khẩu thành công!');
      passwordForm.resetFields();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Đổi mật khẩu thất bại';
      message.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Hồ sơ cá nhân</Title>
          <Text type="secondary">Quản lý thông tin tài khoản của bạn</Text>
        </div>

        <Row gutter={[24, 24]}>
          {/* Profile Info */}
          <Col xs={24} md={16}>
            <Card title="Thông tin cá nhân">
              <Form
                form={profileForm}
                layout="vertical"
                onFinish={handleUpdateProfile}
                size="large"
              >
                <Form.Item
                  label="Họ và tên"
                  name="name"
                  rules={[
                    { required: true, message: 'Vui lòng nhập họ tên!' },
                    { min: 2, message: 'Họ tên phải có ít nhất 2 ký tự!' }
                  ]}
                >
                  <Input prefix={<UserOutlined />} />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Vui lòng nhập email!' },
                    { type: 'email', message: 'Email không hợp lệ!' }
                  ]}
                >
                  <Input prefix={<MailOutlined />} />
                </Form.Item>

                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    icon={<SaveOutlined />}
                  >
                    Cập nhật thông tin
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* Avatar Section */}
          <Col xs={24} md={8}>
            <Card title="Ảnh đại diện">
              <div style={{ textAlign: 'center' }}>
                <Avatar 
                  size={120} 
                  icon={<UserOutlined />}
                  src={user?.avatar}
                  style={{ marginBottom: 16 }}
                />
                <br />
                <Button 
                  icon={<CameraOutlined />}
                  onClick={() => message.info('Tính năng upload ảnh sẽ có trong phiên bản tiếp theo!')}
                >
                  Thay đổi ảnh
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Change Password */}
        <Card title="Đổi mật khẩu">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            size="large"
            style={{ maxWidth: 400 }}
          >
            <Form.Item
              label="Mật khẩu hiện tại"
              name="currentPassword"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu hiện tại!' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item
              label="Mật khẩu mới"
              name="newPassword"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item
              label="Xác nhận mật khẩu mới"
              name="confirmNewPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Vui lòng xác nhận mật khẩu mới!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={passwordLoading}
                icon={<SaveOutlined />}
              >
                Đổi mật khẩu
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Account Stats */}
        <Card title="Thống kê tài khoản">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ color: '#1890ff', margin: 0 }}>
                  {user?.stats?.totalLinks || 0}
                </Title>
                <Text type="secondary">Liên kết đã tạo</Text>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ color: '#52c41a', margin: 0 }}>
                  {user?.stats?.totalClicks || 0}
                </Title>
                <Text type="secondary">Tổng clicks</Text>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ textAlign: 'center' }}>
                <Title level={3} style={{ color: '#722ed1', margin: 0 }}>
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '-'}
                </Title>
                <Text type="secondary">Ngày tham gia</Text>
              </div>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  );
};

export default ProfilePage;