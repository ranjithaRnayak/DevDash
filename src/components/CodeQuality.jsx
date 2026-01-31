import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const CodeQuality = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sonarConfig, setSonarConfig] = useState({ baseUrl: '', isConfigured: false });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch config and projects from backend API (tokens handled server-side)
                const [configRes, projectsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/sonarqube/config`),
                    axios.get(`${API_BASE_URL}/sonarqube/projects`),
                ]);

                setSonarConfig(configRes.data || { baseUrl: '', isConfigured: false });
                setProjects(projectsRes.data || []);
            } catch (error) {
                console.error('Failed to fetch SonarQube data:', error);
                setProjects([]);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCardClick = (projectKey) => {
        if (!sonarConfig.baseUrl) return;
        const sonarUrl = `${sonarConfig.baseUrl}/dashboard?id=${encodeURIComponent(projectKey)}&codeScope=overall`;
        window.open(sonarUrl, '_blank', 'noopener,noreferrer');
    };

    const getQualityGateStyle = (status) => {
        const statusUpper = (status || '').toUpperCase();
        if (statusUpper === 'OK' || statusUpper === 'PASSED') {
            return { color: '#22c55e', icon: '✓', label: 'Passed' };
        } else if (statusUpper === 'ERROR' || statusUpper === 'FAILED') {
            return { color: '#ef4444', icon: '✗', label: 'Failed' };
        }
        return { color: '#f59e0b', icon: '?', label: status || 'Unknown' };
    };

    const getMetricStyle = (value, thresholds = { low: 0, medium: 5, high: 10 }) => {
        const numValue = parseInt(value) || 0;
        if (numValue <= thresholds.low) return '#22c55e';
        if (numValue <= thresholds.medium) return '#f59e0b';
        return '#ef4444';
    };

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
            </div>
        );
    }

    return (
        <div className="card code-quality-container">
            <div className="code-quality-header">
                <h2>Code Quality</h2>
                {!sonarConfig.isConfigured && (
                    <span className="mock-badge" title="SonarQube not configured in backend">
                        Demo Data
                    </span>
                )}
            </div>

            {projects.length === 0 && <p>No projects configured.</p>}

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
                            <div className="project-header">
                                <span className="project-name">{project.projectName || project.projectKey}</span>
                                <div className="quality-gate-badge" style={{ backgroundColor: `${qualityGate.color}20`, borderColor: qualityGate.color }}>
                                    <span style={{ color: qualityGate.color }}>{qualityGate.icon}</span>
                                    <span style={{ color: qualityGate.color }}>{qualityGate.label}</span>
                                </div>
                            </div>

                            {project.error && (
                                <div className="project-error">{project.error}</div>
                            )}

                            {noIssues && !project.error ? (
                                <div className="no-issues">
                                    <span className="no-issues-icon">✓</span>
                                    <span>No issues found</span>
                                </div>
                            ) : (
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
        </div>
    );
};

export default CodeQuality;
