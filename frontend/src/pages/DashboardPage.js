// frontend/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Input, 
  Select, 
  Button, 
  Space, 
  Typography, 
  Tag, 
  Popconfirm,
  Empty,
  message,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  EyeOutlined,
  BarChartOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useLinkStore } from '../stores/linkStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const DashboardPage = () => {
  const location = useLocation();
  const { user } = useAuthStore();
  const { links, stats, loading, fetchLinks, fetchStats, deleteLink } = useLinkStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');

  useEffect(() => {
    fetchLinks();
    fetchStats();

    // Show success message if coming from create page
    if (location.state?.newLink) {
      message.success(`Liên kết ${location.state.newLink.shortCode} đã được tạo!`);
    }
  }, [fetchLinks, fetchStats, location.state]);

  const filteredLinks = links.filter(link => {
    const matchesSearch = !searchTerm || 
      link.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.originalUrl.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.shortCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCampaign = !selectedCampaign || link.campaign === selectedCampaign;
    
    return matchesSearch && matchesCampaign;
  });

  const campaigns = [...new Set(links.map(link => link.campaign).filter(Boolean))];

  const handleDelete = async (linkId, shortCode) => {
    const result = await deleteLink(linkId);
    if (result.success) {
      message.success('Liên kết đã được xóa');
      fetchLinks(); // Refresh list
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Đã sao chép vào clipboard!');
  };

  // Table columns
  const columns = [
    {
      title: 'Liên kết',
      key: 'link',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            {record.title || 'Không có tiêu đề'}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
            <Text ellipsis style={{ maxWidth: 300 }}>
              <strong>Gốc:</strong> {record.originalUrl}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text code style={{ color: '#1890ff' }}>
              {window.location.origin}/{record.shortCode}
            </Text>
            <Button 
              type="link" 
              icon={<CopyOutlined />} 
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => copyToClipboard(`${window.location.origin}/${record.shortCode}`)}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'Chiến dịch',
      dataIndex: 'campaign',
      key: 'campaign',
      width: 120,
      render: (campaign) => campaign ? <Tag color="blue">{campaign}</Tag> : '-',
    },
    {
      title: 'Clicks',
      dataIndex: 'clickCount',
      key: 'clickCount',
      width: 80,
      render: (count) => (
        <Statistic 
          value={count || 0} 
          valueStyle={{ fontSize: 14 }}
        />
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem analytics">
            <Link to={`/analytics?link=${record.id}`}>
              <Button 
                type="link" 
                icon={<BarChartOutlined />} 
                size="small"
              />
            </Link>
          </Tooltip>
          
          <Tooltip title="Chỉnh sửa">
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => message.info('Chức năng chỉnh sửa sẽ có trong phiên bản tiếp theo!')}
            />
          </Tooltip>
          
          <Tooltip title="Xóa">
            <Popconfirm
              title="Xóa liên kết"
              description={`Bạn có chắc muốn xóa liên kết "${record.shortCode}"?`}
              onConfirm={() => handleDelete(record.id, record.shortCode)}
              okText="Xóa"
              cancelText="Hủy"
              okType="danger"
            >
              <Button 
                type="link" 
                icon={<DeleteOutlined />} 
                size="small"
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Chào mừng trở lại, {user?.name}! 👋
            </Text>
          </div>
          <Link to="/create">
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              size="large"
            >
              Tạo Liên Kết Mới
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng liên kết"
                value={stats?.totalLinks || 0}
                prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Tổng clicks"
                value={stats?.totalClicks || 0}
                prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Clicks hôm nay"
                value={stats?.todayClicks || 0}
                prefix={<BarChartOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Clicks/Link TB"
                value={stats?.totalLinks ? Math.round((stats.totalClicks || 0) / stats.totalLinks) : 0}
                prefix={<LinkOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={16}>
              <Search
                placeholder="Tìm kiếm liên kết..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                allowClear
                size="large"
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Chọn chiến dịch"
                value={selectedCampaign}
                onChange={setSelectedCampaign}
                allowClear
                size="large"
                style={{ width: '100%' }}
              >
                {campaigns.map(campaign => (
                  <Option key={campaign} value={campaign}>{campaign}</Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        {/* Links Table */}
        <Card 
          title={
            <Space>
              <LinkOutlined />
              <span>Danh sách liên kết ({filteredLinks.length})</span>
            </Space>
          }
        >
          <Table
            columns={columns}
            dataSource={filteredLinks}
            rowKey="id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} của ${total} liên kết`,
              pageSizeOptions: ['10', '20', '50'],
              defaultPageSize: 10
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <p>Chưa có liên kết nào</p>
                      <Link to="/create">
                        <Button type="primary" icon={<PlusOutlined />}>
                          Tạo liên kết đầu tiên
                        </Button>
                      </Link>
                    </div>
                  }
                />
              )
            }}
          />
        </Card>

        {/* Quick Actions */}
        <Card title="Hành động nhanh">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Link to="/create">
                <Card 
                  hoverable 
                  style={{ textAlign: 'center' }}
                  bodyStyle={{ padding: '24px 16px' }}
                >
                  <PlusOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>Tạo liên kết mới</div>
                  <Text type="secondary">Rút gọn URL mới</Text>
                </Card>
              </Link>
            </Col>
            
            <Col xs={24} sm={8}>
              <Link to="/analytics">
                <Card 
                  hoverable 
                  style={{ textAlign: 'center' }}
                  bodyStyle={{ padding: '24px 16px' }}
                >
                  <BarChartOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>Xem Analytics</div>
                  <Text type="secondary">Phân tích chi tiết</Text>
                </Card>
              </Link>
            </Col>
            
            <Col xs={24} sm={8}>
              <Link to="/profile">
                <Card 
                  hoverable 
                  style={{ textAlign: 'center' }}
                  bodyStyle={{ padding: '24px 16px' }}
                >
                  <EyeOutlined style={{ fontSize: 32, color: '#722ed1', marginBottom: 8 }} />
                  <div style={{ fontWeight: 500 }}>Cài đặt tài khoản</div>
                  <Text type="secondary">Quản lý hồ sơ</Text>
                </Card>
              </Link>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  );
};

export default DashboardPage;