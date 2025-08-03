// frontend/src/hooks/useAuth.js - COMPLETE IMPLEMENTATION
import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const store = useAuthStore();

  // Extract all store state and methods
  const {
    user,
    tokens,
    isAuthenticated,
    loading,
    smartRegistration,
    login,
    register,
    logout,
    refreshToken,
    checkAuth,
    showSmartRegistration,
    hideSmartRegistration,
    clearError
  } = store;

  // Computed values
  const computedValues = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor' || user?.role === 'admin',
    isUser: !!user,
    userName: user?.name || 'User',
    userEmail: user?.email || '',
    userId: user?.id || null,
    userInitials: user?.name ? 
      user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U',
    hasTokens: !!(tokens?.accessToken && tokens?.refreshToken)
  }), [user, tokens]);

  // Return complete auth interface
  return {
    // Basic state
    user,
    tokens,
    isAuthenticated,
    loading,
    
    // Smart registration
    smartRegistration,
    showSmartRegistration,
    hideSmartRegistration,
    
    // Actions
    login,
    register,
    logout,
    refreshToken,
    checkAuth,
    clearError,
    
    // Computed values
    ...computedValues
  };
};

export default useAuth;