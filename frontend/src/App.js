// frontend/src/App.js - FIXED ROUTING để không conflict với shortcodes
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Layout } from 'antd';
import viVN from 'antd/locale/vi_VN';

// Import notification service
import notificationService from './services/notificationService';

// Import pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateLinkPage from './pages/CreateLinkPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';

// Import components
import Navbar from './components/layout/Navbar';
import ProtectedRoute, { GuestRoute } from './components/auth/ProtectedRoute';
import SmartRegistrationModal from './components/SmartRegistrationModal';

// Import styles
import './App.css';

const { Content } = Layout;

// Simple Layout Component with just Navbar
const SimpleLayout = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar />
      <Content style={{ 
        padding: '24px',
        background: '#f5f5f5',
        minHeight: 'calc(100vh - 64px)' 
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {children}
        </div>
      </Content>
    </Layout>
  );
};

// Component để sử dụng useApp hook
const AppContent = () => {
  const { message, notification, modal } = AntdApp.useApp();

  // Initialize notification service
  React.useEffect(() => {
    notificationService.init(message, notification, modal);
  }, [message, notification, modal]);

  return (
    <Router>
      <Routes>
        {/* Public routes - HomePage có navbar riêng */}
        <Route path="/" element={<HomePage />} />
        
        {/* Guest only routes - không có navbar */}
        <Route 
          path="/login" 
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          } 
        />

        {/* ✅ EXPLICIT APP ROUTES - Specific paths only */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <SimpleLayout>
              <DashboardPage />
            </SimpleLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/create" element={
          <ProtectedRoute>
            <SimpleLayout>
              <CreateLinkPage />
            </SimpleLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <SimpleLayout>
              <ProfilePage />
            </SimpleLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <SimpleLayout>
              <AnalyticsPage />
            </SimpleLayout>
          </ProtectedRoute>
        } />

        {/* ✅ SPECIFIC 404 route - only for unknown app routes */}
        <Route path="/404" element={<NotFoundPage />} />
        
        {/* ✅ CRITICAL: Don't catch all routes with * 
            Let shortcodes pass through to backend */}
      </Routes>

      {/* Global components */}
      <SmartRegistrationModal />
    </Router>
  );
};

// App Wrapper with Notification Service Integration
const AppWrapper = () => {
  return (
    <AntdApp>
      <AppContent />
    </AntdApp>
  );
};

// Main App Component
const App = () => {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Message: {
            contentBg: 'rgba(255, 255, 255, 0.95)',
            contentPadding: '12px 16px',
          },
          Notification: {
            width: 400,
          }
        }
      }}
    >
      <AppWrapper />
    </ConfigProvider>
  );
};

export default App;