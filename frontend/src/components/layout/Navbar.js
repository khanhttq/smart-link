// frontend/src/components/layout/Navbar.js
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Layout, 
  Menu, 
  Button, 
  Avatar, 
  Dropdown, 
  Space, 
  Typography 
} from 'antd';
import {
  LinkOutlined,
  DashboardOutlined,
  PlusOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

const { Header } = Layout;
const { Text } = Typography;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Menu items cho authenticated users
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: '/create',
      icon: <PlusOutlined />,
      label: <Link to="/create">Tạo Link</Link>,
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: <Link to="/analytics">Analytics</Link>,
    },
  ];

  // Dropdown menu cho user
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">Hồ sơ cá nhân</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <Header 
      style={{ 
        background: '#fff', 
        borderBottom: '1px solid #f0f0f0',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      {/* Logo & Brand */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <LinkOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 8 }} />
          <Typography.Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            Shortlink
          </Typography.Title>
        </Link>
      </div>

      {/* Navigation Menu */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {isAuthenticated && (
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ 
              border: 'none',
              backgroundColor: 'transparent',
              minWidth: 300
            }}
          />
        )}
      </div>

      {/* User Actions */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isAuthenticated ? (
          <Space size="middle">
            {/* Quick Create Button */}
            <Link to="/create">
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                size="middle"
              >
                Tạo Link
              </Button>
            </Link>

            {/* User Dropdown */}
            <Dropdown 
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="text" style={{ padding: '4px 8px', height: 'auto' }}>
                <Space>
                  <Avatar 
                    icon={<UserOutlined />} 
                    src={user?.avatar}
                    size="small"
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {user?.name || 'User'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {user?.email}
                    </div>
                  </div>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        ) : (
          <Space>
            <Link to="/login">
              <Button type="default">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register">
              <Button type="primary">
                Đăng ký
              </Button>
            </Link>
          </Space>
        )}
      </div>
    </Header>
  );
};

export default Navbar;