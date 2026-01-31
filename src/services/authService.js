// Auth Service - Dual Authentication System
// Supports both OAuth (Google, GitHub) and traditional email/password authentication

import { getAuthFlags, isFeatureEnabled } from '../config/featureFlags';

const AUTH_TOKEN_KEY = 'devdash_auth_token';
const AUTH_USER_KEY = 'devdash_auth_user';
const AUTH_METHOD_KEY = 'devdash_auth_method';
const REMEMBER_ME_KEY = 'devdash_remember_me';

// OAuth configuration
const OAUTH_CONFIG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/google`,
    scope: 'email profile',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  },
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/auth/callback/github`,
    scope: 'read:user user:email',
    authUrl: 'https://github.com/login/oauth/authorize',
  },
};

// Mock user database for demo (in production, this would be a backend API)
const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@devdash.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    avatar: null,
  },
  {
    id: '2',
    email: 'dev@devdash.com',
    password: 'dev123',
    name: 'Developer',
    role: 'developer',
    avatar: null,
  },
];

class AuthService {
  constructor() {
    this.authFlags = getAuthFlags();
  }

  // ==================== Token Management ====================

  getStoredToken() {
    const storage = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
      ? localStorage
      : sessionStorage;
    return storage.getItem(AUTH_TOKEN_KEY);
  }

  getStoredUser() {
    const storage = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
      ? localStorage
      : sessionStorage;
    const userStr = storage.getItem(AUTH_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  getAuthMethod() {
    const storage = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
      ? localStorage
      : sessionStorage;
    return storage.getItem(AUTH_METHOD_KEY);
  }

  setAuthData(token, user, method, rememberMe = false) {
    const storage = rememberMe ? localStorage : sessionStorage;

    if (rememberMe) {
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }

    storage.setItem(AUTH_TOKEN_KEY, token);
    storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    storage.setItem(AUTH_METHOD_KEY, method);
  }

  clearAuthData() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_METHOD_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_METHOD_KEY);
  }

