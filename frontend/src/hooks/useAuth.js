// frontend/src/hooks/useAuth.js - Tương thích với cấu trúc hiện tại
import { useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { message } from 'antd';

// Main auth hook - Enhanced version
export const useAuth = () => {
  const {
    user,
    token,
    refreshToken: refreshTokenValue,
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
    refreshToken: refreshTokenAction,
    updateUser,
    clearAuth,
    updateActivity,
    getTimeUntilExpiry,
    isSessionNearExpiry
  } = useAuthStore();

  // Auto-check auth on mount if not already done
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      checkAuth();
    }
  }, [checkAuth, isAuthenticated, loading]);

  // Auto-update activity on user interactions
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      updateActivity();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const options = { passive: true, capture: false };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, options);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, options);
      });
    };
  }, [isAuthenticated, updateActivity]);

  // Session monitoring and warnings
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSessionExpiry = () => {
      if (isSessionNearExpiry()) {
        const timeLeft = getTimeUntilExpiry();
        const minutesLeft = Math.floor(timeLeft / (1000 * 60));
        
        if (minutesLeft <= 5 && minutesLeft > 0) {
          // Try auto-refresh first
          refreshTokenAction().then(result => {
            if (result.success) {
              console.log('✅ Auto token refresh successful');
            } else {
              message.warning(`Phiên đăng nhập sẽ hết hạn sau ${minutesLeft} phút`);
            }
          }).catch(() => {
            message.warning(`Phiên đăng nhập sẽ hết hạn sau ${minutesLeft} phút`);
          });
        } else if (minutesLeft <= 0) {
          message.error('Phiên đăng nhập đã hết hạn');
          forceLogout();
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkSessionExpiry, 60000);
    
    // Check immediately
    checkSessionExpiry();

    return () => clearInterval(interval);
  }, [isAuthenticated, isSessionNearExpiry, getTimeUntilExpiry, refreshTokenAction, forceLogout]);

  // Computed values
  const computedValues = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor' || user?.role === 'admin',
    isUser: user?.role === 'user',
    userName: user?.name || 'User',
    userEmail: user?.email || '',
    userId: user?.id || null,
    userInitials: user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U',
    hasValidSession: isAuthenticated && sessionExpiresAt && new Date() < new Date(sessionExpiresAt)
  }), [user, isAuthenticated, sessionExpiresAt]);

  return {
    // State
    user,
    token,
    refreshToken: refreshTokenValue,
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
    refreshToken: refreshTokenAction,
    
    // Utilities
    checkAuth,
    updateActivity,
    getTimeUntilExpiry,
    isSessionNearExpiry,
    
    // Computed values
    ...computedValues
  };
};

// Hook for role-based access control
export const useRole = (requiredRole) => {
  const { user, isAuthenticated } = useAuth();
  
  const roleAccess = useMemo(() => {
    if (!isAuthenticated || !user) {
      return {
        hasRole: false,
        userRole: null,
        canAccess: false
      };
    }
    
    const roleHierarchy = {
      'user': 0,
      'editor': 1,
      'admin': 2
    };
    
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return {
      hasRole: userLevel >= requiredLevel,
      userRole: user.role,
      canAccess: userLevel >= requiredLevel,
      userLevel,
      requiredLevel
    };
  }, [user, isAuthenticated, requiredRole]);

  return roleAccess;
};

// Hook for session management
export const useSession = () => {
  const {
    sessionExpiresAt,
    lastActivity,
    getTimeUntilExpiry,
    isSessionNearExpiry,
    refreshToken,
    isAuthenticated
  } = useAuthStore();

  const sessionInfo = useMemo(() => {
    if (!isAuthenticated) {
      return {
        isActive: false,
        expiresAt: null,
        lastActivity: null,
        timeLeft: 0,
        isNearExpiry: false,
        isExpired: true,
        minutesLeft: 0,
        hoursLeft: 0,
        daysLeft: 0
      };
    }

    const timeLeft = getTimeUntilExpiry();
    const isExpired = timeLeft <= 0;
    const minutesLeft = isExpired ? 0 : Math.floor(timeLeft / (1000 * 60));
    const hoursLeft = isExpired ? 0 : Math.floor(timeLeft / (1000 * 60 * 60));
    const daysLeft = isExpired ? 0 : Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    
    return {
      isActive: !isExpired,
      expiresAt: sessionExpiresAt,
      lastActivity,
      timeLeft,
      isNearExpiry: isSessionNearExpiry(),
      isExpired,
      minutesLeft,
      hoursLeft,
      daysLeft
    };
  }, [sessionExpiresAt, lastActivity, getTimeUntilExpiry, isSessionNearExpiry, isAuthenticated]);

  return {
    ...sessionInfo,
    refreshToken
  };
};

// Hook for authentication requirements (replaces useRequireAuth)
export const useAuthRequired = (redirectTo = '/login') => {
  const { isAuthenticated, loading, checkAuth } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      checkAuth().then((authSuccess) => {
        if (!authSuccess) {
          window.location.href = redirectTo;
        }
      });
    }
  }, [isAuthenticated, loading, redirectTo, checkAuth]);

  return { 
    isAuthenticated, 
    loading,
    isReady: !loading && isAuthenticated
  };
};