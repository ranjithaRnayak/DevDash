// PRAlerts.jsx - Active Pull Requests Dashboard
// All API calls go through backend to protect sensitive tokens
import React, { useEffect, useState, useCallback } from 'react';

// API base URL - all calls go through backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PRAlerts = () => {
    const [allPRs, setAllPRs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Get auth token from storage
    const getAuthToken = useCallback(() => {
        return localStorage.getItem('auth_token') || '';
    }, []);

    useEffect(() => {
        const fetchPRs = async () => {
            setLoading(true);
            setError(null);

            try {
                const token = getAuthToken();
                const response = await fetch(`${API_BASE}/devops/pullrequests?status=open`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();

                // Filter out drafts and transform to expected format
                const activePRs = (data || [])
                    .filter(pr => pr.status !== 'Draft')
                    .map(pr => ({
                        id: pr.id,
                        title: pr.title,
                        repoName: pr.sourceBranch?.split('/').pop() || 'Unknown',
                        author: pr.author,
                        createdAt: pr.createdAt,
                        url: pr.url,
                        source: pr.source === 'AzureDevOps' ? 'Azure' : pr.source,
                        reviewers: pr.reviewers || [],
                    }))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setAllPRs(activePRs);
            } catch (err) {
                console.error('Failed to fetch PRs:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPRs();
    }, [getAuthToken]);

    // Format relative time
    const formatRelativeTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) return `${Math.floor(diffMs / 60000)}m ago`;
        if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
        if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="pr-alerts-card">
                <h2>Active Pull Requests</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading PRs...</p>
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
        <div className="pr-alerts-card">
            <h2>Active Pull Requests</h2>

            {error && (
                <div className="error-banner">
                    <span>⚠️</span> {error}
                </div>
            )}

            <div className="pr-scroll">
                {allPRs.length === 0 ? (
                    <p>No Active PRs found.</p>
                ) : (
                    allPRs.map((pr, index) => {
                        const created = new Date(pr.createdAt);
                        const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);
                        const isOverdue = hoursOpen > 48;

                        // Build reviewer email list for mailto
                        const reviewerEmails = pr.reviewers
                            ?.map(r => r.uniqueName || r.email || '')
                            .filter(Boolean)
                            .join(',') || '';

                        const subject = encodeURIComponent(`Reminder: Review Pending PR - ${pr.title}`);
                        const body = encodeURIComponent(
                            `Hi Team,\n\nThis PR is pending for over 48 hours:\n${pr.title}\n${pr.url || ''}\n\nPlease review it when you get a chance.\n\nThanks,\nDevDash`
                        );

                        return (
                            <div
                                key={`${pr.source}-${pr.id}-${index}`}
                                className={`pr-row ${isOverdue ? 'overdue' : ''}`}
                                title={isOverdue ? `Click to send reminder` : 'PR under review'}
                                style={{ cursor: isOverdue ? 'pointer' : 'default' }}
                                onClick={() => {
                                    if (isOverdue && reviewerEmails) {
                                        window.location.href = `mailto:${reviewerEmails}?subject=${subject}&body=${body}`;
                                    } else if (pr.url) {
                                        window.open(pr.url, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                            >
                                <strong>{pr.title}</strong>
                                <p>📁 Repo: <span>{pr.repoName}</span></p>
                                <p>👤 {pr.author} | ⏱ {formatRelativeTime(pr.createdAt)}</p>
                                <p className="source-label">{pr.source}</p>
                                {isOverdue && (
                                    <span className="warning-label">🔴 Over 48 hrs</span>
                                )}
                            </div>
                        );
                    })
                )}
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

export default PRAlerts;
