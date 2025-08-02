// frontend/src/components/auth/ProtectedRoute.js - Updated version
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
    isSessionNearExpiry,
    getTimeUntilExpiry,
    refreshToken
  } = useAuthStore();
  
  const location = useLocation();
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  // Auto-refresh token if session is near expiry
  useEffect(() => {
    if (isAuthenticated && isSessionNearExpiry() && !sessionWarningShown) {
      setSessionWarningShown(true);
      
      const timeLeft = getTimeUntilExpiry();
      const minutesLeft = Math.floor(timeLeft / (1000 * 60));
      
      if (minutesLeft <= 5 && minutesLeft > 0) {
        // Try to refresh token automatically
        refreshToken().then(result => {
          if (result.success) {
            console.log('✅ Token auto-refreshed successfully');
            setSessionWarningShown(false);
          }
        }).catch(error => {
          console.error('❌ Auto token refresh failed:', error);
        });
      }
    }
  }, [isAuthenticated, isSessionNearExpiry, sessionWarningShown, getTimeUntilExpiry, refreshToken]);

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

  // Show session expiry warning if applicable
  const renderSessionWarning = () => {
    if (!isAuthenticated || !isSessionNearExpiry()) return null;
    
    const timeLeft = getTimeUntilExpiry();
    const minutesLeft = Math.floor(timeLeft / (1000 * 60));
    
    if (minutesLeft <= 5 && minutesLeft > 0) {
      return (
        <Alert
          message="Phiên đăng nhập sắp hết hạn"
          description={`Phiên của bạn sẽ hết hạn sau ${minutesLeft} phút. Hệ thống sẽ tự động gia hạn.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button 
              size="small" 
              type="ghost" 
              onClick={() => {
                refreshToken().then(result => {
                  if (result.success) {
                    setSessionWarningShown(false);
                  }
                });
              }}
            >
              Gia hạn ngay
            </Button>
          }
        />
      );
    }
    
    return null;
  };

  // Render children with optional session warning
  return (
    <>
      {renderSessionWarning()}
      {children}
    </>
  );
};

// Role-specific route components for convenience
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

// Guest route component (redirect authenticated users)
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
          Đang tải...
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