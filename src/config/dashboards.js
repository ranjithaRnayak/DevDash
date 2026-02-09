/**
 * Dashboard Configuration
 * Defines pipeline and repo configurations for different dashboard types
 */

export const DASHBOARD_CONFIGS = {
    dev: {
        id: 'dev',
        name: 'Development Dashboard',
        description: 'Monitor CI/CD pipelines and development activities',
        azureDevOps: {
            pipelines: [
                'PowerOperation-CI',
                'PowerOperation-Nightly-Build',
            ],
        },
        github: {
            repos: ['PowerOperation/core', 'PowerOperation/api'],
        },
        features: {
            showPipelineStatus: true,
            showPRAlerts: true,
            showCodeQuality: true,
            showPerformanceMetrics: true,
            showAIAssistant: true,
            showLighthouse: false,
        },
    },

    test: {
        id: 'test',
        name: 'Test Dashboard',
        description: 'Monitor test pipelines and quality metrics',
        azureDevOps: {
            pipelines: [
                'PowerOperation-Integration-Tests',
                'PowerOperation-E2E-Tests',
                'PowerOperation-Performance-Tests',
            ],
        },
        github: {
            repos: ['PowerOperation/test-harness'],
        },
        features: {
            showPipelineStatus: true,
            showPRAlerts: true,
            showCodeQuality: true,
            showPerformanceMetrics: false,
            showAIAssistant: true,
            showLighthouse: true,
        },
    },
};

export const getCurrentDashboard = () => {
    const path = window.location.pathname;
    if (path.includes('/test')) {
        return DASHBOARD_CONFIGS.test;
    }
    return DASHBOARD_CONFIGS.dev;
};

export const getDashboardById = (id) => {
    return DASHBOARD_CONFIGS[id] || DASHBOARD_CONFIGS.dev;
};

export const getDashboardPipelines = (dashboardId) => {
    const config = getDashboardById(dashboardId);
    return config.azureDevOps.pipelines;
};

export const getDashboardRepos = (dashboardId) => {
    const config = getDashboardById(dashboardId);
    return config.github.repos;
};

export const isDashboardFeatureEnabled = (dashboardId, feature) => {
    const config = getDashboardById(dashboardId);
    return config.features[feature] ?? false;
};

export default DASHBOARD_CONFIGS;
