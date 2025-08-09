// frontend/src/pages/AdminDashboardPage.js
import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Alert,
  Table,
  Tag,
  Button,
  Space,
  Divider,
  Progress,
  Typography,
  notification
} from 'antd';
import {
  UserOutlined,
  LinkOutlined,
  EyeOutlined,
  DashboardOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import apiClient from '../utils/apiClient';

const { Title, Text } = Typography;

const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState(null);
  const [queueStats, setQueueStats] = useState(null);
  const [recentClicks, setRecentClicks] = useState([]); // ✅ Initialize as empty array
  const [refreshing, setRefreshing] = useState(false);

  // Fetch admin dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statusRes, queueRes, clicksRes] = await Promise.all([
        apiClient.get('/api/admin/system-status'),
        apiClient.get('/api/admin/queue-stats'), 
        apiClient.get('/api/admin/recent-clicks')
      ]);

      setSystemStatus(statusRes.data.data);
      setQueueStats(queueRes.data.data);
      
      // ✅ FIXED: Ensure recentClicks is always an array
      const clicksData = clicksRes.data.data;
      setRecentClicks(Array.isArray(clicksData?.clicks) ? clicksData.clicks : []);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      
      // Handle specific error cases
      if (error.response?.status === 404) {
        notification.error({
          message: 'Trang không tồn tại',
          description: 'Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.',
          duration: 5
        });
        // Redirect to main dashboard
        navigate('/dashboard');
        return;
      }
      
      if (error.response?.status === 403) {
        notification.error({
          message: 'Không có quyền truy cập',
          description: 'Bạn không có quyền admin để xem trang này. Vui lòng liên hệ quản trị viên.',
          duration: 10
        });
        // Redirect back to user dashboard
        navigate('/dashboard');
        return;
      }
      
      if (error.response?.status === 401) {
        notification.error({
          message: 'Phiên đăng nhập hết hạn',
          description: 'Vui lòng đăng nhập lại để tiếp tục.',
          duration: 5
        });
        // Logout and redirect to login
        navigate('/login');
        return;
      }
      
      // Generic error
      notification.error({
        message: 'Lỗi tải dữ liệu',
        description: 'Không thể tải dữ liệu dashboard admin. Vui lòng thử lại sau.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    notification.success({
      message: 'Đã cập nhật',
      description: 'Dữ liệu dashboard đã được làm mới'
    });
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Render service status
  const renderServiceStatus = (service, name) => {
    const isConnected = service?.connected || service?.status === 'Connected';
    return (
      <Tag 
        icon={isConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
        color={isConnected ? 'success' : 'error'}
      >
        {name}: {isConnected ? 'Hoạt động' : 'Lỗi'}
      </Tag>
    );
  };

  // Recent clicks table columns
  const clicksColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => new Date(timestamp).toLocaleString('vi-VN'),
      width: 150
    },
    {
      title: 'Short Code',
      dataIndex: 'shortCode',
      key: 'shortCode',
      render: (code) => <Text code>{code}</Text>
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress'
    },
    {
      title: 'User Agent',
      dataIndex: 'userAgent',
      key: 'userAgent',
      ellipsis: true
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      render: (country) => country || 'Unknown'
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <DashboardOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
        <Title level={3}>Đang tải Admin Dashboard...</Title>
      </div>
    );
  }

  return (
    <div className="admin-content" style={{ padding: '24px' }}>
      {/* Header - không cần nữa vì đã có trong AdminLayout */}

      {/* System Status Alert */}
      <Alert
        message="Trạng thái hệ thống"
        description={
          <Space wrap>
            {systemStatus?.services && (
              <>
                {renderServiceStatus(systemStatus.services.elasticsearch, 'ElasticSearch')}
                {renderServiceStatus(systemStatus.services.redis, 'Redis')}
                {renderServiceStatus(systemStatus.services.queue, 'Queue')}
              </>
            )}
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Users"
              value={1234} // TODO: Get from API
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Links"
              value={5678} // TODO: Get from API
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Clicks hôm nay"
              value={892} // TODO: Get from API
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={Math.floor(systemStatus?.performance?.uptime / 3600) || 0}
              suffix="giờ"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* System Performance */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card title="Hiệu suất hệ thống" extra={<WarningOutlined />}>
            {systemStatus?.performance && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>Memory Usage:</Text>
                  <Progress 
                    percent={Math.round(
                      (systemStatus.performance.memory.used / systemStatus.performance.memory.total) * 100
                    )} 
                    status="active"
                  />
                </div>
                <div>
                  <Text>Heap Used: </Text>
                  <Text code>
                    {Math.round(systemStatus.performance.memory.heapUsed / 1024 / 1024)}MB
                  </Text>
                </div>
                <div>
                  <Text>Uptime: </Text>
                  <Text code>
                    {Math.floor(systemStatus.performance.uptime / 3600)}h {Math.floor((systemStatus.performance.uptime % 3600) / 60)}m
                  </Text>
                </div>
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Queue Statistics">
            {queueStats?.queues ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(queueStats.queues).map(([queueName, stats]) => (
                  <div key={queueName}>
                    <Text strong>{queueName}:</Text>
                    <br />
                    <Text>Waiting: {stats.waiting || 0}</Text> | 
                    <Text> Completed: {stats.completed || 0}</Text> | 
                    <Text> Failed: {stats.failed || 0}</Text>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="secondary">Không có dữ liệu queue</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card 
        title="Hoạt động gần đây" 
        extra={
          <Button size="small" onClick={() => window.location.href = '/admin/analytics'}>
            Xem tất cả
          </Button>
        }
      >
        <Table
          columns={clicksColumns}
          dataSource={Array.isArray(recentClicks) ? recentClicks : []} 
          rowKey={(record, index) => record.id || `click-${index}`}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          size="small"
          locale={{
            emptyText: 'Chưa có hoạt động nào'
          }}
        />
      </Card>

      <Divider />
      
      {/* Quick Actions */}
      <Card 
        title="Thao tác nhanh"
        extra={
          <Button 
            type="primary" 
            icon={<ReloadOutlined />}
            loading={refreshing}
            onClick={handleRefresh}
            className="admin-btn-primary"
          >
            Làm mới
          </Button>
        }
      >
        <Space wrap>
          <Button type="primary" onClick={() => window.location.href = '/admin/users'}>
            Quản lý Users
          </Button>
          <Button onClick={() => window.location.href = '/admin/links'}>
            Kiểm duyệt Links
          </Button>
          <Button onClick={() => window.location.href = '/admin/analytics'}>
            Xem Analytics
          </Button>
          <Button onClick={() => window.location.href = '/admin/system'}>
            Cài đặt hệ thống
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;