  isAuthenticated() {
    const token = this.getStoredToken();
    if (!token) return false;

    // Check token expiration (simplified - in production, decode JWT)
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1] || '{}'));
      if (tokenData.exp && Date.now() >= tokenData.exp * 1000) {
        this.clearAuthData();
        return false;
      }
    } catch {
      // If token parsing fails, still consider it valid if it exists
    }

    return true;
  }

  // ==================== Email/Password Authentication ====================

  async loginWithEmail(email, password, rememberMe = false) {
    if (!isFeatureEnabled('auth.enableEmailAuth')) {
      throw new Error('Email authentication is not enabled');
    }

    // Simulate API call delay
    await this.simulateNetworkDelay();

    // Find user in mock database
    const user = MOCK_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Generate mock JWT token
    const token = this.generateMockToken(user);

    // Store auth data
    const safeUser = { ...user };
    delete safeUser.password;
    this.setAuthData(token, safeUser, 'email', rememberMe);

    return {
      success: true,
      user: safeUser,
      token,
      method: 'email',
    };
  }

  async registerWithEmail(email, password, name) {
    if (!isFeatureEnabled('auth.enableEmailAuth')) {
      throw new Error('Email authentication is not enabled');
    }

    await this.simulateNetworkDelay();

    // Check if user already exists
    const existingUser = MOCK_USERS.find((u) => u.email === email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Create new user
    const newUser = {
      id: String(MOCK_USERS.length + 1),
      email,
      password,
      name,
      role: 'developer',
      avatar: null,
    };

    MOCK_USERS.push(newUser);

    // Generate token and store
    const token = this.generateMockToken(newUser);
    const safeUser = { ...newUser };
    delete safeUser.password;
    this.setAuthData(token, safeUser, 'email', false);

    return {
      success: true,
      user: safeUser,
      token,
      method: 'email',
    };
  }

  async requestPasswordReset(email) {
    if (!isFeatureEnabled('auth.enablePasswordReset')) {
      throw new Error('Password reset is not enabled');
    }

    await this.simulateNetworkDelay();

    const user = MOCK_USERS.find((u) => u.email === email);
    if (!user) {
      // Don't reveal if user exists for security
      return { success: true, message: 'If the email exists, a reset link has been sent' };
    }

    // In production, send email with reset token
    console.log(`Password reset requested for: ${email}`);
    return { success: true, message: 'If the email exists, a reset link has been sent' };
  }

  // ==================== OAuth Authentication ====================

  getOAuthLoginUrl(provider) {
    if (!isFeatureEnabled('auth.enableOAuth')) {
      throw new Error('OAuth authentication is not enabled');
    }

    if (!isFeatureEnabled(`auth.oAuthProviders.${provider}`)) {
      throw new Error(`${provider} OAuth is not enabled`);
    }

    const config = OAUTH_CONFIG[provider];
    if (!config) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const state = this.generateOAuthState();
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: 'code',
      state,
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(provider, code, state) {
    if (!isFeatureEnabled('auth.enableOAuth')) {
      throw new Error('OAuth authentication is not enabled');
    }

    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }
    sessionStorage.removeItem('oauth_state');

    await this.simulateNetworkDelay();

    // In production, exchange code for token with backend
    // For demo, create a mock OAuth user
    const mockOAuthUser = {
      id: `oauth_${provider}_${Date.now()}`,
      email: `user_${Date.now()}@${provider}.com`,
      name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      role: 'developer',
      avatar: null,
      provider,
    };

    const token = this.generateMockToken(mockOAuthUser);
    this.setAuthData(token, mockOAuthUser, `oauth_${provider}`, true);

    return {
      success: true,
      user: mockOAuthUser,
      token,
      method: `oauth_${provider}`,
    };
  }

  initiateOAuthLogin(provider) {
    const url = this.getOAuthLoginUrl(provider);
    // In demo mode, simulate OAuth flow
    if (import.meta.env.VITE_APP_ENV !== 'prod') {
      return this.simulateOAuthLogin(provider);
    }
    window.location.href = url;
  }

  async simulateOAuthLogin(provider) {
    if (!isFeatureEnabled('auth.enableOAuth')) {
      throw new Error('OAuth authentication is not enabled');
    }

    await this.simulateNetworkDelay(1500);

    const mockOAuthUser = {
      id: `oauth_${provider}_${Date.now()}`,
      email: `demo.user@${provider}.com`,
      name: provider === 'google' ? 'Google Demo User' : 'GitHub Demo User',
      role: 'developer',
      avatar: provider === 'google'
        ? 'https://lh3.googleusercontent.com/a/default-user=s96-c'
        : 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      provider,
    };

    const token = this.generateMockToken(mockOAuthUser);
    this.setAuthData(token, mockOAuthUser, `oauth_${provider}`, true);

    return {
      success: true,
      user: mockOAuthUser,
      token,
      method: `oauth_${provider}`,
    };
  }

  // ==================== Session Management ====================

  async logout() {
    this.clearAuthData();
    return { success: true };
  }

  async refreshToken() {
    const currentToken = this.getStoredToken();
    if (!currentToken) {
      throw new Error('No active session to refresh');
    }

    await this.simulateNetworkDelay();

    const user = this.getStoredUser();
    if (!user) {
      throw new Error('No user data found');
    }

    const newToken = this.generateMockToken(user);
    const method = this.getAuthMethod();
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';

    this.setAuthData(newToken, user, method, rememberMe);

    return {
      success: true,
      token: newToken,
    };
  }

  async getCurrentUser() {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.getStoredUser();
  }

  // ==================== Utility Methods ====================

  generateMockToken(user) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + this.authFlags.sessionTimeout * 60,
      })
    );
    const signature = btoa('mock_signature');
    return `${header}.${payload}.${signature}`;
  }

  generateOAuthState() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  simulateNetworkDelay(ms = 500) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get available auth methods based on feature flags
  getAvailableAuthMethods() {
    const methods = [];

    if (isFeatureEnabled('auth.enableEmailAuth')) {
      methods.push('email');
    }

    if (isFeatureEnabled('auth.enableOAuth')) {
      if (isFeatureEnabled('auth.oAuthProviders.google')) {
        methods.push('google');
      }
      if (isFeatureEnabled('auth.oAuthProviders.github')) {
        methods.push('github');
      }
      if (isFeatureEnabled('auth.oAuthProviders.microsoft')) {
        methods.push('microsoft');
      }
    }

    return methods;
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
