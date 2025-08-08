// frontend/src/components/auth/ProtectedRoute.js - UPDATED with Smart GuestRoute
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button, Spin, Alert } from 'antd';
import { LockOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth'; // ✅ Sử dụng useAuth hook

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
    checkAuth
  } = useAuth();
  
  const location = useLocation();
  const [initializing, setInitializing] = useState(true);

  // Check auth on mount
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔍 ProtectedRoute DEBUG:', {
        isAuthenticated,
        loading,
        hasUser: !!user
      });
      
      if (!isAuthenticated && !loading) {
        await checkAuth();
      }
      setInitializing(false);
    };
    
    initAuth();
  }, [isAuthenticated, loading, checkAuth]);

  // Show loading spinner while checking authentication
  if (loading || initializing) {
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
        state={{ from: location }} 
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
          subTitle={`Bạn cần quyền ${requiredRole} để truy cập trang này.`}
          extra={
            <Button type="primary" onClick={() => window.history.back()}>
              Quay lại
            </Button>
          }
        />
      );
    }
  }

  return (
    <>
      {children}
    </>
  );
};

// ✅ UPDATED: Smart Guest Route với role-based redirect
export const GuestRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    // ✅ Smart redirect based on user role
    const getRedirectPath = (user) => {
      switch (user?.role) {
        case 'admin':
          return '/admin';
        case 'editor':
          return '/dashboard'; // Editors go to regular dashboard for now
        default:
          return '/dashboard';
      }
    };

    const redirectPath = getRedirectPath(user);
    console.log(`👤 Authenticated ${user.role || 'user'} accessing guest route, redirecting to: ${redirectPath}`);
    
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

// Admin Route
export const AdminRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute requiredRole="admin" {...props}>
      {children}
    </ProtectedRoute>
  );
};

// Editor Route
export const EditorRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute requiredRole="editor" {...props}>
      {children}
    </ProtectedRoute>
  );
};

export default ProtectedRoute;