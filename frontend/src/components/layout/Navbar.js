// frontend/src/components/layout/Navbar.js - SIMPLE VERSION
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
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

const { Header } = Layout;
const { Title } = Typography;

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
    {
      key: '/domains',
      icon: <GlobalOutlined />,
      label: <Link to="/domains">Domains</Link>,
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
      disabled: true, // Tạm thời disable
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
        borderBottom: '1px solid #e8e8e8',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}
    >
      {/* 🎯 Logo & Brand */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link 
          to={isAuthenticated ? "/dashboard" : "/"} 
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <LinkOutlined style={{ fontSize: 28, color: '#1890ff', marginRight: 12 }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff', fontWeight: 'bold' }}>
            Shortlink
          </Title>
        </Link>
      </div>

      {/* 📱 Navigation Menu - chỉ hiện khi đã login */}
      {isAuthenticated && (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ 
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '15px'
            }}
          />
        </div>
      )}

      {/* 👤 User Actions */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isAuthenticated ? (
          <Space size="middle">
            {/* Quick Create Button */}
            <Link to="/create">
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                size="middle"
                style={{ fontWeight: 500 }}
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
              <Button 
                type="text" 
                style={{ 
                  padding: '8px 12px', 
                  height: 'auto',
                  borderRadius: '8px'
                }}
              >
                <Space>
                  <Avatar 
                    icon={<UserOutlined />} 
                    src={user?.avatar}
                    size="small"
                    style={{ backgroundColor: '#1890ff' }}
                  />
                  <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 500, 
                      color: '#262626' 
                    }}>
                      {user?.name || 'User'}
                    </div>
                    <div style={{ 
                      fontSize: 12, 
                      color: '#8c8c8c',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {user?.email}
                    </div>
                  </div>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        ) : (
          <Space size="middle">
            <Link to="/login">
              <Button type="default" size="middle">
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register">
              <Button type="primary" size="middle">
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