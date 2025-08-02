// frontend/src/hooks/useAuth.js - FIXED VERSION
import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const store = useAuthStore();
  
  // Get all store state and methods
  const {
    user,
    token,
    refreshToken,
    isAuthenticated,
    loading,
    lastActivity,
    sessionExpiresAt,
    showRegistrationModal,
    registrationData,
    login,
    register,
    logout,
    logoutAll,
    updateUser,
    refreshSession,
    isSessionValid,
    updateActivity,
    initialize,
    clearAll,
    getAuthStatus,
    showSmartRegistration,
    hideSmartRegistration,
    checkEmailExists
  } = store;

  // ✅ FIXED: Create checkAuth function locally since it doesn't exist in store
  const checkAuth = async () => {
    try {
      // If we have a token but not authenticated, try to validate session
      if (token && !isAuthenticated) {
        if (isSessionValid()) {
          // Session is still valid, just refresh user data if needed
          return true;
        } else {
          // Session expired, try to refresh
          return await refreshSession();
        }
      }
      
      // If no token, user needs to login
      if (!token) {
        return false;
      }
      
      return isAuthenticated;
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      return false;
    }
  };

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

  const forceLogout = () => {
    logout();
  };

  const clearAuth = () => {
    clearAll();
  };

  // Auto-check auth on mount
  useEffect(() => {
    if (!isAuthenticated && !loading && token) {
      checkAuth();
    }
  }, [token, isAuthenticated, loading]);

  // Computed values
  const computedValues = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor' || user?.role === 'admin',
    isUser: user?.role === 'user',
    userName: user?.name || 'User',
    userEmail: user?.email || '',
    userId: user?.id || null,
    userInitials: user?.name ? 
      user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
    hasValidSession: isAuthenticated && isSessionValid()
  }), [user, isAuthenticated, isSessionValid]);

  return {
    // State
    user,
    token,
    refreshToken,
    isAuthenticated,
    loading,
    lastActivity,
    sessionExpiresAt,
    showRegistrationModal,
    registrationData,
    
    // Actions
    login,
    register,
    logout,
    logoutAll,
    forceLogout,
    updateUser,
    clearAuth,
    refreshSession,
    updateActivity,
    initialize,
    getAuthStatus,
    showSmartRegistration,
    hideSmartRegistration,
    checkEmailExists,
    
    // ✅ FIXED: Local utilities
    checkAuth,
    isSessionNearExpiry,
    getTimeUntilExpiry,
    isSessionValid,
    
    // Computed values
    ...computedValues
  };
};

export default useAuth;