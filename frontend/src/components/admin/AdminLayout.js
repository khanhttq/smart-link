// frontend/src/components/admin/AdminLayout.js
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Space,
  Button,
  Badge,
  Typography,
  Divider
} from 'antd';
import {
  DashboardOutlined,
  LinkOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
  SettingOutlined,
  CrownOutlined,
  TeamOutlined,
  CheckSquareOutlined,
  MonitorOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  PlusOutlined,
  HomeOutlined
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

const { Header, Sider, Content } = AntLayout;
const { Title, Text } = Typography;

const AdminLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Admin sidebar menu items
  const adminMenuItems = [
    {
      key: 'admin-section',
      type: 'group',
      label: (
        <Space style={{ padding: '8px 0' }}>
          <CrownOutlined style={{ color: '#faad14' }} />
          <span style={{ color: '#faad14', fontWeight: 'bold', fontSize: '12px' }}>
            ADMIN PANEL
          </span>
        </Space>
      ),
    },
    {
      key: '/admin/dashboard',
      icon: <MonitorOutlined />,
      label: 'Admin Dashboard',
      style: { color: '#faad14' }
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: 'User Management',
      style: { color: '#faad14' }
    },
    {
      key: '/admin/links',
      icon: <CheckSquareOutlined />,
      label: 'Link Moderation',
      style: { color: '#faad14' }
    },
    {
      key: '/admin/analytics',
      icon: <BarChartOutlined />,
      label: 'System Analytics',
      style: { color: '#faad14' }
    },
    {
      key: '/admin/system',
      icon: <SettingOutlined />,
      label: 'System Settings',
      style: { color: '#faad14' }
    },
    {
      type: 'divider',
    },
    {
      key: 'user-section',
      type: 'group',
      label: (
        <span style={{ color: '#666', fontSize: '12px' }}>
          USER FUNCTIONS
        </span>
      ),
    },
    {
      key: '/dashboard',
      icon: <HomeOutlined />,
      label: 'User Dashboard',
    },
    {
      key: '/create',
      icon: <PlusOutlined />,
      label: 'Create Link',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: 'My Analytics',
    },
    {
      key: '/domains',
      icon: <GlobalOutlined />,
      label: 'Domains',
    },
  ];

  // User dropdown menu
  const userMenuItems = [
    {
      key: 'back-to-user',
      icon: <HomeOutlined />,
      label: 'Back to User Dashboard',
      onClick: () => navigate('/dashboard')
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile Settings',
      onClick: () => navigate('/profile')
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true
    }
  ];

  // Handle menu click
  const handleMenuClick = ({ key }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* Admin Sidebar */}
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="light"
        width={280}
        style={{
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          borderRight: '1px solid #f0f0f0'
        }}
      >
        {/* Admin Logo */}
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          background: 'linear-gradient(135deg, #faad14 0%, #ff7875 100%)',
          color: 'white'
        }}>
          {!collapsed ? (
            <Space>
              <CrownOutlined style={{ fontSize: '24px' }} />
              <div>
                <Title level={4} style={{ margin: 0, color: 'white' }}>
                  ADMIN
                </Title>
                <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                  Control Panel
                </Text>
              </div>
            </Space>
          ) : (
            <CrownOutlined style={{ fontSize: '24px', color: 'white' }} />
          )}
        </div>

        {/* Admin Info Card */}
        {!collapsed && (
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa'
          }}>
            <Space>
              <Badge count="ADMIN" style={{ backgroundColor: '#faad14' }}>
                <Avatar 
                  icon={<CrownOutlined />} 
                  style={{ backgroundColor: '#faad14' }}
                  src={user?.avatar}
                />
              </Badge>
              <div>
                <Text strong style={{ fontSize: '14px' }}>
                  {user?.name || user?.email}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  System Administrator
                </Text>
              </div>
            </Space>
          </div>
        )}

        {/* Admin Menu */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={adminMenuItems}
          onClick={handleMenuClick}
          style={{ 
            border: 'none',
            fontSize: '14px'
          }}
          className="admin-menu"
        />
      </Sider>

      {/* Main Content Area */}
      <AntLayout>
        {/* Admin Header */}
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #f0f0f0',
          height: '64px' // ✅ Fixed height
        }}>
          {/* Left: Collapse button and breadcrumb */}
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 40, height: 40 }}
            />
            
            {/* Current page indicator - Fixed overflow */}
            <div style={{ maxWidth: '200px' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                Admin Panel
              </Text>
              <Text strong style={{ 
                fontSize: '16px', 
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {location.pathname === '/admin' || location.pathname === '/admin/dashboard' 
                  ? 'Dashboard' 
                  : location.pathname.split('/').pop()?.charAt(0).toUpperCase() + location.pathname.split('/').pop()?.slice(1)
                }
              </Text>
            </div>
          </Space>

          {/* Right: User actions */}
          <Space size="large">
            {/* Admin user dropdown */}
            <Dropdown 
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
                <Space>
                  <Avatar 
                    size="small" 
                    icon={<CrownOutlined />}
                    src={user?.avatar}
                    style={{ backgroundColor: '#faad14' }}
                  />
                  <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                    <Text style={{ fontSize: '13px', fontWeight: 500 }}>
                      {user?.name || 'Admin'}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Administrator
                    </Text>
                  </div>
                  <DownOutlined style={{ fontSize: '12px' }} />
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>

        {/* Page Content - Full screen without external navbar */}
        <Content style={{ 
          margin: '0',
          background: '#f5f5f5',
          minHeight: 'calc(100vh - 64px)',
          overflow: 'auto'
        }}>
          {/* Admin pages render here */}
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default AdminLayout;