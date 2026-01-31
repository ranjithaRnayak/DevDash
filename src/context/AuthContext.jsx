// Auth Context - React Context for Authentication State Management
// Microsoft Entra ID as primary auth, GitHub as optional integration
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { getAuthFlags, isGitHubConnectedFlag } from '../config/featureFlags';

// Create the Auth Context
const AuthContext = createContext(null);

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [githubConnected, setGithubConnected] = useState(false);

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const storedUser = await authService.getCurrentUser();
          setUser(storedUser);
          setGithubConnected(authService.isGitHubConnected());
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

  // Login with Entra ID
  const loginWithEntraID = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.initiateEntraIDLogin();
      if (result) {
        setUser(result.user);
        setGithubConnected(authService.isGitHubConnected());
      }
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle Entra ID callback
  const handleEntraIDCallback = useCallback(async (code, state) => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.handleEntraIDCallback(code, state);
      setUser(result.user);
      setGithubConnected(authService.isGitHubConnected());
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Connect GitHub with PAT
  const connectGitHub = useCallback(async (pat) => {
    setError(null);

    try {
      const result = await authService.connectGitHubWithPAT(pat);
      setGithubConnected(true);
      // Update user state with GitHub info
      const updatedUser = await authService.getCurrentUser();
      setUser(updatedUser);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Disconnect GitHub
  const disconnectGitHub = useCallback(() => {
    authService.disconnectGitHub();
    setGithubConnected(false);
    // Update user state without GitHub info
    const updatedUser = authService.getStoredUser();
    setUser(updatedUser);
    return { success: true };
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
      setUser(null);
      // Note: GitHub connection status is preserved
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
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

  // Context value
  const value = {
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,
    githubConnected,
    authFlags: getAuthFlags(),

    // Actions
    loginWithEntraID,
    handleEntraIDCallback,
    connectGitHub,
    disconnectGitHub,
    logout,
    refreshToken,
    clearError,
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
