// frontend/src/pages/CreateLinkPage.js - FIXED với Domain Selector đơn giản
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { generateShortUrl, generatePreviewUrl } from '../utils/urlUtils';

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

  // Check auth on component mount
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
        // Add default domain to the list
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
        // Set default domain as selected
        setSelectedDomain(allDomains[0]);
        form.setFieldsValue({ domainId: null });
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      // Set only default domain if API fails
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
    setPreviewData(null); // Clear preview when domain changes
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

      console.log('🔗 Creating link for user:', user?.email);
      console.log('🌐 Selected domain:', selectedDomain?.domain || 'default');

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
      
      if (!data?.shortCode) {
        throw new Error('Định dạng phản hồi không hợp lệ');
      }
      
      message.success('Liên kết đã được tạo thành công!');
      
      // Generate full URL based on domain
      const fullShortUrl = data.fullShortUrl || generatePreviewUrl(data.shortCode);
      
      setPreviewData({
        shortCode: data.shortCode,
        shortUrl: fullShortUrl,
        originalUrl: values.originalUrl,
        title: values.title || 'Không có tiêu đề',
        domain: selectedDomain?.domain || 'shortlink.com'
      });
      
      // Reset form but keep domain selection
      const currentDomainId = form.getFieldValue('domainId');
      form.resetFields();
      form.setFieldsValue({ domainId: currentDomainId });
      
    } catch (error) {
      console.error('❌ Create link error:', error);
      
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
          initialValues={{ domainId: null }}
        >
          {/* Domain Selection - Simplified */}
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
              size="large"
              suffixIcon={<GlobalOutlined />}
            >
              {domains.map(domain => (
                <Option key={domain.id || 'default'} value={domain.id}>
                  {domain.domain}
                  {domain.isDefault && <Text type="secondary"> (Mặc định)</Text>}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Preview URL */}
          {selectedDomain && (
            <Alert
              message={
                <div>
                  <Text strong>Domain được chọn: </Text>
                  <Text code>{selectedDomain.domain}</Text>
                  {selectedDomain.isDefault && (
                    <Tag color="blue" size="small" style={{ marginLeft: 8 }}>Mặc định</Tag>
                  )}
                </div>
              }
              type="info"
              style={{ marginBottom: 16 }}
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
              size="large"
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
              {
                min: 3,
                message: 'Mã ngắn phải có ít nhất 3 ký tự'
              }
            ]}
            extra={
              selectedDomain && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  URL sẽ là: https://{selectedDomain.domain}/your-custom-code
                </Text>
              )
            }
          >
            <Input
              placeholder="my-custom-code"
              size="large"
              prefix={<ThunderboltOutlined />}
            />
          </Form.Item>

          {/* Additional Options */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tiêu đề (tùy chọn)"
                name="title"
              >
                <Input
                  placeholder="Tiêu đề mô tả cho liên kết"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Campaign (tùy chọn)"
                name="campaign"
              >
                <Input
                  placeholder="utm_campaign_name"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

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

        {/* Success Preview */}
        {previewData && (
          <>
            <Divider />
            <Alert
              message="Liên kết đã được tạo thành công!"
              description={
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>URL gốc:</Text>
                    <br />
                    <Text copyable>{previewData.originalUrl}</Text>
                  </div>
                  <div>
                    <Text strong>URL ngắn:</Text>
                    <br />
                    <Space>
                      <Button
                        type="link"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(previewData.shortUrl)}
                        style={{ padding: 0 }}
                      >
                        {previewData.shortUrl}
                      </Button>
                      <Tag color="blue">{previewData.domain}</Tag>
                    </Space>
                  </div>
                  <div>
                    <Text strong>Mã:</Text> <Text code>{previewData.shortCode}</Text>
                  </div>
                  <div>
                    <Text strong>Tiêu đề:</Text> <Text>{previewData.title}</Text>
                  </div>
                </Space>
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