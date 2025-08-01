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

  // FIXED: Sử dụng API URL thay vì window.location.origin
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000';

  // FIXED: Safe access to stats với default values
  const safeStats = stats || { totalLinks: 0, totalClicks: 0, avgClicks: 0 };

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
              {baseUrl}/{record.shortCode}
            </Text>
            <Button 
              type="link" 
              icon={<CopyOutlined />} 
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => copyToClipboard(`${baseUrl}/${record.shortCode}`)}
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
              title="Bạn có chắc chắn muốn xóa liên kết này?"
              description="Hành động này không thể hoàn tác!"
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

  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="Chưa có liên kết nào"
      style={{ padding: '60px 0' }}
    >
      <Link to="/create">
        <Button type="primary" icon={<PlusOutlined />}>
          Tạo liên kết đầu tiên
        </Button>
      </Link>
    </Empty>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">Chào mừng trở lại, {user?.name || 'User'}!</Text>
          </div>
          <Link to="/create">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              Tạo Liên Kết Mới
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Tổng Liên Kết"
                value={safeStats.totalLinks || 0}
                prefix={<LinkOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Tổng Clicks"
                value={safeStats.totalClicks || 0}
                prefix={<EyeOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Clicks Trung Bình"
                value={safeStats.avgClicks || 0}
                precision={1}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Tìm kiếm liên kết..."
                allowClear
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="Lọc theo chiến dịch"
                allowClear
                style={{ width: '100%' }}
                value={selectedCampaign}
                onChange={setSelectedCampaign}
              >
                {campaigns.map(campaign => (
                  <Option key={campaign} value={campaign}>
                    {campaign}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary">
                  Hiển thị {filteredLinks.length} / {links.length} liên kết
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Links Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={filteredLinks}
            loading={loading}
            rowKey="id"
            locale={{
              emptyText: renderEmptyState()
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} của ${total} liên kết`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default DashboardPage;