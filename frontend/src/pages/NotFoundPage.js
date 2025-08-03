// frontend/src/pages/NotFoundPage.js
import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Result
        status="404"
        title="404"
        subTitle="Trang bạn tìm kiếm không tồn tại."
        extra={
          <Button 
            type="primary" 
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            size="large"
          >
            Về trang chủ
          </Button>
        }
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 12,
          padding: '40px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
};

export default NotFoundPage;