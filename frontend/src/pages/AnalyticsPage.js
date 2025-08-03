// frontend/src/pages/AnalyticsPage.js
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Select, 
  Typography, 
  Space, 
  Empty,
  Spin
} from 'antd';
import {
  BarChartOutlined,
  EyeOutlined,
  MobileOutlined,
  DesktopOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  UserOutlined
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
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('link');
  const [dateRange, setDateRange] = useState('7d');
  
  const { analytics, loading, fetchLinkAnalytics, links } = useLinkStore();

  useEffect(() => {
    if (linkId) {
      fetchLinkAnalytics(linkId, dateRange);
    }
  }, [linkId, dateRange, fetchLinkAnalytics]);

  const currentLink = links.find(link => link.id === linkId);

  // Sample data for demo (sẽ được thay thế bằng data thật từ backend)
  const clicksOverTime = [
    { date: '25/01', clicks: 12 },
    { date: '26/01', clicks: 19 },
    { date: '27/01', clicks: 8 },
    { date: '28/01', clicks: 15 },
    { date: '29/01', clicks: 25 },
    { date: '30/01', clicks: 22 },
    { date: '31/01', clicks: 18 },
  ];

  const deviceData = [
    { name: 'Desktop', value: 45, color: '#1890ff' },
    { name: 'Mobile', value: 35, color: '#52c41a' },
    { name: 'Tablet', value: 20, color: '#faad14' }
  ];

  const browserData = [
    { browser: 'Chrome', clicks: 45 },
    { browser: 'Safari', clicks: 30 },
    { browser: 'Firefox', clicks: 15 },
    { browser: 'Edge', clicks: 10 }
  ];

  const locationData = [
    { country: 'Vietnam', clicks: 60 },
    { country: 'Singapore', clicks: 20 },
    { country: 'USA', clicks: 15 },
    { country: 'Others', clicks: 5 }
  ];

  const totalClicks = deviceData.reduce((sum, item) => sum + item.value, 0);

  if (!linkId) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Empty
          image={<BarChartOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          description={
            <div>
              <Title level={4} type="secondary">Chọn liên kết để xem analytics</Title>
              <Text type="secondary">
                Vui lòng chọn một liên kết từ dashboard để xem phân tích chi tiết.
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 24px' }}>
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                <BarChartOutlined style={{ marginRight: 8 }} />
                Analytics
              </Title>
              {currentLink && (
                <Text type="secondary" style={{ fontSize: 16 }}>
                  Phân tích cho: <Text strong>{currentLink.title || currentLink.shortCode}</Text>
                </Text>
              )}
            </div>
            
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
          </div>

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
                  title="Clicks hôm nay"
                  value={18}
                  prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="CTR"
                  value={3.2}
                  suffix="%"
                  prefix={<BarChartOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Unique visitors"
                  value={68}
                  prefix={<UserOutlined style={{ color: '#fa8c16' }} />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Charts Section */}
          <Row gutter={[16, 16]}>
            {/* Clicks Over Time */}
            <Col xs={24} lg={16}>
              <Card title="Clicks theo thời gian" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={clicksOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(label) => `Ngày: ${label}`}
                      formatter={(value) => [value, 'Clicks']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="#1890ff" 
                      strokeWidth={2}
                      dot={{ fill: '#1890ff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Device Types */}
            <Col xs={24} lg={8}>
              <Card title="Thiết bị truy cập" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ']} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            {/* Browser Stats */}
            <Col xs={24} lg={12}>
              <Card title="Trình duyệt" style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={browserData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="browser" type="category" width={60} />
                    <Tooltip formatter={(value) => [value, 'Clicks']} />
                    <Bar dataKey="clicks" fill="#52c41a" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Location Stats */}
            <Col xs={24} lg={12}>
              <Card title="Vị trí địa lý" style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={locationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <Tooltip formatter={(value) => [value, 'Clicks']} />
                    <Bar dataKey="clicks" fill="#722ed1" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Detailed Stats */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card title={<><MobileOutlined /> Chi tiết thiết bị</>}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {deviceData.map(device => (
                    <div key={device.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{device.name}</Text>
                      <Text strong style={{ color: device.color }}>
                        {device.value}%
                      </Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title={<><DesktopOutlined /> Top trình duyệt</>}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {browserData.map(browser => (
                    <div key={browser.browser} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{browser.browser}</Text>
                      <Text strong>{browser.clicks} clicks</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title={<><GlobalOutlined /> Top quốc gia</>}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {locationData.map(location => (
                    <div key={location.country} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>{location.country}</Text>
                      <Text strong>{location.clicks} clicks</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>

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