// Feature Flags Configuration
// Controls which features are enabled in the application

// Check if PAT token mode is enabled (bypasses login, uses existing PAT tokens)
const usePATToken = import.meta.env.VITE_USE_PAT_TOKEN === 'true';

// Check if GitHub is connected (via PAT or OAuth)
const isGitHubConnected = () => {
  return !!import.meta.env.VITE_GITHUB_PAT ||
         localStorage.getItem('devdash_github_connected') === 'true';
};

const featureFlags = {
  // PAT Token Mode - bypasses login page and uses existing PAT authentication
  usePATToken,

  // Authentication Features
  auth: {
    // Primary authentication provider - Microsoft Entra ID
    enableEntraID: !usePATToken,
    // Require login (false = PAT token mode, true = Entra ID login required)
    requireLogin: !usePATToken,
    // Session timeout in minutes
    sessionTimeout: 60,
  },

  // GitHub Integration (optional, not a login provider)
  github: {
    // GitHub is an optional integration, not authentication
    isIntegration: true,
    // Check if GitHub is currently connected
    isConnected: isGitHubConnected,
    // Connection methods
    connectionMethods: {
      // PAT token (temporary solution)
      pat: true,
      // OAuth / GitHub App (future)
      oauth: false,
    },
  },

  // Dashboard Features
  dashboard: {
    // Enable pipeline status widget
    enablePipelineStatus: true,
    // Enable PR alerts widget (requires GitHub connection for GitHub PRs)
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

  return typeof value === 'function' ? value() : Boolean(value);
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

// Check if PAT token mode is enabled (bypasses login)
export const isPATTokenMode = () => featureFlags.usePATToken;

// Check if login is required (Entra ID)
export const isLoginRequired = () => featureFlags.auth.requireLogin;

// Check if GitHub is connected
export const isGitHubConnectedFlag = () => featureFlags.github.isConnected();

// Set GitHub connection status
export const setGitHubConnected = (connected) => {
  if (connected) {
    localStorage.setItem('devdash_github_connected', 'true');
  } else {
    localStorage.removeItem('devdash_github_connected');
  }
};

export default featureFlags;
