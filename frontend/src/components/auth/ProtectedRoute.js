// frontend/src/components/auth/ProtectedRoute.js - FIXED VERSION
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button, Spin, Alert } from 'antd';
import { LockOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const ProtectedRoute = ({ 
  children, 
  redirectTo = '/login',
  requiredRole = null,
  showUnauthorized = true 
}) => {
  const { 
    user,
    isAuthenticated, 
    loading, 
    checkAuth,
    sessionExpiresAt
  } = useAuthStore();
  
  const location = useLocation();
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  // ✅ FIXED: Create utility functions locally
  const isSessionNearExpiry = () => {
    if (!sessionExpiresAt) return false;
    const fiveMinutes = 5 * 60 * 1000;
    const timeLeft = new Date(sessionExpiresAt) - new Date();
    return timeLeft <= fiveMinutes && timeLeft > 0;
  };

  const getTimeUntilExpiry = () => {
    if (!sessionExpiresAt) return null;
    return new Date(sessionExpiresAt) - new Date();
  };

  // Check auth on mount if not already authenticated
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      checkAuth();
    }
  }, [isAuthenticated, loading, checkAuth]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{ 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16
      }}>
        <Spin size="large" />
        <div style={{ color: '#666', fontSize: 16 }}>
          Đang kiểm tra xác thực...
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Check role-based access if required
  if (requiredRole && user) {
    const roleHierarchy = {
      'user': 0,
      'editor': 1,
      'admin': 2
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    if (userLevel < requiredLevel) {
      if (!showUnauthorized) {
        return <Navigate to="/dashboard" replace />;
      }
      
      return (
        <Result
          icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          title="Không có quyền truy cập"
          subTitle={`Bạn cần quyền ${requiredRole} để truy cập trang này. Quyền hiện tại: ${user.role}`}
          extra={[
            <Button key="back" onClick={() => window.history.back()}>
              Quay lại
            </Button>,
            <Button key="dashboard" type="primary" href="/dashboard">
              Về Dashboard
            </Button>
          ]}
        />
      );
    }
  }

  // ✅ FIXED: Render session warning safely
  const renderSessionWarning = () => {
    if (!isAuthenticated || !isSessionNearExpiry()) return null;
    
    const timeLeft = getTimeUntilExpiry();
    const minutesLeft = Math.floor(timeLeft / (1000 * 60));
    
    if (minutesLeft <= 5 && minutesLeft > 0) {
      return (
        <Alert
          message="Phiên đăng nhập sắp hết hạn"
          description={`Phiên của bạn sẽ hết hạn sau ${minutesLeft} phút.`}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      );
    }
    return null;
  };

  return (
    <>
      {renderSessionWarning()}
      {children}
    </>
  );
};

// ✅ FIXED: Simple role-based route components
export const AdminRoute = ({ children, ...props }) => (
  <ProtectedRoute requiredRole="admin" {...props}>
    {children}
  </ProtectedRoute>
);

export const EditorRoute = ({ children, ...props }) => (
  <ProtectedRoute requiredRole="editor" {...props}>
    {children}
  </ProtectedRoute>
);

export const GuestRoute = ({ children, redirectTo = '/dashboard' }) => {
  const { isAuthenticated, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16
      }}>
        <Spin size="large" />
        <div style={{ color: '#666', fontSize: 16 }}>
          Đang kiểm tra xác thực...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
};

export default ProtectedRoute;