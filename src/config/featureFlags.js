/**
 * Feature Flags Configuration
 * Controls which features are enabled in the application
 * All sensitive tokens are handled by the backend
 */

const usePATToken = import.meta.env.VITE_USE_PAT_TOKEN === 'true';
const enableGitHubOAuth = import.meta.env.VITE_GITHUB_OAUTH_ENABLED === 'true';

const isGitHubConnected = () => {
    return localStorage.getItem('devdash_github_connected') === 'true';
};

const getGitHubConnectionMethod = () => {
    return localStorage.getItem('devdash_github_connection_method') || null;
};

const featureFlags = {
    usePATToken,

    auth: {
        enableEntraID: !usePATToken,
        requireLogin: !usePATToken,
        sessionTimeout: 60,
    },

    github: {
        isIntegration: true,
        isConnected: isGitHubConnected,
        connectionMethod: getGitHubConnectionMethod,
        connectionMethods: {
            oauth: enableGitHubOAuth,
        },
    },

    dashboard: {
        enablePipelineStatus: true,
        enablePRAlerts: true,
        enableCodeQuality: true,
        enableAIAssistant: true,
        enablePerformanceMetrics: true,
        enableLighthouse: false,
    },

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

const getCurrentEnvironment = () => {
    return import.meta.env.VITE_APP_ENV || 'dev';
};

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

export const getEnvFeature = (featureName) => {
    const env = getCurrentEnvironment();
    return featureFlags.environments[env]?.[featureName] ?? false;
};

export const getAuthFlags = () => featureFlags.auth;

export const getDashboardFlags = () => featureFlags.dashboard;

export const isPATTokenMode = () => featureFlags.usePATToken;

export const isLoginRequired = () => featureFlags.auth.requireLogin;

export const isGitHubConnectedFlag = () => featureFlags.github.isConnected();

export const setGitHubConnected = (connected, method = null) => {
    if (connected) {
        localStorage.setItem('devdash_github_connected', 'true');
        if (method) {
            localStorage.setItem('devdash_github_connection_method', method);
        }
    } else {
        localStorage.removeItem('devdash_github_connected');
        localStorage.removeItem('devdash_github_connection_method');
    }
};

export const getGitHubConnectionMethods = () => featureFlags.github.connectionMethods;

export const isGitHubOAuthEnabled = () => featureFlags.github.connectionMethods.oauth;

export const isGitHubPATEnabled = () => true;

export default featureFlags;
