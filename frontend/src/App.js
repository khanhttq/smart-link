// frontend/src/App.js - Updated để tương thích với authStore hoàn chỉnh
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Layout, Spin, message } from 'antd';
import viVN from 'antd/locale/vi_VN';
import 'antd/dist/reset.css';
import './App.css';

// Import components (sử dụng đường dẫn hiện có)
import Navbar from './components/layout/Navbar';
import ProtectedRoute, { GuestRoute, AdminRoute, EditorRoute } from './components/auth/ProtectedRoute';

// Import pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateLinkPage from './pages/CreateLinkPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';

// Import stores và hooks
import { useAuthStore } from './stores/authStore';
import { useAuth } from './hooks/useAuth';

const { Content } = Layout;

// Component để hiển thị loading app
const AppLoading = () => (
  <div style={{ 
    height: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 16
  }}>
    <Spin size="large" />
    <div style={{ color: '#666', fontSize: 16 }}>
      Đang khởi tải ứng dụng...
    </div>
  </div>
);

function App() {
  // Sử dụng hook useAuth thay vì direct store access
  const { isAuthenticated, loading, checkAuth } = useAuth();

  // Configure global message
  message.config({
    top: 100,
    duration: 3,
    maxCount: 3,
  });

  // Check auth on app mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show loading screen while checking auth
  if (loading) {
    return <AppLoading />;
  }

  return (
    <ConfigProvider 
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Layout: {
            headerBg: '#fff',
            headerHeight: 64,
          },
          Menu: {
            horizontalItemSelectedColor: '#1890ff',
          }
        }
      }}
    >
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Navbar />
          
          <Content style={{ 
            padding: '24px', 
            backgroundColor: '#f5f5f5',
            minHeight: 'calc(100vh - 64px)'
          }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<HomePage />} />
                
                {/* Guest only routes - redirect if already authenticated */}
                <Route 
                  path="/login" 
                  element={
                    <GuestRoute redirectTo="/dashboard">
                      <LoginPage />
                    </GuestRoute>
                  } 
                />
                <Route 
                  path="/register" 
                  element={
                    <GuestRoute redirectTo="/dashboard">
                      <RegisterPage />
                    </GuestRoute>
                  } 
                />
                
                {/* Protected routes - require authentication */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/create" 
                  element={
                    <ProtectedRoute>
                      <CreateLinkPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/analytics" 
                  element={
                    <ProtectedRoute>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  } 
                />

                {/* Editor/Admin routes - role-based protection */}
                <Route 
                  path="/admin" 
                  element={
                    <AdminRoute>
                      <div>Admin Panel - Coming Soon</div>
                    </AdminRoute>
                  } 
                />

                <Route 
                  path="/editor" 
                  element={
                    <EditorRoute>
                      <div>Editor Panel - Coming Soon</div>
                    </EditorRoute>
                  } 
                />
                
                {/* Catch-all routes */}
                <Route 
                  path="/unauthorized" 
                  element={
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <h2>Không có quyền truy cập</h2>
                      <p>Bạn không có đủ quyền để truy cập trang này.</p>
                    </div>
                  } 
                />
                
                {/* 404 fallback */}
                <Route 
                  path="*" 
                  element={
                    isAuthenticated ? 
                      <Navigate to="/dashboard" replace /> : 
                      <Navigate to="/" replace />
                  } 
                />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;