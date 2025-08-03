// frontend/src/pages/AnalyticsPage.js - REAL DATA from ElasticSearch
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Select, 
  Typography, 
  Space, 
  Empty,
  Spin,
  Button,
  message,
  Alert
} from 'antd';
import {
  BarChartOutlined,
  EyeOutlined,
  MobileOutlined,
  DesktopOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  UserOutlined,
  LinkOutlined,
  ReloadOutlined,
  DownloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { useLinkStore } from '../stores/linkStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const AnalyticsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const linkId = searchParams.get('link');
  const [dateRange, setDateRange] = useState('7d');
  const [selectedLinkId, setSelectedLinkId] = useState(linkId);
  const [realData, setRealData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { links, fetchLinks } = useLinkStore();

  // Fetch links when component mounts
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Fetch real analytics data
  const fetchAnalytics = async (targetLinkId, range) => {
    if (!targetLinkId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/analytics/links/${targetLinkId}?period=${range}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setRealData(data.data);
        console.log('📊 Real analytics data:', data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch analytics');
      }
    } catch (err) {
      console.error('❌ Analytics fetch error:', err);
      setError(err.message);
      message.error('Không thể tải dữ liệu analytics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics when linkId or dateRange changes
  useEffect(() => {
    if (selectedLinkId || linkId) {
      const targetLinkId = selectedLinkId || linkId;
      fetchAnalytics(targetLinkId, dateRange);
    }
  }, [selectedLinkId, linkId, dateRange]);

  const currentLink = links.find(link => link.id === (selectedLinkId || linkId));

  // Handle link selection
  const handleLinkSelect = (value) => {
    setSelectedLinkId(value);
    setSearchParams({ link: value });
  };

  // Export analytics
  const handleExport = async (format = 'json') => {
    try {
      const token = localStorage.getItem('token');
      const linkToExport = selectedLinkId || linkId;
      
      const response = await fetch(`/api/analytics/export/${linkToExport}?period=${dateRange}&format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${currentLink?.shortCode || 'data'}-${dateRange}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        message.success(`Analytics đã được xuất dưới dạng ${format.toUpperCase()}`);
      } else {
        throw new Error('Export failed');
      }
    } catch (err) {
      console.error('❌ Export error:', err);
      message.error('Không thể xuất dữ liệu');
    }
  };

  // Transform real data for charts
  const getChartData = () => {
    if (!realData) return { clicksOverTime: [], deviceData: [], browserData: [], locationData: [] };

    // Transform daily clicks for line chart
    const clicksOverTime = realData.dailyClicks?.map(item => ({
      date: dayjs(item.date).format('DD/MM'),
      clicks: item.clicks
    })) || [];

    // Transform device data for pie chart
    const deviceData = realData.topDevices?.map((item, index) => ({
      name: item.device,
      value: item.clicks,
      color: ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'][index] || '#d9d9d9'
    })) || [];

    // Transform browser data for bar chart
    const browserData = realData.topBrowsers?.map(item => ({
      browser: item.browser,
      clicks: item.clicks
    })) || [];

    // Transform location data for bar chart
    const locationData = realData.topCountries?.map(item => ({
      country: item.country,
      clicks: item.clicks
    })) || [];

    return { clicksOverTime, deviceData, browserData, locationData };
  };

  const { clicksOverTime, deviceData, browserData, locationData } = getChartData();
  const totalClicks = realData?.totalClicks || 0;
  const uniqueClicks = realData?.uniqueClicks || 0;
  const clickRate = totalClicks > 0 ? ((uniqueClicks / totalClicks) * 100).toFixed(1) : 0;

  // If no links available
  if (!loading && links.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px' }}>
        <Empty
          image={<BarChartOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            <div>
              <Title level={4} type="secondary">Chưa có liên kết nào</Title>
              <Text type="secondary">
                Bạn cần tạo ít nhất một liên kết để xem analytics.
              </Text>
            </div>
          }
        >
          <Button 
            type="primary" 
            icon={<LinkOutlined />}
            onClick={() => navigate('/create')}
          >
            Tạo Liên Kết Đầu Tiên
          </Button>
        </Empty>
      </div>
    );
  }

  // If no link selected but links exist
  if (!selectedLinkId && !linkId && links.length > 0) {
    return (
      <div style={{ padding: '0 24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <BarChartOutlined style={{ marginRight: 8 }} />
              Analytics
            </Title>
            <Text type="secondary">
              Chọn một liên kết để xem phân tích chi tiết
            </Text>
          </div>

          <Card>
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <LinkOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <Title level={4}>Chọn liên kết để phân tích</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                Bạn có {links.length} liên kết. Chọn một liên kết để xem analytics chi tiết.
              </Text>
              
              <Select
                placeholder="Chọn liên kết..."
                style={{ width: '100%', maxWidth: 500 }}
                size="large"
                onChange={handleLinkSelect}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {links.map(link => (
                  <Option key={link.id} value={link.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontWeight: 500 }}>
                          {link.title || link.shortCode}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {link.originalUrl.length > 50 
                            ? link.originalUrl.substring(0, 50) + '...' 
                            : link.originalUrl
                          }
                        </div>
                      </div>
                      <div style={{ marginLeft: 16, color: '#1890ff' }}>
                        {link.clickCount || 0} clicks
                      </div>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>
          </Card>
        </Space>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 24px' }}>
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header with Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <Title level={2} style={{ margin: 0 }}>
                <BarChartOutlined style={{ marginRight: 8 }} />
                Analytics
              </Title>
              {currentLink && (
                <div>
                  <Text type="secondary" style={{ fontSize: 16 }}>
                    Phân tích cho: <Text strong>{currentLink.title || currentLink.shortCode}</Text>
                  </Text>
                  {realData && (
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Dữ liệu từ {dayjs(realData.dateRange?.start).format('DD/MM/YYYY')} đến {dayjs(realData.dateRange?.end).format('DD/MM/YYYY')}
                      </Text>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <Space wrap>
              {/* Link Selector */}
              <Select
                value={selectedLinkId || linkId}
                onChange={handleLinkSelect}
                style={{ width: 250 }}
                placeholder="Chọn liên kết khác"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {links.map(link => (
                  <Option key={link.id} value={link.id}>
                    {link.title || link.shortCode}
                  </Option>
                ))}
              </Select>
              
              {/* Date Range Selector */}
              <Select
                value={dateRange}
                onChange={setDateRange}
                style={{ width: 120 }}
              >
                <Option value="1d">1 ngày</Option>
                <Option value="7d">7 ngày</Option>
                <Option value="30d">30 ngày</Option>
                <Option value="90d">90 ngày</Option>
              </Select>

              {/* Export Button */}
              <Select
                placeholder="Xuất dữ liệu"
                style={{ width: 120 }}
                onChange={handleExport}
                value={undefined}
              >
                <Option value="json">
                  <DownloadOutlined /> JSON
                </Option>
                <Option value="csv">
                  <DownloadOutlined /> CSV
                </Option>
              </Select>

              {/* Refresh Button */}
              <Button 
                icon={<ReloadOutlined />}
                onClick={() => fetchAnalytics(selectedLinkId || linkId, dateRange)}
                loading={loading}
              >
                Tải lại
              </Button>
            </Space>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message="Lỗi tải dữ liệu"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          {/* Stats Overview */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng clicks"
                  value={totalClicks}
                  prefix={<EyeOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Clicks duy nhất"
                  value={uniqueClicks}
                  prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tỷ lệ unique"
                  value={clickRate}
                  precision={1}
                  suffix="%"
                  prefix={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Clicks/ngày TB"
                  value={clicksOverTime.length > 0 ? Math.round(totalClicks / clicksOverTime.length) : 0}
                  prefix={<BarChartOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts */}
          {totalClicks > 0 ? (
            <Row gutter={[16, 16]}>
              {/* Clicks Over Time */}
              <Col xs={24} lg={16}>
                <Card title="Lượt click theo thời gian">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={clicksOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="clicks" 
                        stroke="#1890ff" 
                        strokeWidth={2}
                        dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Device Distribution */}
              <Col xs={24} lg={8}>
                <Card title="Thiết bị truy cập">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={deviceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {deviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Browser Stats */}
              <Col xs={24} lg={12}>
                <Card title="Trình duyệt">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={browserData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="browser" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Location Stats */}
              <Col xs={24} lg={12}>
                <Card title="Vị trí địa lý">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={locationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="country" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="clicks" fill="#fa8c16" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          ) : (
            <Card>
              <Empty
                image={<BarChartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
                description={
                  <div>
                    <Title level={4} type="secondary">Chưa có dữ liệu clicks</Title>
                    <Text type="secondary">
                      Liên kết này chưa có clicks nào trong khoảng thời gian đã chọn.
                    </Text>
                  </div>
                }
              />
            </Card>
          )}

          {/* Link Info */}
          {currentLink && (
            <Card title="Thông tin liên kết">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">Liên kết gốc:</Text>
                      <br />
                      <Text ellipsis copyable style={{ maxWidth: 400 }}>
                        {currentLink.originalUrl}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">Liên kết rút gọn:</Text>
                      <br />
                      <Text code copyable style={{ color: '#1890ff' }}>
                        {window.location.origin}/{currentLink.shortCode}
                      </Text>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary">Ngày tạo:</Text>
                      <br />
                      <Text>{dayjs(currentLink.createdAt).format('DD/MM/YYYY HH:mm')}</Text>
                    </div>
                    {currentLink.campaign && (
                      <div>
                        <Text type="secondary">Chiến dịch:</Text>
                        <br />
                        <Text strong style={{ color: '#1890ff' }}>{currentLink.campaign}</Text>
                      </div>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          )}
        </Space>
      </Spin>
    </div>
  );
};

export default AnalyticsPage;