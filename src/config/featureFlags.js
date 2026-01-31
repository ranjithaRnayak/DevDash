// Feature Flags Configuration
// Controls which features are enabled in the application

// Check if PAT token mode is enabled (bypasses login, uses existing PAT tokens)
const usePATToken = import.meta.env.VITE_USE_PAT_TOKEN === 'true';

const featureFlags = {
  // PAT Token Mode - bypasses login page and uses existing PAT authentication
  usePATToken,

  // Authentication Features
  auth: {
    // Enable OAuth authentication (Google, GitHub, etc.)
    enableOAuth: !usePATToken,
    // Enable traditional email/password authentication
    enableEmailAuth: !usePATToken,
    // Enable dual auth mode (allows both OAuth and email/password)
    enableDualAuth: !usePATToken,
    // Require login (false = PAT token mode, true = login required)
    requireLogin: !usePATToken,
    // OAuth providers configuration
    oAuthProviders: {
      google: !usePATToken,
      github: !usePATToken,
      microsoft: false,
    },
    // Session timeout in minutes
    sessionTimeout: 60,
    // Enable "Remember Me" functionality
    enableRememberMe: true,
    // Enable password reset via email
    enablePasswordReset: true,
  },

  // Dashboard Features
  dashboard: {
    // Enable pipeline status widget
    enablePipelineStatus: true,
    // Enable PR alerts widget
    enablePRAlerts: true,
    // Enable code quality metrics
    enableCodeQuality: true,
    // Enable AI assistant
    enableAIAssistant: true,
    // Enable performance metrics
    enablePerformanceMetrics: true,
  },

  // Environment-specific flags
  environments: {
    dev: {
      enableDebugMode: true,
      enableMockData: true,
      enableDevTools: true,
    },
    test: {
      enableDebugMode: true,
      enableMockData: true,
      enableDevTools: false,
    },
    prod: {
      enableDebugMode: false,
      enableMockData: false,
      enableDevTools: false,
    },
  },
};

// Get current environment
const getCurrentEnvironment = () => {
  return import.meta.env.VITE_APP_ENV || 'dev';
};

// Check if a specific feature is enabled
export const isFeatureEnabled = (featurePath) => {
  const keys = featurePath.split('.');
  let value = featureFlags;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return false;
    }
  }

  return Boolean(value);
};

// Get environment-specific feature
export const getEnvFeature = (featureName) => {
  const env = getCurrentEnvironment();
  return featureFlags.environments[env]?.[featureName] ?? false;
};

// Get all auth-related flags
export const getAuthFlags = () => featureFlags.auth;

// Get all dashboard-related flags
export const getDashboardFlags = () => featureFlags.dashboard;

// Check if OAuth is the primary auth method
export const isPrimaryAuthOAuth = () => {
  return featureFlags.auth.enableOAuth && !featureFlags.auth.enableEmailAuth;
};

// Check if dual auth is active
export const isDualAuthEnabled = () => {
  return (
    featureFlags.auth.enableDualAuth &&
    featureFlags.auth.enableOAuth &&
    featureFlags.auth.enableEmailAuth
  );
};

// Check if PAT token mode is enabled (bypasses login)
export const isPATTokenMode = () => featureFlags.usePATToken;

// Check if login is required
export const isLoginRequired = () => featureFlags.auth.requireLogin;

export default featureFlags;
