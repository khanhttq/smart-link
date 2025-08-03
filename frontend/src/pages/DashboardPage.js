// frontend/src/pages/DashboardPage.js - FIXED DOUBLE API CALLS
import React, { useState, useEffect, useCallback } from 'react';
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
import useAuthStore from '../stores/authStore';
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
      title: 'Liên Kết',
      key: 'link',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            {record.title || 'Không có tiêu đề'}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            <Text 
              copyable={{ text: `${window.location.origin}/${record.shortCode}` }}
              style={{ color: '#1890ff' }}
            >
              {window.location.origin}/{record.shortCode}
            </Text>
          </div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            <Text ellipsis style={{ maxWidth: 300 }}>
              {record.originalUrl}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      width: 80,
      render: (clicks) => (
        <Statistic 
          value={clicks || 0} 
          valueStyle={{ fontSize: 16 }}
        />
      ),
    },
    {
      title: 'Campaign',
      dataIndex: 'campaign',
      key: 'campaign',
      width: 120,
      render: (campaign) => 
        campaign ? <Tag color="blue">{campaign}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Hành Động',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem Analytics">
            <Link to={`/analytics?link=${record.id}`}>
              <Button 
                type="text" 
                icon={<BarChartOutlined />} 
                size="small"
              />
            </Link>
          </Tooltip>
          
          <Tooltip title="Sao Chép Link">
            <Button
              type="text"
              icon={<CopyOutlined />}
              size="small"
              onClick={() => copyToClipboard(`${window.location.origin}/${record.shortCode}`)}
            />
          </Tooltip>
          
          <Popconfirm
            title="Xóa liên kết này?"
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