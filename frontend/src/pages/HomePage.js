// frontend/src/pages/HomePage.js - FIXED VERSION
import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Button, 
  Typography, 
  Row, 
  Col, 
  Card, 
  Space,
  Statistic
} from 'antd';
import {
  LinkOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  SafetyOutlined,
  RocketOutlined,
  EyeOutlined
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const HomePage = () => {
  const features = [
    {
      icon: <ThunderboltOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      title: 'Rút gọn nhanh chóng',
      description: 'Tạo liên kết rút gọn chỉ trong vài giây với giao diện thân thiện'
    },
    {
      icon: <BarChartOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      title: 'Analytics chi tiết',
      description: 'Theo dõi clicks, thiết bị, vị trí địa lý và nhiều thống kê khác'
    },
    {
      icon: <SafetyOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
      title: 'An toàn & bảo mật',
      description: 'Hệ thống bảo mật cao với xác thực và mã hóa dữ liệu'
    }
  ];

  const stats = [
    { title: 'Liên kết đã tạo', value: 12543, prefix: <LinkOutlined /> },
    { title: 'Tổng clicks', value: 89012, prefix: <EyeOutlined /> },
    { title: 'Người dùng', value: 1234, prefix: <SafetyOutlined /> }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
      <Space direction="vertical" size={60} style={{ width: '100%' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <LinkOutlined style={{ fontSize: 80, color: '#1890ff', marginBottom: 24 }} />
          
          <Title level={1} style={{ fontSize: 48, marginBottom: 16 }}>
            Shortlink System
          </Title>
          
          <Paragraph style={{ fontSize: 20, color: '#666', maxWidth: 600, margin: '0 auto 32px' }}>
            Hệ thống rút gọn liên kết mạnh mẽ với analytics chi tiết. 
            Tạo, quản lý và theo dõi hiệu quả các liên kết của bạn một cách dễ dàng.
          </Paragraph>
          
          <Space size="middle">
            <Link to="/register">
              <Button type="primary" size="large" icon={<RocketOutlined />}>
                Bắt đầu miễn phí
              </Button>
            </Link>
            <Link to="/login">
              <Button size="large">
                Đăng nhập
              </Button>
            </Link>
          </Space>
        </div>

        {/* Stats Section */}
        <Card>
          <Row gutter={[24, 24]}>
            {stats.map((stat, index) => (
              <Col xs={24} sm={8} key={index}>
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  prefix={stat.prefix}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            ))}
          </Row>
        </Card>

        {/* Features Section */}
        <div style={{ textAlign: 'center' }}>
          <Title level={2} style={{ marginBottom: 16 }}>
            Tính năng nổi bật
          </Title>
          <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 48 }}>
            Khám phá những tính năng mạnh mẽ giúp bạn quản lý liên kết hiệu quả
          </Paragraph>
          
          <Row gutter={[32, 32]}>
            {features.map((feature, index) => (
              <Col xs={24} md={8} key={index}>
                <Card 
                  hoverable
                  style={{ height: '100%', textAlign: 'center' }}
                  styles={{
                    body: { padding: '32px 24px' }
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    {feature.icon}
                  </div>
                  <Title level={4} style={{ marginBottom: 12 }}>
                    {feature.title}
                  </Title>
                  <Paragraph style={{ color: '#666', fontSize: 14 }}>
                    {feature.description}
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* CTA Section */}
        <Card 
          style={{ 
            background: 'linear-gradient(45deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '1px solid #bae7ff',
            textAlign: 'center',
            marginBottom: 40
          }}
          styles={{
            body: { padding: '48px 32px' }
          }}
        >
          <Space direction="vertical" size="large">
            <Title level={3} style={{ color: '#1890ff', margin: 0 }}>
              Sẵn sàng bắt đầu?
            </Title>
            
            <Paragraph style={{ fontSize: 16, color: '#666', margin: 0 }}>
              Tham gia cùng hàng nghìn người dùng đang sử dụng Shortlink System
            </Paragraph>
            
            <Link to="/register">
              <Button 
                type="primary" 
                size="large" 
                icon={<RocketOutlined />}
                style={{ height: 48, padding: '0 32px', fontSize: 16 }}
              >
                Tạo tài khoản miễn phí
              </Button>
            </Link>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default HomePage;