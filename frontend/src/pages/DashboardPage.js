// frontend/src/pages/DashboardPage.js - FIXED VERSION
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
  Tooltip,
  Spin,
  Alert
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  EyeOutlined,
  BarChartOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  ReloadOutlined
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
  const [refreshing, setRefreshing] = useState(false);

  // ===== FIX: Safe stats with default fallback =====
  const safeStats = stats || { 
    totalLinks: 0, 
    totalClicks: 0, 
    avgClicks: 0,
    activeLinks: 0,
    campaignLinks: 0 
  };

  // ===== FIX: Safe links array =====
  const safeLinks = Array.isArray(links) ? links : [];

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchLinks(),
          fetchStats()
        ]);

        // Show success message if coming from create page
        if (location.state?.newLink) {
          message.success(`Liên kết ${location.state.newLink.shortCode} đã được tạo!`);
          // Clear the state to prevent showing message again
          window.history.replaceState(null, '');
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        message.error('Có lỗi khi tải dữ liệu dashboard');
      }
    };

    loadData();
  }, [fetchLinks, fetchStats, location.state]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLinks(),
        fetchStats()
      ]);
      message.success('Dữ liệu đã được cập nhật');
    } catch (error) {
      message.error('Có lỗi khi tải lại dữ liệu');
    } finally {
      setRefreshing(false);
    }
  };

  // Filter links safely
  const filteredLinks = safeLinks.filter(link => {
    const matchesSearch = !searchTerm || 
      link.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.originalUrl?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.shortCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCampaign = !selectedCampaign || link.campaign === selectedCampaign;
    
    return matchesSearch && matchesCampaign;
  });

  // Extract campaigns safely
  const campaigns = [...new Set(
    safeLinks
      .map(link => link.campaign)
      .filter(Boolean)
  )];

  const handleDelete = async (linkId, shortCode) => {
    try {
      const result = await deleteLink(linkId);
      if (result.success) {
        message.success(`Liên kết ${shortCode} đã được xóa`);
        // Refresh data after delete
        await Promise.all([
          fetchLinks(),
          fetchStats()
        ]);
      } else {
        message.error(result.error || 'Không thể xóa liên kết');
      }
    } catch (error) {
      console.error('Delete error:', error);
      message.error('Có lỗi khi xóa liên kết');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('Đã sao chép vào clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success('Đã sao chép vào clipboard!');
    }
  };

  // Use environment variable or fallback
  const baseUrl = process.env.REACT_APP_BASE_URL || 
                  process.env.REACT_APP_API_URL?.replace('/api', '') || 
                  'http://localhost:4000';

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
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Hoạt động' : 'Tạm dừng'}
        </Tag>
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
              description={`Liên kết "${record.shortCode}" sẽ bị xóa vĩnh viễn!`}
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
      description={
        <div>
          <p>Chưa có liên kết nào</p>
          <Text type="secondary">Tạo liên kết đầu tiên để bắt đầu rút gọn URL</Text>
        </div>
      }
      style={{ padding: '60px 0' }}
    >
      <Space>
        <Link to="/create">
          <Button type="primary" icon={<PlusOutlined />}>
            Tạo liên kết đầu tiên
          </Button>
        </Link>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          Tải lại
        </Button>
      </Space>
    </Empty>
  );

  // Loading state
  if (loading && safeLinks.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        flexDirection: 'column',
        gap: 16
      }}>
        <Spin size="large" />
        <Text type="secondary">Đang tải dữ liệu dashboard...</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">
              Chào mừng trở lại, {user?.name || 'User'}! 
              {safeStats.totalLinks > 0 && ` Bạn có ${safeStats.totalLinks} liên kết.`}
            </Text>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={refreshing}
            >
              Tải lại
            </Button>
            <Link to="/create">
              <Button type="primary" icon={<PlusOutlined />} size="large">
                Tạo Liên Kết Mới
              </Button>
            </Link>
          </Space>
        </div>

        {/* Stats Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Tổng Liên Kết"
                value={safeStats.totalLinks}
                prefix={<LinkOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Tổng Clicks"
                value={safeStats.totalClicks}
                prefix={<EyeOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Clicks Trung Bình"
                value={safeStats.avgClicks}
                precision={1}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Liên Kết Hoạt Động"
                value={safeStats.activeLinks}
                prefix={<LinkOutlined />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Show alert if no data */}
        {safeLinks.length === 0 && !loading && (
          <Alert
            message="Chưa có dữ liệu"
            description="Bạn chưa tạo liên kết nào. Hãy tạo liên kết đầu tiên để bắt đầu!"
            type="info"
            showIcon
            action={
              <Link to="/create">
                <Button size="small" type="primary">
                  Tạo ngay
                </Button>
              </Link>
            }
          />
        )}

        {/* Filters - Only show if there are links */}
        {safeLinks.length > 0 && (
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
                    Hiển thị {filteredLinks.length} / {safeLinks.length} liên kết
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        )}

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
              hideOnSinglePage: filteredLinks.length <= 10
            }}
            scroll={{ x: 800 }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default DashboardPage;