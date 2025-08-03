// frontend/src/App.js - CORRECT FRONTEND VERSION
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import viVN from 'antd/locale/vi_VN';

// Import notification service
import notificationService from './services/notificationService';

// Import pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';

// Import components
import Layout from './components/layout/Layout';
import ProtectedRoute, { GuestRoute } from './components/auth/ProtectedRoute';
import SmartRegistrationModal from './components/SmartRegistrationModal';

// Import providers - REMOVED AuthProvider (using Zustand instead)
// import { AuthProvider } from './contexts/AuthContext';

// Import styles
import './App.css';

// Component để sử dụng useApp hook
const AppContent = () => {
  const { message, notification, modal } = AntdApp.useApp();

  // Initialize notification service
  React.useEffect(() => {
    notificationService.init(message, notification, modal);
  }, [message, notification, modal]);

  return (
    // ✅ No AuthProvider needed - Zustand handles state globally
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        
        {/* Guest only routes */}
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

        {/* Protected routes with layout */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Layout>
              <AnalyticsPage />
            </Layout>
          </ProtectedRoute>
        } />

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
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