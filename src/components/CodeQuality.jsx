// CodeQuality.jsx - SonarQube Integration
// All API calls go through backend to protect sensitive tokens
import React, { useEffect, useState, useCallback } from 'react';

// API base URL - all calls go through backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const CodeQuality = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sonarConfig, setSonarConfig] = useState({ baseUrl: '', isConfigured: false });

    // Get auth token from storage
    const getAuthToken = useCallback(() => {
        return localStorage.getItem('auth_token') || '';
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = getAuthToken();
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                // Fetch config and projects in parallel
                const [configRes, projectsRes] = await Promise.all([
                    fetch(`${API_BASE}/sonarqube/config`, { headers }),
                    fetch(`${API_BASE}/sonarqube/projects`, { headers }),
                ]);

                if (configRes.ok) {
                    const config = await configRes.json();
                    setSonarConfig(config);
                }

                if (!projectsRes.ok) {
                    throw new Error(`API error: ${projectsRes.status}`);
                }

                const projectsData = await projectsRes.json();
                setProjects(projectsData || []);
            } catch (err) {
                console.error('Failed to fetch SonarQube data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [getAuthToken]);

    // Click handler to open SonarQube project
    const handleCardClick = (projectKey) => {
        if (!sonarConfig.baseUrl) {
            console.warn('SonarQube URL not configured');
            return;
        }
        const sonarUrl = `${sonarConfig.baseUrl}/dashboard?id=${encodeURIComponent(projectKey)}&codeScope=overall`;
        window.open(sonarUrl, '_blank', 'noopener,noreferrer');
    };

    // Quality gate status styling
    const getQualityGateStyle = (status) => {
        const statusUpper = (status || '').toUpperCase();
        if (statusUpper === 'OK' || statusUpper === 'PASSED') {
            return { color: '#22c55e', icon: '✓', label: 'Passed' };
        } else if (statusUpper === 'ERROR' || statusUpper === 'FAILED') {
            return { color: '#ef4444', icon: '✗', label: 'Failed' };
        }
        return { color: '#f59e0b', icon: '?', label: status || 'Unknown' };
    };

    // Metric severity styling
    const getMetricStyle = (value, thresholds = { low: 0, medium: 5, high: 10 }) => {
        const numValue = parseInt(value) || 0;
        if (numValue <= thresholds.low) return '#22c55e';
        if (numValue <= thresholds.medium) return '#f59e0b';
        return '#ef4444';
    };

    // Check if project has no issues
    const hasNoIssues = (project) => {
        return project.bugs === 0 &&
               project.vulnerabilities === 0 &&
               project.codeSmells === 0;
    };

    if (loading) {
        return (
            <div className="card">
                <h2>Code Quality</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading metrics...</p>
                </div>
                <style>{`
                    .loading-state { text-align: center; padding: 20px; }
                    .spinner {
                        width: 30px;
                        height: 30px;
                        border: 3px solid rgba(34, 197, 94, 0.2);
                        border-top-color: #22c55e;
                        border-radius: 50%;
                        animation: spin 0.8s linear infinite;
                        margin: 0 auto 10px;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    return (
        <div className="card code-quality-container">
            <div className="card-header">
                <h2>Code Quality</h2>
                {!sonarConfig.isConfigured && (
                    <span className="mock-badge" title="SonarQube not configured in backend">
                        Demo Data
                    </span>
                )}
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️</span> {error}
                </div>
            )}

            {projects.length === 0 && !error && (
                <p>No projects configured.</p>
            )}

            <div className="code-quality-scroll">
                {projects.map((project) => {
                    const qualityGate = getQualityGateStyle(project.qualityGateStatus);
                    const noIssues = hasNoIssues(project);

                    return (
                        <div
                            key={project.projectKey}
                            className="code-quality-clickable"
                            onClick={() => handleCardClick(project.projectKey)}
                            title="Click to view full report in SonarQube"
                        >
                            {/* Project Header */}
                            <div className="project-header">
                                <span className="project-name">{project.projectName || project.projectKey}</span>
                                <div className="quality-gate-badge" style={{ backgroundColor: `${qualityGate.color}20`, borderColor: qualityGate.color }}>
                                    <span style={{ color: qualityGate.color }}>{qualityGate.icon}</span>
                                    <span style={{ color: qualityGate.color }}>{qualityGate.label}</span>
                                </div>
                            </div>

                            {project.error && (
                                <div className="project-error">⚠️ {project.error}</div>
                            )}

                            {/* No Issues Message */}
                            {noIssues && !project.error ? (
                                <div className="no-issues">
                                    <span className="no-issues-icon">✓</span>
                                    <span>No issues found</span>
                                </div>
                            ) : (
                                /* Metrics Grid - Only show if there are issues */
                                <div className="metrics-grid">
                                    <div className="metric-item">
                                        <span className="metric-icon">🐞</span>
                                        <div className="metric-info">
                                            <span className="metric-value" style={{ color: getMetricStyle(project.bugs, { low: 0, medium: 3, high: 10 }) }}>
                                                {project.bugs}
                                            </span>
                                            <span className="metric-label">Bugs</span>
                                        </div>
                                    </div>

                                    <div className="metric-item">
                                        <span className="metric-icon">🔓</span>
                                        <div className="metric-info">
                                            <span className="metric-value" style={{ color: getMetricStyle(project.vulnerabilities, { low: 0, medium: 2, high: 5 }) }}>
                                                {project.vulnerabilities}
                                            </span>
                                            <span className="metric-label">Vulnerabilities</span>
                                        </div>
                                    </div>

                                    <div className="metric-item">
                                        <span className="metric-icon">💨</span>
                                        <div className="metric-info">
                                            <span className="metric-value" style={{ color: getMetricStyle(project.codeSmells, { low: 5, medium: 20, high: 50 }) }}>
                                                {project.codeSmells}
                                            </span>
                                            <span className="metric-label">Code Smells</span>
                                        </div>
                                    </div>

                                    <div className="metric-item">
                                        <span className="metric-icon">🧪</span>
                                        <div className="metric-info">
                                            <span className="metric-value">
                                                {project.coverage ? `${project.coverage.toFixed(1)}%` : 'N/A'}
                                            </span>
                                            <span className="metric-label">Coverage</span>
                                        </div>
                                    </div>

                                    <div className="metric-item">
                                        <span className="metric-icon">📋</span>
                                        <div className="metric-info">
                                            <span className="metric-value">
                                                {project.duplications ? `${project.duplications.toFixed(1)}%` : 'N/A'}
                                            </span>
                                            <span className="metric-label">Duplications</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Click indicator */}
                            <div className="click-indicator">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                <span>View in SonarQube</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .code-quality-container {
                    position: relative;
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .card-header h2 {
                    margin: 0;
                }

                .mock-badge {
                    font-size: 10px;
                    padding: 4px 8px;
                    background: rgba(245, 158, 11, 0.2);
                    border: 1px solid rgba(245, 158, 11, 0.4);
                    border-radius: 12px;
                    color: #f59e0b;
                    cursor: help;
                }

                .error-banner {
                    padding: 8px 12px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 6px;
                    color: #fca5a5;
                    font-size: 12px;
                    margin-bottom: 16px;
                }

                .code-quality-clickable {
                    padding: 16px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                }

                .code-quality-clickable:hover {
                    transform: translateY(-2px);
                    border-color: rgba(59, 130, 246, 0.5);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15), 0 0 0 1px rgba(59, 130, 246, 0.1);
                }

                .code-quality-clickable:active {
                    transform: translateY(0);
                }

                .project-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .project-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: #e2e8f0;
                }

                .quality-gate-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    border-radius: 16px;
                    border: 1px solid;
                    font-size: 12px;
                    font-weight: 500;
                }

                .project-error {
                    padding: 8px 12px;
                    background: rgba(239, 68, 68, 0.1);
                    border-radius: 6px;
                    color: #fca5a5;
                    font-size: 12px;
                    margin-bottom: 12px;
                }

                .no-issues {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 8px;
                    color: #22c55e;
                    font-size: 14px;
                    font-weight: 500;
                    margin-bottom: 12px;
                }

                .no-issues-icon {
                    font-size: 18px;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
                    gap: 10px;
                }

                .metric-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 8px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .metric-icon {
                    font-size: 18px;
                }

                .metric-info {
                    display: flex;
                    flex-direction: column;
                }

                .metric-value {
                    font-size: 16px;
                    font-weight: 600;
                }

                .metric-label {
                    font-size: 10px;
                    color: #64748b;
                }

                .click-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 6px;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    color: #64748b;
                    font-size: 11px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .code-quality-clickable:hover .click-indicator {
                    opacity: 1;
                    color: #3b82f6;
                }

                @media (max-width: 600px) {
                    .metrics-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .project-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 8px;
                    }
                }
            `}</style>
        </div>
    );
};

export default CodeQuality;
