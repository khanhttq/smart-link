// frontend/src/pages/DomainManagementPage.js
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Alert,
  Typography,
  Tooltip,
  Popconfirm,
  message,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import {
  PlusOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  SettingOutlined,
  CopyOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;

const DomainManagementPage = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [form] = Form.useForm();
  const { user } = useAuth();

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/domains', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setDomains(data.data);
      } else {
        message.error('Không thể tải danh sách domains');
      }
    } catch (error) {
      console.error('Failed to fetch domains:', error);
      message.error('Lỗi kết nối khi tải domains');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (values) => {
    try {
      const response = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('Domain đã được thêm thành công');
        setShowAddModal(false);
        form.resetFields();
        fetchDomains();
      } else {
        message.error(data.message || 'Không thể thêm domain');
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
      message.error('Lỗi khi thêm domain');
    }
  };

  const handleVerifyDomain = async (domainId) => {
    try {
      const response = await fetch(`/api/domains/${domainId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('Domain đã được xác thực thành công!');
        fetchDomains();
      } else {
        message.error(data.message || 'Xác thực domain thất bại');
      }
    } catch (error) {
      console.error('Failed to verify domain:', error);
      message.error('Lỗi khi xác thực domain');
    }
  };

  const handleDeleteDomain = async (domainId) => {
    try {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        message.success('Domain đã được xóa');
        fetchDomains();
      } else {
        message.error(data.message || 'Không thể xóa domain');
      }
    } catch (error) {
      console.error('Failed to delete domain:', error);
      message.error('Lỗi khi xóa domain');
    }
  };

  const showVerificationModal = async (domain) => {
    try {
      const response = await fetch(`/api/domains/${domain.id}/verification`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedDomain({ ...domain, verification: data.data });
        setShowVerifyModal(true);
      } else {
        message.error('Không thể lấy thông tin xác thực');
      }
    } catch (error) {
      console.error('Failed to get verification info:', error);
      message.error('Lỗi khi lấy thông tin xác thực');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Đã copy vào clipboard');
  };

  const getStatusTag = (domain) => {
    if (domain.isVerified) {
      return <Tag color="success" icon={<CheckCircleOutlined />}>Đã xác thực</Tag>;
    } else if (domain.verificationAttempts > 0) {
      return <Tag color="warning" icon={<ClockCircleOutlined />}>Đang xác thực</Tag>;
    } else {
      return <Tag color="default" icon={<ExclamationCircleOutlined />}>Chưa xác thực</Tag>;
    }
  };

  const getUsagePercent = (domain) => {
    if (!domain.monthlyLinkLimit) return 0;
    return (domain.monthlyUsage / domain.monthlyLinkLimit) * 100;
  };

  const columns = [
    {
      title: 'Domain',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain, record) => (
        <Space direction="vertical" size={4}>
          <Text strong style={{ fontSize: 16 }}>{domain}</Text>
          {record.displayName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.displayName}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isVerified',
      key: 'status',
      render: (_, record) => getStatusTag(record),
    },
    {
      title: 'Sử dụng / Giới hạn',
      key: 'usage',
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text>
            {record.monthlyUsage || 0} / {record.monthlyLinkLimit || '∞'}
          </Text>
          {record.monthlyLinkLimit && (
            <Progress
              percent={getUsagePercent(record)}
              size="small"
              status={getUsagePercent(record) > 80 ? 'exception' : 'normal'}
            />
          )}
        </Space>
      ),
    },
    {
      title: 'SSL',
      dataIndex: 'sslEnabled',
      key: 'ssl',
      render: (ssl) => (
        <Tag color={ssl ? 'success' : 'default'}>
          {ssl ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {!record.isVerified && (
            <Tooltip title="Xem hướng dẫn xác thực">
              <Button
                type="link"
                icon={<InfoCircleOutlined />}
                onClick={() => showVerificationModal(record)}
              >
                Xác thực
              </Button>
            </Tooltip>
          )}
          
          {!record.isVerified && record.verificationAttempts > 0 && (
            <Tooltip title="Thử xác thực lại">
              <Button
                type="link"
                icon={<ReloadOutlined />}
                onClick={() => handleVerifyDomain(record.id)}
              >
                Retry
              </Button>
            </Tooltip>
          )}
          
          <Tooltip title="Cài đặt domain">
            <Button
              type="link"
              icon={<SettingOutlined />}
              disabled
            >
              Cài đặt
            </Button>
          </Tooltip>
          
          <Popconfirm
            title="Xóa domain"
            description="Bạn có chắc muốn xóa domain này? Tất cả links sử dụng domain sẽ bị ảnh hưởng."
            onConfirm={() => handleDeleteDomain(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okType="danger"
          >
            <Tooltip title="Xóa domain">
              <Button
                type="link"
                icon={<DeleteOutlined />}
                danger
              >
                Xóa
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Statistics
  const totalDomains = domains.length;
  const verifiedDomains = domains.filter(d => d.isVerified).length;
  const totalUsage = domains.reduce((sum, d) => sum + (d.monthlyUsage || 0), 0);

  return (
    <div style={{ padding: '0 24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <GlobalOutlined style={{ marginRight: 8 }} />
              Quản lý Domains
            </Title>
            <Text type="secondary">
              Thêm và quản lý các domain tùy chỉnh cho shortlinks của bạn
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setShowAddModal(true)}
          >
            Thêm Domain Mới
          </Button>
        </div>

        {/* Stats Overview */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Tổng Domains"
                value={totalDomains}
                prefix={<GlobalOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Đã Xác Thực"
                value={verifiedDomains}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Links Tháng Này"
                value={totalUsage}
                prefix={<GlobalOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Info Alert */}
        <Alert
          message="Thông tin quan trọng"
          description="Domain cần được xác thực ownership thông qua DNS records trước khi có thể sử dụng. Default domain (shortlink.com) luôn khả dụng."
          type="info"
          showIcon
        />

        {/* Domains Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={domains}
            rowKey="id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} của ${total} domains`,
            }}
          />
        </Card>
      </Space>

      {/* Add Domain Modal */}
      <Modal
        title="Thêm Domain Tùy Chỉnh"
        open={showAddModal}
        onCancel={() => setShowAddModal(false)}
        footer={null}
        width={600}
      >
        <Alert
          message="Lưu ý"
          description="Sau khi thêm domain, bạn cần cấu hình DNS records để xác thực ownership. Domain chỉ có thể sử dụng sau khi được xác thực thành công."
          type="info"
          style={{ marginBottom: 20 }}
        />
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddDomain}
        >
          <Form.Item
            name="domain"
            label="Domain"
            rules={[
              { required: true, message: 'Vui lòng nhập domain' },
              { 
                pattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}\.)*[a-zA-Z]{2,}$/, 
                message: 'Domain không hợp lệ (ví dụ: abc.com)' 
              }
            ]}
          >
            <Input 
              placeholder="abc.com" 
              prefix={<GlobalOutlined />}
            />
          </Form.Item>
          
          <Form.Item
            name="displayName"
            label="Tên hiển thị (tùy chọn)"
            extra="Tên hiển thị trong giao diện, để trống sẽ dùng domain"
          >
            <Input placeholder="ABC Company" />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Thêm Domain
              </Button>
              <Button onClick={() => setShowAddModal(false)}>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Verification Modal */}
      <Modal
        title="Hướng dẫn xác thực Domain"
        open={showVerifyModal}
        onCancel={() => setShowVerifyModal(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setShowVerifyModal(false)}>
            Đóng
          </Button>,
          <Button 
            key="verify" 
            type="primary" 
            onClick={() => handleVerifyDomain(selectedDomain?.id)}
          >
            Kiểm tra xác thực
          </Button>
        ]}
      >
        {selectedDomain && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message={`Xác thực ownership cho domain: ${selectedDomain.domain}`}
              type="warning"
              showIcon
            />
            
            <div>
              <Title level={4}>Bước 1: Thêm TXT Record</Title>
              <Paragraph>
                Thêm TXT record sau vào DNS của domain <Text code>{selectedDomain.domain}</Text>:
              </Paragraph>
              
              <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Name/Host:</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      _shortlink-verify
                      <Button 
                        type="link" 
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard('_shortlink-verify')}
                      />
                    </Text>
                  </div>
                  <div>
                    <Text strong>Value:</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      {selectedDomain.verification?.token || 'sl-verify-xxxxx'}
                      <Button 
                        type="link" 
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(selectedDomain.verification?.token || '')}
                      />
                    </Text>
                  </div>
                  <div>
                    <Text strong>TTL:</Text>
                    <Text code style={{ marginLeft: 8 }}>300 (hoặc mặc định)</Text>
                  </div>
                </Space>
              </Card>
            </div>
            
            <div>
              <Title level={4}>Bước 2: Cấu hình CNAME (Tùy chọn)</Title>
              <Paragraph>
                Để shortlinks hoạt động, thêm CNAME record:
              </Paragraph>
              
              <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Name/Host:</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      @
                      <Button 
                        type="link" 
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard('@')}
                      />
                    </Text>
                  </div>
                  <div>
                    <Text strong>Value:</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      shortlink.com
                      <Button 
                        type="link" 
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard('shortlink.com')}
                      />
                    </Text>
                  </div>
                </Space>
              </Card>
            </div>

            <Alert
              message="Lưu ý"
              description="DNS thay đổi có thể mất 5-15 phút để có hiệu lực. Sau khi cấu hình xong, nhấn 'Kiểm tra xác thực' để hoàn tất."
              type="info"
            />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default DomainManagementPage;