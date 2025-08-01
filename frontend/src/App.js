// frontend/src/App.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin } from 'antd';
import { message } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'antd/dist/reset.css';
import './App.css';

// Import components
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Import pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateLinkPage from './pages/CreateLinkPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';

// Import stores
import { useAuthStore } from './stores/authStore';

const { Content } = Layout;

function App() {
  const { isAuthenticated, loading, checkAuth } = useAuthStore();

  // Configure global message
  message.config({
    top: 100,
    duration: 3,
    maxCount: 3,
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" tip="Đang tải..." />
      </div>
    );
  }

  return (
    <ConfigProvider 
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        },
      }}
    >
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Navbar />
          
          <Content style={{ padding: '24px', backgroundColor: '#f5f5f5' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<HomePage />} />
                <Route 
                  path="/login" 
                  element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
                />
                <Route 
                  path="/register" 
                  element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} 
                />
                
                {/* Protected routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/create" element={
                  <ProtectedRoute>
                    <CreateLinkPage />
                  </ProtectedRoute>
                } />
                <Route path="/analytics" element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;