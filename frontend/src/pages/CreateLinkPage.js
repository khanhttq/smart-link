// frontend/src/pages/CreateLinkPage.js - FIXED VERSION
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Typography, 
  Alert,
  Divider,
  message
} from 'antd';
import { 
  LinkOutlined, 
  ThunderboltOutlined,
  CopyOutlined 
} from '@ant-design/icons';

// ✅ CRITICAL: Sử dụng apiClient thống nhất thay vì tạo instance mới
import apiClient from '../utils/apiClient';
import useAuthStore from '../stores/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateLinkPage = () => {
  // ✅ FIXED: Lấy token từ store với tên thống nhất
  const { token, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // ✅ Check auth on component mount
  React.useEffect(() => {
    if (!isAuthenticated || !token) {
      message.error('Vui lòng đăng nhập trước!');
      navigate('/login');
    }
  }, [isAuthenticated, token, navigate]);

  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      // ✅ Double check auth
      if (!isAuthenticated || !token) {
        message.error('Vui lòng đăng nhập trước!');
        navigate('/login');
        return;
      }

      console.log('🔗 Creating link for user:', user?.email);
      console.log('🔑 Using token:', token?.substring(0, 10) + '...');

      // ✅ FIXED: Sử dụng apiClient thống nhất (đã có Authorization header)
      const response = await apiClient.post('/api/links', {
        originalUrl: values.originalUrl,
        shortCode: values.customShortCode || undefined,
        title: values.title || undefined,
        campaign: values.campaign || undefined,
        description: values.description || undefined
      });

      const data = response.data?.data;
      
      if (!data?.shortCode || !data?.shortUrl) {
        throw new Error('Định dạng phản hồi không hợp lệ');
      }
      
      const { shortCode, shortUrl } = data;
      
      message.success('Liên kết đã được tạo thành công!');
      
      // Store created link data for display
      setPreviewData({
        shortCode,
        shortUrl,
        originalUrl: values.originalUrl,
        title: values.title || 'Không có tiêu đề'
      });
      
      // Reset form
      form.resetFields();
      
    } catch (error) {
      console.error('❌ Create link error:', error);
      
      // Handle specific errors
      if (error.response?.status === 401) {
        message.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
        navigate('/login');
      } else if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.message || 'Dữ liệu không hợp lệ';
        message.error(errorMessage);
      } else if (error.response?.status === 409) {
        message.error('Mã ngắn này đã được sử dụng. Vui lòng chọn mã khác!');
      } else {
        message.error(error.message || 'Có lỗi xảy ra khi tạo liên kết');
      }
      
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('Đã sao chép vào clipboard!');
    }).catch(() => {
      message.error('Không thể sao chép. Vui lòng copy thủ công.');
    });
  };

  // ✅ Show loading if checking auth
  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={4}>Đang kiểm tra đăng nhập...</Title>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Card>
        <Title level={2}>
          <LinkOutlined /> Tạo liên kết ngắn
        </Title>
        <Text type="secondary">
          Tạo liên kết ngắn cho URL dài của bạn với các tùy chọn tùy chỉnh
        </Text>

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={loading}
        >
          <Form.Item
            label="URL gốc"
            name="originalUrl"
            rules={[
              { required: true, message: 'Vui lòng nhập URL!' },
              { type: 'url', message: 'URL không hợp lệ!' }
            ]}
          >
            <Input
              placeholder="https://example.com/very-long-url"
              size="large"
              prefix={<LinkOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Mã ngắn tùy chỉnh (tùy chọn)"
            name="customShortCode"
            rules={[
              { pattern: /^[a-zA-Z0-9-_]+$/, message: 'Chỉ cho phép chữ cái, số, dấu gạch ngang và gạch dưới' }
            ]}
          >
            <Input
              placeholder="my-custom-code"
              size="large"
              prefix={<ThunderboltOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Tiêu đề (tùy chọn)"
            name="title"
          >
            <Input
              placeholder="Tiêu đề mô tả cho liên kết"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Campaign (tùy chọn)"
            name="campaign"
          >
            <Input
              placeholder="utm_campaign_name"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Mô tả (tùy chọn)"
            name="description"
          >
            <TextArea
              rows={3}
              placeholder="Mô tả chi tiết về liên kết này"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
              icon={<ThunderboltOutlined />}
            >
              {loading ? 'Đang tạo...' : 'Tạo liên kết ngắn'}
            </Button>
          </Form.Item>
        </Form>

        {/* ✅ Success preview */}
        {previewData && (
          <>
            <Divider />
            <Alert
              message="Liên kết đã được tạo thành công!"
              description={
                <div style={{ marginTop: 10 }}>
                  <div><strong>URL gốc:</strong> {previewData.originalUrl}</div>
                  <div><strong>URL ngắn:</strong> 
                    <Button
                      type="link"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(previewData.shortUrl)}
                    >
                      {previewData.shortUrl}
                    </Button>
                  </div>
                  <div><strong>Mã:</strong> {previewData.shortCode}</div>
                  <div><strong>Tiêu đề:</strong> {previewData.title}</div>
                </div>
              }
              type="success"
              showIcon
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default CreateLinkPage;