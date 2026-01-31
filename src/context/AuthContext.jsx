// Auth Context - React Context for Authentication State Management
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { isDualAuthEnabled, getAuthFlags } from '../config/featureFlags';

// Create the Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authMethod, setAuthMethod] = useState(null);

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const storedUser = await authService.getCurrentUser();
          const storedMethod = authService.getAuthMethod();
          setUser(storedUser);
          setAuthMethod(storedMethod);
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login with email/password
  const loginWithEmail = useCallback(async (email, password, rememberMe = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.loginWithEmail(email, password, rememberMe);
      setUser(result.user);
      setAuthMethod(result.method);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Register with email/password
  const registerWithEmail = useCallback(async (email, password, name) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.registerWithEmail(email, password, name);
      setUser(result.user);
      setAuthMethod(result.method);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Login with OAuth provider
  const loginWithOAuth = useCallback(async (provider) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.simulateOAuthLogin(provider);
      setUser(result.user);
      setAuthMethod(result.method);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (provider, code, state) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.handleOAuthCallback(provider, code, state);
      setUser(result.user);
      setAuthMethod(result.method);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      setUser(null);
      setAuthMethod(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Request password reset
  const requestPasswordReset = useCallback(async (email) => {
    setError(null);

    try {
      return await authService.requestPasswordReset(email);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      return await authService.refreshToken();
    } catch (err) {
      // If refresh fails, log out the user
      await logout();
      throw err;
    }
  }, [logout]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get available auth methods
  const getAvailableAuthMethods = useCallback(() => {
    return authService.getAvailableAuthMethods();
  }, []);

  // Context value
  const value = {
    // State
    user,
    loading,
    error,
    authMethod,
    isAuthenticated: !!user,
    isDualAuthEnabled: isDualAuthEnabled(),
    authFlags: getAuthFlags(),

    // Actions
    loginWithEmail,
    registerWithEmail,
    loginWithOAuth,
    handleOAuthCallback,
    logout,
    requestPasswordReset,
    refreshToken,
    clearError,
    getAvailableAuthMethods,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;
