// frontend/src/pages/DashboardPage.js - FIXED IMPORTS
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // ← Thêm useLocation
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Statistic,
  Row,
  Col,
  Tag,
  Tooltip,
  Popconfirm,
  Alert,
  Input,
  Select,
  Empty,
  Spin,
  message
} from 'antd';
import {
  LinkOutlined,
  EyeOutlined,
  BarChartOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  UserOutlined,
  GlobalOutlined,
  SearchOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

// ← Thêm các imports còn thiếu
import useAuthStore from '../stores/authStore';
import { useLinkStore } from '../stores/linkStore';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const DashboardPage = () => {
  const navigate = useNavigate(); // ← Thêm hook navigate
  const location = useLocation();
  const { user } = useAuthStore();
  const { links, stats, loading, fetchLinks, fetchStats, deleteLink } = useLinkStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

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

  // ✅ FIX: Memoize load function to prevent recreation
  const loadDashboardData = useCallback(async () => {
    if (isInitialized) return; // Prevent double loading
    
    try {
      console.log('🔄 Loading dashboard data...');
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
    } finally {
      setIsInitialized(true);
    }
  }, [isInitialized, fetchLinks, fetchStats, location.state]);

  // ✅ FIX: Remove functions from dependencies, use ref instead
  useEffect(() => {
    loadDashboardData();
  }, []); // ✅ Empty dependencies to run only once

  // ✅ Separate effect for location state changes
  useEffect(() => {
    if (location.state?.newLink && isInitialized) {
      message.success(`Liên kết ${location.state.newLink.shortCode} đã được tạo!`);
      window.history.replaceState(null, '');
    }
  }, [location.state, isInitialized]);

  // Refresh data manually
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Manual refresh dashboard data...');
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

  // ← Thêm function handleEdit
  const handleEdit = (record) => {
    // TODO: Implement edit functionality
    message.info('Chức năng chỉnh sửa đang được phát triển');
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

  // Table columns configuration
  const columns = [
    {
      title: 'Liên kết',
      key: 'link',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space>
            <Text strong style={{ color: '#1890ff' }}>
              {record.title || `Link ${record.shortCode}`}
            </Text>
            {record.campaign && (
              <Tag color="blue" size="small">
                {record.campaign}
              </Tag>
            )}
          </Space>
          <Space>
            {/* Domain indicator */}
            <Tag 
              color={record.domain?.domain === 'shortlink.com' ? 'default' : 'purple'} 
              size="small"
              icon={<GlobalOutlined />}
            >
              {record.domain?.domain || 'shortlink.com'}
            </Tag>
            <Text code copyable style={{ fontSize: 12 }}>
              {record.shortCode}
            </Text>
          </Space>
          <Text 
            type="secondary" 
            ellipsis={{ tooltip: record.originalUrl }}
            style={{ fontSize: 12, maxWidth: 300 }}
          >
            {record.originalUrl}
          </Text>
        </Space>
      ),
    },
    {
      title: 'URL ngắn',
      dataIndex: 'shortUrl',
      key: 'shortUrl',
      render: (shortUrl, record) => {
        // Generate full URL with domain
        const fullUrl = record.domain?.domain 
          ? `https://${record.domain.domain}/${record.shortCode}`
          : `${window.location.origin}/${record.shortCode}`;
        
        return (
          <Space>
            <Button
              type="link"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(fullUrl)}
              style={{ padding: 0 }}
            >
              Copy
            </Button>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => window.open(fullUrl, '_blank')}
              style={{ padding: 0 }}
            >
              Xem
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'Thống kê',
      key: 'stats',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space>
            <EyeOutlined style={{ color: '#52c41a' }} />
            <Text strong>{record.clickCount || 0}</Text>
            <Text type="secondary">clicks</Text>
          </Space>
          <Space>
            <UserOutlined style={{ color: '#1890ff' }} />
            <Text strong>{record.uniqueClicks || 0}</Text>
            <Text type="secondary">unique</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Space direction="vertical" size={2}>
          <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(date).format('HH:mm')}
          </Text>
        </Space>
      ),
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Xem analytics">
            <Button
              type="text"
              icon={<BarChartOutlined />}
              size="small"
              onClick={() => navigate(`/analytics?link=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa liên kết"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(record.id, record.shortCode)}
            okText="Xóa"
            cancelText="Hủy"
            okType="danger"
          >
            <Tooltip title="Xóa">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Spin spinning={loading && !isInitialized}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24 
        }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Dashboard
            </Title>
            <Text type="secondary">
              Xin chào {user?.name || 'User'}! 
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
        {safeLinks.length === 0 && !loading && isInitialized && (
          <Alert
            message="Chưa có dữ liệu"
            description="Bạn chưa tạo liên kết nào. Hãy tạo liên kết đầu tiên để bắt đầu!"
            type="info"
            showIcon
            style={{ margin: '24px 0' }}
            action={
              <Link to="/create">
                <Button type="primary" size="small">
                  Tạo Liên Kết Ngay
                </Button>
              </Link>
            }
          />
        )}

        {/* Links Table */}
        {safeLinks.length > 0 && (
          <Card 
            title="Quản Lý Liên Kết" 
            style={{ marginTop: 24 }}
            extra={
              <Space>
                <Search
                  placeholder="Tìm kiếm liên kết..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                {campaigns.length > 0 && (
                  <Select
                    placeholder="Lọc theo campaign"
                    value={selectedCampaign}
                    onChange={setSelectedCampaign}
                    style={{ width: 150 }}
                    allowClear
                  >
                    {campaigns.map(campaign => (
                      <Option key={campaign} value={campaign}>
                        {campaign}
                      </Option>
                    ))}
                  </Select>
                )}
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={filteredLinks}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `Tổng ${total} liên kết`,
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Không tìm thấy liên kết nào"
                  />
                )
              }}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default DashboardPage;