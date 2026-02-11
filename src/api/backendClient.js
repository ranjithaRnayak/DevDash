/**
 * Backend API Client - Centralized client for .NET backend API communication
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('devdash_auth_token')
                  || sessionStorage.getItem('devdash_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens but don't reload - let AuthContext handle it
      localStorage.removeItem('devdash_auth_token');
      sessionStorage.removeItem('devdash_auth_token');
      // Don't reload - causes infinite loop if API returns 401
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  getCurrentUser: () => apiClient.get('/auth/me'),
  validateToken: () => apiClient.get('/auth/validate'),
  logout: () => apiClient.post('/auth/logout'),
  getFeatureFlags: () => apiClient.get('/auth/features'),
};

export const aiAPI = {
  query: (request) => apiClient.post('/aiassistant/query', request),
  explainError: (errorLog, pipelineId) =>
    apiClient.post('/aiassistant/explain-error', { errorLog, pipelineId }),
  searchIssues: (query, limit = 10) =>
    apiClient.get(`/aiassistant/issues/search?query=${encodeURIComponent(query)}&limit=${limit}`),
  getResolutions: (issueId) =>
    apiClient.get(`/aiassistant/issues/${issueId}/resolutions`),
  getCommonIssues: (category) =>
    apiClient.get(`/aiassistant/issues/common${category ? `?category=${category}` : ''}`),
  getChatHistory: (limit = 50) =>
    apiClient.get(`/aiassistant/history?limit=${limit}`),
  clearChatHistory: () =>
    apiClient.delete('/aiassistant/history'),
};

export const devOpsAPI = {
  getDashboard: () => apiClient.get('/devops/dashboard'),
  getBuilds: (count = 10, environment = null) =>
    apiClient.get(`/devops/builds?count=${count}${environment ? `&environment=${environment}` : ''}`),
  getBuild: (buildId) => apiClient.get(`/devops/builds/${buildId}`),
  getBuildLogs: (buildId) => apiClient.get(`/devops/builds/${buildId}/logs`),
  getPullRequests: (status) =>
    apiClient.get(`/devops/pullrequests${status ? `?status=${status}` : ''}`),
  getAzDoPullRequests: (status) =>
    apiClient.get(`/devops/pullrequests/azdo${status ? `?status=${status}` : ''}`),
  getGitHubPullRequests: (state = 'open') =>
    apiClient.get(`/devops/pullrequests/github?state=${state}`),
  getGitHubPR: (prNumber) =>
    apiClient.get(`/devops/pullrequests/github/${prNumber}`),
  getPRAlertsConfig: () => apiClient.get('/devops/pralerts/config'),
  getTeamMembers: () => apiClient.get('/devops/team/members'),
};

export const healthAPI = {
  live: () => apiClient.get('/health/live'),
  ready: () => apiClient.get('/health/ready'),
  status: () => apiClient.get('/health/status'),
};

export const sonarqubeAPI = {
  getConfig: () => apiClient.get('/sonarqube/config'),
  getProjects: () => apiClient.get('/sonarqube/projects'),
  getMetrics: (projectKey) => apiClient.get(`/sonarqube/projects/${projectKey}/metrics`),
};

export const copilotAPI = {
  chat: (request) => apiClient.post('/copilot/chat', request),
  getContext: (dashboardId) =>
    apiClient.get(`/copilot/context${dashboardId ? `?dashboardId=${dashboardId}` : ''}`),
  getStatus: () => apiClient.get('/copilot/status'),
};

export const lighthouseAPI = {
  getStatus: () => apiClient.get('/lighthouse/status'),
  getBranches: () => apiClient.get('/lighthouse/branches'),
  getBranchResult: (branch) => apiClient.get(`/lighthouse/branch/${encodeURIComponent(branch)}`),
  getBranchHistory: (branch, limit = 10) =>
    apiClient.get(`/lighthouse/branch/${encodeURIComponent(branch)}/history?limit=${limit}`),
  runAudit: (branch, deploymentUrl) =>
    apiClient.post('/lighthouse/audit', { branch, deploymentUrl }),
};

export const performanceAPI = {
  getDashboard: () => apiClient.get('/performance/dashboard'),
  getDraftPRs: () => apiClient.get('/performance/draft-prs'),
  getCommits: () => apiClient.get('/performance/commits'),
  getStoryPoints: () => apiClient.get('/performance/story-points'),
  scheduleReview: (prDetails) => apiClient.post('/performance/schedule-review', prDetails),
};

export default apiClient;
