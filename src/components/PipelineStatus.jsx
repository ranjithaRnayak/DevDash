// PipelineStatus.jsx - Pipeline Builds Dashboard
// All API calls go through backend to protect sensitive tokens
import React, { useEffect, useState, useCallback } from 'react';

// API base URL - all calls go through backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PipelineStatus = () => {
    const [builds, setBuilds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get auth token from storage
    const getAuthToken = useCallback(() => {
        return localStorage.getItem('auth_token') || '';
    }, []);

    useEffect(() => {
        const fetchBuilds = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = getAuthToken();
                const response = await fetch(`${API_BASE}/devops/builds?count=20`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                setBuilds(data || []);
            } catch (err) {
                console.error('Failed to fetch builds:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchBuilds();
    }, [getAuthToken]);

    const getStatusClass = (result, status) => {
        const resultLower = (result || status || '').toLowerCase();
        switch (resultLower) {
            case 'succeeded': return 'badge badge-success';
            case 'failed': return 'badge badge-danger';
            case 'inprogress': return 'badge badge-warning';
            case 'partiallysucceeded': return 'badge badge-warning';
            case 'canceled': return 'badge badge-secondary';
            default: return 'badge';
        }
    };

    const formatDuration = (startTime, finishTime) => {
        if (!startTime) return '...';
        const start = new Date(startTime);
        const finish = finishTime ? new Date(finishTime) : new Date();
        const durationMs = finish - start;

        if (durationMs < 0) return '...';
        if (durationMs < 60000) return `${(durationMs / 1000).toFixed(0)}s`;
        if (durationMs < 3600000) return `${Math.floor(durationMs / 60000)}m`;
        return `${(durationMs / 3600000).toFixed(1)}h`;
    };

    if (loading) {
        return (
            <div className="pipeline-alerts-card">
                <h2>Pipeline Builds</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading builds...</p>
                </div>
                <style>{`
                    .loading-state { text-align: center; padding: 20px; }
                    .spinner {
                        width: 30px;
                        height: 30px;
                        border: 3px solid rgba(59, 130, 246, 0.2);
                        border-top-color: #3b82f6;
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
        <div className="pipeline-alerts-card">
            <h2>Pipeline Builds</h2>

            {error && (
                <div className="error-banner">
                    <span>⚠️</span> {error}
                </div>
            )}

            {builds.length === 0 && !error && <p>No builds found.</p>}

            <div className="table-header">
                <div>Build Name</div>
                <div>Status</div>
                <div>Duration</div>
            </div>

            <div className="pipeline-scroll">
                {builds.map((b) => {
                    const duration = formatDuration(b.startTime, b.finishTime);
                    const fullBranch = b.sourceBranch?.replace('refs/heads/', '') || '';

                    return (
                        <div
                            className="table-row"
                            key={b.id}
                            title={`Branch: ${fullBranch}`}
                            onClick={() => b.url && window.open(b.url, '_blank', 'noopener,noreferrer')}
                            style={{ cursor: b.url ? 'pointer' : 'default' }}
                        >
                            <div>{b.pipelineName || b.definition?.name || 'N/A'}</div>
                            <div>
                                <span className={getStatusClass(b.result, b.status)}>
                                    {b.result || b.status || 'Unknown'}
                                </span>
                            </div>
                            <div>{duration}</div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .error-banner {
                    padding: 8px 12px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 6px;
                    color: #fca5a5;
                    font-size: 12px;
                    margin-bottom: 16px;
                }
            `}</style>
        </div>
    );
};

export default PipelineStatus;
