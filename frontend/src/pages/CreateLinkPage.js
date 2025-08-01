// frontend/src/pages/CreateLinkPage.js
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
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CreateLinkPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const response = await axios.post('/api/links', {
        originalUrl: values.originalUrl,
        shortCode: values.customShortCode || undefined,
        title: values.title || undefined,
        campaign: values.campaign || undefined,
        description: values.description || undefined
      });

      const { shortCode, shortUrl } = response.data.data;
      
      message.success('Liên kết đã được tạo thành công!');
      
      // Redirect to dashboard with success message
      navigate('/dashboard', { 
        state: { 
          newLink: { shortCode, shortUrl, originalUrl: values.originalUrl }
        }
      });
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Tạo liên kết thất bại';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleValuesChange = (_, allValues) => {
    if (allValues.originalUrl) {
      setPreviewData({
        originalUrl: allValues.originalUrl,
        shortCode: allValues.customShortCode || 'abc123',
        title: allValues.title,
        campaign: allValues.campaign
      });
    } else {
      setPreviewData(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Đã sao chép liên kết!');
  };

  const baseUrl = window.location.origin;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card>
        <div style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <ThunderboltOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
            <Title level={2} style={{ margin: 0 }}>Tạo Liên Kết Rút Gọn</Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Tạo liên kết ngắn gọn, dễ chia sẻ với analytics chi tiết
            </Text>
          </div>

          <Divider />

          {/* Form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={handleValuesChange}
            size="large"
          >
            <Form.Item
              label="Liên kết gốc"
              name="originalUrl"
              rules={[
                { required: true, message: 'Vui lòng nhập liên kết gốc!' },
                { type: 'url', message: 'Vui lòng nhập URL hợp lệ!' }
              ]}
            >
              <Input 
                prefix={<LinkOutlined />}
                placeholder="https://example.com/very-long-url"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Mã tùy chỉnh (tùy chọn)"
              name="customShortCode"
              rules={[
                { pattern: /^[a-zA-Z0-9-_]+$/, message: 'Chỉ được sử dụng chữ cái, số, dấu gạch ngang và gạch dưới!' }
              ]}
            >
              <Input 
                addonBefore={`${baseUrl}/`}
                placeholder="my-custom-link"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Tiêu đề (tùy chọn)"
              name="title"
            >
              <Input 
                placeholder="Mô tả ngắn gọn về liên kết"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Chiến dịch (tùy chọn)"
              name="campaign"
            >
              <Input 
                placeholder="summer-sale, social-media, email-campaign"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Mô tả (tùy chọn)"
              name="description"
            >
              <TextArea 
                rows={4}
                placeholder="Mô tả chi tiết về liên kết này..."
                size="large"
              />
            </Form.Item>

            {/* Action Buttons */}
            <Form.Item>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                <Button 
                  size="large" 
                  onClick={() => navigate('/dashboard')}
                  style={{ minWidth: 120 }}
                >
                  Hủy
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<LinkOutlined />}
                  size="large"
                  style={{ minWidth: 160 }}
                >
                  {loading ? 'Đang tạo...' : 'Tạo Liên Kết'}
                </Button>
              </div>
            </Form.Item>
          </Form>
        </div>
      </Card>

      {/* Preview Card */}
      {previewData && (
        <Card 
          title={<><LinkOutlined /> Xem trước liên kết</>}
          style={{ marginTop: 24 }}
          type="inner"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <Text strong>Liên kết gốc: </Text>
              <Text copyable>{previewData.originalUrl}</Text>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>Liên kết rút gọn: </Text>
              <Text code style={{ color: '#1890ff' }}>
                {baseUrl}/{previewData.shortCode}
              </Text>
              <Button 
                type="link" 
                icon={<CopyOutlined />} 
                size="small"
                onClick={() => copyToClipboard(`${baseUrl}/${previewData.shortCode}`)}
              />
            </div>
            
            {previewData.title && (
              <div>
                <Text strong>Tiêu đề: </Text>
                <Text>{previewData.title}</Text>
              </div>
            )}
            
            {previewData.campaign && (
              <div>
                <Text strong>Chiến dịch: </Text>
                <Text type="secondary">{previewData.campaign}</Text>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tips */}
      <Alert
        message="💡 Mẹo sử dụng"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Để trống mã tùy chỉnh để hệ thống tự tạo mã ngẫu nhiên</li>
            <li>Sử dụng chiến dịch để phân loại và theo dõi hiệu quả</li>
            <li>Tiêu đề giúp bạn dễ dàng nhận diện liên kết trong danh sách</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginTop: 24 }}
      />
    </div>
  );
};

export default CreateLinkPage;