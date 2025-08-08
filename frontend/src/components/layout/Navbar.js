// frontend/src/components/layout/Navbar.js - FIXED với thứ tự khai báo đúng
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Layout, 
  Menu, 
  Button, 
  Avatar, 
  Dropdown, 
  Space, 
  Typography,
  Row,
  Col,
  Badge,
  Divider
} from 'antd';
import {
  LinkOutlined,
  DashboardOutlined,
  PlusOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  GlobalOutlined,
  CrownOutlined,        // Admin icon
  TeamOutlined,         // User management
  CheckSquareOutlined,  // Link moderation
  MonitorOutlined       // System monitoring
} from '@ant-design/icons';
import useAuthStore from '../../stores/authStore';

const { Header } = Layout;
const { Title } = Typography;

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();

  // ✅ STEP 1: Khai báo tất cả computed values trước
  const isAdmin = user?.role === 'admin';
  const isInAdminSection = location.pathname.startsWith('/admin');
  const showAdminMenu = false; // NEVER show admin menu in navbar - admin uses sidebar
  
  // DEBUG: Log để kiểm tra
  console.log('🔍 Navbar Debug:', {
    userRole: user?.role,
    currentPath: location.pathname,
    isAdmin,
    isInAdminSection,
    showAdminMenu: 'Always false - admin uses sidebar'
  });

  // ✅ STEP 2: Functions
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ✅ STEP 3: useEffect hooks
  React.useEffect(() => {
    if (!isAdmin) return;
    
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + Shift + A = Admin Panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        navigate('/admin');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isAdmin, navigate]);

  // ✅ STEP 4: Menu arrays (sau khi đã có isAdmin)
  const regularMenuItems = [
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

  const adminMenuItems = [
    {
      type: 'divider',
    },
    {
      key: 'admin-section',
      type: 'group',
      label: (
        <Space>
          <CrownOutlined style={{ color: '#faad14' }} />
          <span style={{ color: '#faad14', fontWeight: 'bold', fontSize: '12px' }}>
            ADMIN PANEL
          </span>
        </Space>
      ),
    },
    {
      key: '/admin',
      icon: <MonitorOutlined />,
      label: (
        <Link to="/admin" style={{ color: '#faad14' }}>
          <Space>
            Admin Dashboard
            <Badge count="NEW" size="small" style={{ backgroundColor: '#52c41a' }} />
          </Space>
        </Link>
      ),
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: <Link to="/admin/users" style={{ color: '#faad14' }}>User Management</Link>,
    },
    {
      key: '/admin/links',
      icon: <CheckSquareOutlined />,
      label: <Link to="/admin/links" style={{ color: '#faad14' }}>Link Moderation</Link>,
    },
  ];

  const menuItems = showAdminMenu 
    ? [...adminMenuItems, ...regularMenuItems] 
    : regularMenuItems;

  const userMenuItems = [
    // Admin access - chỉ hiện cho admin users
    ...(isAdmin ? [
      {
        key: 'admin-panel',
        icon: <CrownOutlined style={{ color: '#faad14' }} />,
        label: (
          <Link to="/admin" style={{ color: '#faad14', fontWeight: 'bold' }}>
            Admin Panel
          </Link>
        ),
      },
      {
        type: 'divider',
      },
    ] : []),
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
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
      danger: true,
    },
  ];

  // ✅ STEP 5: Render
  return (
    <Header 
      style={{ 
        background: '#fff', 
        borderBottom: '1px solid #e8e8e8',
        padding: '0 32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: '64px',
        lineHeight: '64px'
      }}
    >
      <Row justify="space-between" align="middle" style={{ height: '100%' }}>
        {/* 🎯 Logo & Brand */}
        <Col>
          <Link 
            to={isAuthenticated ? "/dashboard" : "/"} 
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <LinkOutlined style={{ fontSize: 28, color: '#1890ff', marginRight: 12 }} />
            <Title level={3} style={{ margin: 0, color: '#1890ff', fontWeight: 'bold' }}>
              Shortlink
            </Title>
            {/* No admin badge in navbar */}
          </Link>
        </Col>

        {/* 📱 Navigation Menu - HIỆN TRỰC TIẾP */}
        {isAuthenticated && (
          <Col flex="auto">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Menu
                mode="horizontal"
                selectedKeys={[location.pathname]}
                items={menuItems}
                style={{ 
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '15px',
                  fontWeight: '500',
                  lineHeight: '64px'
                }}
                theme="light"
              />
            </div>
          </Col>
        )}

        {/* 👤 User Actions */}
        <Col>
          {isAuthenticated ? (
            <Space size="large" align="center">
              {/* Quick Create Button */}
              <Link to="/create">
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  size="middle"
                  style={{ 
                    fontWeight: 500,
                    borderRadius: '6px',
                    height: '36px'
                  }}
                >
                  Tạo Link
                </Button>
              </Link>

              {/* User Dropdown với admin access */}
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
                    borderRadius: '8px',
                    border: '1px solid #d9d9d9',
                    backgroundColor: 'transparent'
                  }}
                >
                  <Space>
                    {/* Subtle admin indicator */}
                    <div style={{ position: 'relative' }}>
                      <Avatar 
                        icon={<UserOutlined />} 
                        src={user?.avatar}
                        size="small"
                        style={{ 
                          backgroundColor: isAdmin ? '#faad14' : '#1890ff' 
                        }}
                      />
                      {/* Small admin indicator */}
                      {isAdmin && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 10,
                            height: 10,
                            backgroundColor: '#faad14',
                            border: '2px solid #fff',
                            borderRadius: '50%',
                            fontSize: 8
                          }}
                          title="Admin User"
                        />
                      )}
                    </div>
                    
                    <div style={{ textAlign: 'left', lineHeight: '1.3' }}>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: 500, 
                        color: '#262626'
                      }}>
                        {user?.name || 'User'}
                        {/* No admin label in navbar */}
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
        </Col>
      </Row>
    </Header>
  );
};

export default Navbar;