// Backend API Client
// Centralized client for communicating with the .NET backend API

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
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

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      localStorage.removeItem('devdash_auth_token');
      sessionStorage.removeItem('devdash_auth_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ==================== Auth API ====================

export const authAPI = {
  getCurrentUser: () => apiClient.get('/auth/me'),
  validateToken: () => apiClient.get('/auth/validate'),
  logout: () => apiClient.post('/auth/logout'),
  getFeatureFlags: () => apiClient.get('/auth/features'),
};

// ==================== AI Assistant API ====================

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

// ==================== DevOps API ====================

export const devOpsAPI = {
  getDashboard: () => apiClient.get('/devops/dashboard'),
  getBuilds: (count = 10) => apiClient.get(`/devops/builds?count=${count}`),
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
};

// ==================== Health API ====================

export const healthAPI = {
  live: () => apiClient.get('/health/live'),
  ready: () => apiClient.get('/health/ready'),
  status: () => apiClient.get('/health/status'),
};

export default apiClient;
