// frontend/src/hooks/useAuth.js - FIXED VERSION
import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const store = useAuthStore();
  
  // ✅ FIXED: Use existing store methods only
  const {
    user,
    token,
    refreshToken,
    isAuthenticated,
    loading,
    lastActivity,
    sessionExpiresAt,
    login,
    register,
    logout,
    logoutAll,
    forceLogout,
    checkAuth,
    updateUser,
    clearAuth
  } = store;

  // Auto-check auth on mount
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      checkAuth();
    }
  }, [checkAuth, isAuthenticated, loading]);

  // ✅ FIXED: Create missing utility functions locally
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

  // Computed values
  const computedValues = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor' || user?.role === 'admin',
    isUser: user?.role === 'user',
    userName: user?.name || 'User',
    userEmail: user?.email || '',
    userId: user?.id || null,
    userInitials: user?.name ? 
      user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U',
    hasValidSession: isAuthenticated && sessionExpiresAt && new Date() < new Date(sessionExpiresAt)
  }), [user, isAuthenticated, sessionExpiresAt]);

  return {
    // State
    user,
    token,
    refreshToken,
    isAuthenticated,
    loading,
    lastActivity,
    sessionExpiresAt,
    
    // Actions
    login,
    register,
    logout,
    logoutAll,
    forceLogout,
    updateUser,
    clearAuth,
    checkAuth,
    
    // ✅ FIXED: Local utilities
    isSessionNearExpiry,
    getTimeUntilExpiry,
    
    // Computed values
    ...computedValues
  };
};

export default useAuth;