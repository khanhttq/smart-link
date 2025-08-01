// frontend/src/components/auth/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ 
        height: '60vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div>Đang kiểm tra xác thực...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Result
        icon={<LockOutlined style={{ color: '#faad14' }} />}
        title="Yêu cầu đăng nhập"
        subTitle="Bạn cần đăng nhập để truy cập trang này"
        extra={
          <Button type="primary" href="/login">
            Đăng nhập ngay
          </Button>
        }
      />
    );
  }

  return children;
};

export default ProtectedRoute;