// Auth Service - Microsoft Entra ID Authentication
// Primary authentication via Entra ID, GitHub as optional integration

import { getAuthFlags, setGitHubConnected } from '../config/featureFlags';

const AUTH_TOKEN_KEY = 'devdash_auth_token';
const AUTH_USER_KEY = 'devdash_auth_user';
const GITHUB_PAT_KEY = 'devdash_github_pat';

// Entra ID configuration
const ENTRA_CONFIG = {
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
  tenantId: import.meta.env.VITE_ENTRA_TENANT_ID || '',
  redirectUri: `${window.location.origin}/auth/callback`,
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Backend API URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class AuthService {
  constructor() {
    this.authFlags = getAuthFlags();
  }

  // ==================== Token Management ====================

  getStoredToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  getStoredUser() {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  setAuthData(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }

  clearAuthData() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  isAuthenticated() {
    const token = this.getStoredToken();
    if (!token) return false;

    // Check token expiration
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1] || '{}'));
      if (tokenData.exp && Date.now() >= tokenData.exp * 1000) {
        this.clearAuthData();
        return false;
      }
    } catch {
      // If token parsing fails, assume it's still valid
    }

    return true;
  }

  // ==================== Entra ID Authentication ====================

  getEntraIDLoginUrl() {
    const params = new URLSearchParams({
      client_id: ENTRA_CONFIG.clientId,
      response_type: 'code',
      redirect_uri: ENTRA_CONFIG.redirectUri,
      scope: ENTRA_CONFIG.scopes.join(' '),
      response_mode: 'query',
      state: this.generateState(),
      nonce: this.generateNonce(),
    });

    return `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async initiateEntraIDLogin() {
    // In demo/dev mode without Entra config, simulate the login
    if (!ENTRA_CONFIG.clientId || import.meta.env.VITE_APP_ENV === 'dev') {
      return this.simulateEntraIDLogin();
    }

    // Store state for CSRF protection
    const state = this.generateState();
    sessionStorage.setItem('entra_state', state);

    // Redirect to Entra ID login
    window.location.href = this.getEntraIDLoginUrl();
  }

  async handleEntraIDCallback(code, state) {
    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('entra_state');
    if (state !== storedState) {
      throw new Error('Invalid state - possible CSRF attack');
    }
    sessionStorage.removeItem('entra_state');

    try {
      // Exchange code for token via backend
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: ENTRA_CONFIG.redirectUri }),
      });

      if (!response.ok) {
        throw new Error('Token exchange failed');
      }

      const data = await response.json();
      this.setAuthData(data.accessToken, data.user);

      return {
        success: true,
        user: data.user,
        token: data.accessToken,
      };
    } catch (error) {
      console.error('Entra ID callback failed:', error);
      throw error;
    }
  }

  async simulateEntraIDLogin() {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockUser = {
      id: `entra_${Date.now()}`,
      email: 'demo.user@company.com',
      name: 'Demo User',
      role: 'developer',
      avatar: null,
      provider: 'EntraID',
      tenantId: 'demo-tenant',
      githubConnected: this.isGitHubConnected(),
    };

    const mockToken = this.generateMockToken(mockUser);
    this.setAuthData(mockToken, mockUser);

    return {
      success: true,
      user: mockUser,
      token: mockToken,
    };
  }

  // ==================== GitHub Integration (Optional) ====================

  isGitHubConnected() {
    return !!localStorage.getItem(GITHUB_PAT_KEY) ||
           localStorage.getItem('devdash_github_connected') === 'true';
  }

  getGitHubPAT() {
    return localStorage.getItem(GITHUB_PAT_KEY);
  }

  async connectGitHubWithPAT(pat) {
    // Validate PAT by making a test request
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid GitHub Personal Access Token');
      }

      const githubUser = await response.json();

      // Store PAT and mark as connected
      localStorage.setItem(GITHUB_PAT_KEY, pat);
      setGitHubConnected(true);

      // Update user with GitHub info
      const currentUser = this.getStoredUser();
      if (currentUser) {
        currentUser.githubUsername = githubUser.login;
        currentUser.githubAvatar = githubUser.avatar_url;
        currentUser.githubConnected = true;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
      }

      return {
        success: true,
        githubUser: {
          login: githubUser.login,
          avatarUrl: githubUser.avatar_url,
          name: githubUser.name,
        },
      };
    } catch (error) {
      console.error('GitHub connection failed:', error);
      throw error;
    }
  }

  disconnectGitHub() {
    localStorage.removeItem(GITHUB_PAT_KEY);
    setGitHubConnected(false);

    // Update user to remove GitHub info
    const currentUser = this.getStoredUser();
    if (currentUser) {
      delete currentUser.githubUsername;
      delete currentUser.githubAvatar;
      currentUser.githubConnected = false;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));
    }

    return { success: true };
  }

  // ==================== Session Management ====================

  async logout() {
    this.clearAuthData();
    // Note: GitHub connection persists after logout
    return { success: true };
  }

  async getCurrentUser() {
    if (!this.isAuthenticated()) {
      return null;
    }

    const user = this.getStoredUser();
    if (user) {
      // Always include current GitHub connection status
      user.githubConnected = this.isGitHubConnected();
    }

    return user;
  }

  async refreshToken() {
    const currentToken = this.getStoredToken();
    if (!currentToken) {
      throw new Error('No active session to refresh');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.setAuthData(data.accessToken, data.user);

      return { success: true, token: data.accessToken };
    } catch (error) {
      // If refresh fails in dev mode, regenerate mock token
      if (import.meta.env.VITE_APP_ENV === 'dev') {
        const user = this.getStoredUser();
        if (user) {
          const newToken = this.generateMockToken(user);
          this.setAuthData(newToken, user);
          return { success: true, token: newToken };
        }
      }
      this.clearAuthData();
      throw error;
    }
  }

  // ==================== Utility Methods ====================

  generateMockToken(user) {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iss: 'https://login.microsoftonline.com/' + (user.tenantId || 'demo'),
        aud: ENTRA_CONFIG.clientId || 'devdash-demo',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.authFlags.sessionTimeout * 60,
      })
    );
    const signature = btoa('mock_signature');
    return `${header}.${payload}.${signature}`;
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  generateNonce() {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
