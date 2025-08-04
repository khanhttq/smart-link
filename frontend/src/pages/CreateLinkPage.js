import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateShortUrl } from '../utils/urlUtils';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Divider,
  message,
  Select,
  Space,
  Tooltip,
  Tag,
  Row,
  Col
} from 'antd';
import {
  LinkOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';

import apiClient from '../utils/apiClient';
import useAuthStore from '../stores/authStore';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const CreateLinkPage = () => {
  const { token, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      message.error('Vui lòng đăng nhập trước!');
      navigate('/login');
    } else {
      fetchDomains();
    }
  }, [isAuthenticated, token, navigate]);

  const fetchDomains = async () => {
    setDomainsLoading(true);
    try {
      const response = await apiClient.get('/api/domains');
      if (response.data.success) {
        const allDomains = [
          {
            id: null,
            domain: 'shortlink.com',
            displayName: 'shortlink.com (Mặc định)',
            isVerified: true,
            isActive: true,
            isDefault: true
          },
          ...response.data.data.filter(d => d.isVerified && d.isActive)
        ];
        setDomains(allDomains);
        setSelectedDomain(allDomains[0]);
        form.setFieldsValue({ domainId: null });
      }
    } catch (error) {
      const defaultDomain = {
        id: null,
        domain: 'shortlink.com',
        displayName: 'shortlink.com (Mặc định)',
        isVerified: true,
        isActive: true,
        isDefault: true
      };
      setDomains([defaultDomain]);
      setSelectedDomain(defaultDomain);
    } finally {
      setDomainsLoading(false);
    }
  };

  const handleDomainChange = (domainId) => {
    const domain = domains.find(d => d.id === domainId);
    setSelectedDomain(domain);
    setPreviewData(null);
  };

  const generatePreviewUrl = (shortCode) => {
  if (!shortCode) return '';
  const domain = selectedDomain || domains.find(d => d.isDefault);
  return generateShortUrl(shortCode, domain);
  };

  const handleSubmit = async (values) => {
  setLoading(true);
  try {
    if (!isAuthenticated || !token) {
      message.error('Vui lòng đăng nhập trước!');
      navigate('/login');
      return;
    }

    const requestData = {
      originalUrl: values.originalUrl,
      shortCode: values.customShortCode || undefined,
      domainId: values.domainId,
      title: values.title || undefined,
      campaign: values.campaign || undefined,
      description: values.description || undefined
    };

    const response = await apiClient.post('/api/links', requestData);
    const data = response.data?.data;

    if (!data?.shortCode) throw new Error('Định dạng phản hồi không hợp lệ');

    message.success('Liên kết đã được tạo thành công!');

    
      setPreviewData({
        shortCode: data.shortCode,
        shortUrl: fullShortUrl,
        originalUrl: values.originalUrl,
        title: values.title || data.title || 'Không có tiêu đề',
        domain: selectedDomain?.domain || 'shortlink.com',
        campaign: values.campaign || data.campaign
      });

      const currentDomainId = form.getFieldValue('domainId');
      form.resetFields();
      form.setFieldsValue({ domainId: currentDomainId });

    } catch (error) {
      if (error.response?.status === 401) {
        message.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!');
        navigate('/login');
      } else if (error.response?.status === 400) {
        message.error(error.response?.data?.message || 'Dữ liệu không hợp lệ');
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
    navigator.clipboard.writeText(text)
      .then(() => message.success('Đã sao chép vào clipboard!'))
      .catch(() => message.error('Không thể sao chép. Vui lòng copy thủ công.'));
  };

  const renderSuccessPreview = () => {
    if (!previewData) return null;
    
    return (
      <Card 
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ color: '#52c41a' }}>Liên kết đã tạo thành công!</Text>
          </Space>
        }
        size="small"
        style={{ 
          marginTop: 24,
          border: '1px solid #b7eb8f',
          backgroundColor: '#f6ffed'
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* URL gốc */}
          <div>
            <Text strong style={{ color: '#1890ff', fontSize: '13px' }}>🔗 URL gốc:</Text>
            <div style={{ marginTop: 4 }}>
              <Text 
                copyable={{ tooltips: ['Copy URL gốc', 'Đã copy!'] }}
                style={{ 
                  wordBreak: 'break-all', 
                  fontSize: '12px', 
                  color: '#666',
                  display: 'block',
                  padding: '4px 8px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px'
                }}
              >
                {previewData.originalUrl}
              </Text>
            </div>
          </div>

          {/* URL ngắn - highlight chính */}
          <div style={{ 
            padding: '12px', 
            background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)', 
            borderRadius: '8px', 
            border: '1px solid #91d5ff' 
          }}>
            <Text strong style={{ color: '#0ea5e9', fontSize: '13px' }}>⚡ URL ngắn:</Text>
            <div style={{ marginTop: 6 }}>
              <Space wrap>
                <Button
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(previewData.shortUrl)}
                  style={{ 
                    padding: '0', 
                    fontSize: '14px', 
                    fontWeight: 'bold', 
                    color: '#0ea5e9',
                    height: 'auto'
                  }}
                >
                  {previewData.shortUrl}
                </Button>
                <Tag color="blue" size="small">{previewData.domain}</Tag>
              </Space>
            </div>
          </div>

          {/* Thông tin chi tiết */}
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Text strong style={{ fontSize: '12px' }}>📝 Mã ngắn:</Text>
              <div>
                <Text code style={{ fontSize: '13px' }}>{previewData.shortCode}</Text>
              </div>
            </Col>
            <Col span={12}>
              <Text strong style={{ fontSize: '12px' }}>🏷️ Tiêu đề:</Text>
              <div>
                <Text style={{ fontSize: '13px' }} ellipsis={{ tooltip: previewData.title }}>
                  {previewData.title}
                </Text>
              </div>
            </Col>
          </Row>

          {previewData.campaign && (
            <div>
              <Text strong style={{ fontSize: '12px' }}>🎯 Campaign:</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color="green" size="small">{previewData.campaign}</Tag>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <Space wrap style={{ marginTop: 8 }}>
            <Button 
              size="small"
              icon={<CopyOutlined />} 
              onClick={() => copyToClipboard(previewData.shortUrl)}
            >
              Copy
            </Button>
            <Button 
              size="small"
              icon={<LinkOutlined />} 
              onClick={() => window.open(previewData.shortUrl, '_blank')}
              type="default"
            >
              Test
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setPreviewData(null);
                const currentDomainId = form.getFieldValue('domainId');
                form.resetFields();
                form.setFieldsValue({ domainId: currentDomainId });
              }}
            >
              Tạo mới
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh' 
      }}>
        <Title level={4}>Đang kiểm tra đăng nhập...</Title>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '16px',
      minHeight: '100vh'
    }}>
      <Row gutter={[24, 24]}>
        {/* Form Column */}
        <Col xs={24} lg={previewData ? 14 : 24}>
          <Card 
            style={{ height: 'fit-content' }}
            bodyStyle={{ padding: '24px' }}
          >
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <Title level={2} style={{ margin: 0, marginBottom: '8px' }}>
                <LinkOutlined style={{ marginRight: '8px' }} />
                Tạo liên kết ngắn
              </Title>
              <Text type="secondary">
                Tạo liên kết ngắn cho URL dài của bạn với các tùy chọn tùy chỉnh
              </Text>
            </div>
            
            <Divider style={{ margin: '24px 0' }} />

            {/* Form */}
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              disabled={loading}
              initialValues={{ domainId: null }}
              size="large"
            >
              {/* Domain Selection */}
              <Form.Item
                label={
                  <Space>
                    <GlobalOutlined />
                    <Text>Domain</Text>
                    <Tooltip title="Chọn domain để tạo shortlink. Default domain luôn khả dụng.">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                }
                name="domainId"
              >
                <Select
                  placeholder="Chọn domain"
                  onChange={handleDomainChange}
                  loading={domainsLoading}
                  suffixIcon={<GlobalOutlined />}
                >
                  {domains.map(domain => (
                    <Option key={domain.id || 'default'} value={domain.id}>
                      <Space>
                        {domain.domain}
                        {domain.isDefault && <Tag color="blue" size="small">Mặc định</Tag>}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Domain Info Alert */}
              {selectedDomain && (
                <Alert
                  message={
                    <Space>
                      <Text strong>Domain được chọn:</Text>
                      <Text code>{selectedDomain.domain}</Text>
                      {selectedDomain.isDefault && (
                        <Tag color="blue" size="small">Mặc định</Tag>
                      )}
                    </Space>
                  }
                  type="info"
                  style={{ marginBottom: '16px' }}
                  action={
                    <Button 
                      size="small" 
                      type="link" 
                      onClick={() => navigate('/domains')} 
                      icon={<PlusOutlined />}
                    >
                      Quản lý domains
                    </Button>
                  }
                />
              )}

              {/* Original URL */}
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
                  prefix={<LinkOutlined />} 
                />
              </Form.Item>

              {/* Custom Short Code */}
              <Form.Item
                label="Mã ngắn tùy chỉnh (tùy chọn)"
                name="customShortCode"
                rules={[
                  { 
                    pattern: /^[a-zA-Z0-9-_]+$/, 
                    message: 'Chỉ cho phép chữ cái, số, dấu gạch ngang và gạch dưới' 
                  },
                  { min: 3, message: 'Mã ngắn phải có ít nhất 3 ký tự' }
                ]}
                extra={selectedDomain && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    URL sẽ là: https://{selectedDomain.domain}/your-custom-code
                  </Text>
                )}
              >
                <Input 
                  placeholder="my-custom-code" 
                  prefix={<ThunderboltOutlined />} 
                />
              </Form.Item>

              {/* Title and Campaign */}
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Tiêu đề (tùy chọn)" name="title">
                    <Input placeholder="Tiêu đề mô tả cho liên kết" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Campaign (tùy chọn)" name="campaign">
                    <Input placeholder="utm_campaign_name" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Description */}
              <Form.Item label="Mô tả (tùy chọn)" name="description">
                <TextArea 
                  rows={3} 
                  placeholder="Mô tả chi tiết về liên kết này" 
                  showCount
                  maxLength={200}
                />
              </Form.Item>

              {/* Submit Button */}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  block 
                  icon={<ThunderboltOutlined />}
                  size="large"
                >
                  {loading ? 'Đang tạo...' : 'Tạo liên kết ngắn'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Preview Column */}
        {previewData && (
          <Col xs={24} lg={10}>
            {renderSuccessPreview()}
          </Col>
        )}
      </Row>
    </div>
  );
};

export default CreateLinkPage;