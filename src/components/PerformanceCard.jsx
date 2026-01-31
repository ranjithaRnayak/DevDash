// components/PerformanceCard.jsx - Personal Developer Dashboard
// All API calls go through backend to protect sensitive tokens
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// API base URL - all calls go through backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PerformanceCard = () => {
    const { user } = useAuth();
    const [draftPRs, setDraftPRs] = useState([]);
    const [recentCommits, setRecentCommits] = useState([]);
    const [storyPoints, setStoryPoints] = useState({ notStarted: 0, total: 0, items: [] });
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('drafts');
    const [selectedPR, setSelectedPR] = useState(null);
    const [schedulingMeeting, setSchedulingMeeting] = useState(false);

    // Get auth token from context/storage
    const getAuthToken = useCallback(() => {
        return localStorage.getItem('auth_token') || '';
    }, []);

    // Fetch helper with auth header
    const fetchWithAuth = useCallback(async (endpoint) => {
        const token = getAuthToken();
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return response.json();
    }, [getAuthToken]);

    // Fetch all dashboard data
    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch all data from backend (single endpoint or parallel calls)
                const dashboardData = await fetchWithAuth('/performance/dashboard');

                setCurrentUser(dashboardData.user);
                setDraftPRs(dashboardData.draftPRs || []);
                setRecentCommits(dashboardData.recentCommits || []);
                setStoryPoints(dashboardData.storyPoints || { notStarted: 0, total: 0, items: [] });
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError(err.message);

                // Try fetching individual endpoints as fallback
                try {
                    const [drafts, commits, points] = await Promise.allSettled([
                        fetchWithAuth('/performance/draft-prs'),
                        fetchWithAuth('/performance/commits'),
                        fetchWithAuth('/performance/story-points'),
                    ]);

                    if (drafts.status === 'fulfilled') setDraftPRs(drafts.value || []);
                    if (commits.status === 'fulfilled') setRecentCommits(commits.value || []);
                    if (points.status === 'fulfilled') setStoryPoints(points.value || { notStarted: 0, total: 0, items: [] });

                    setError(null);
                } catch (fallbackErr) {
                    console.error('Fallback fetch failed:', fallbackErr);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [fetchWithAuth]);

    // Schedule Code Review via Microsoft Graph (backend handles the API call)
    const handleScheduleCodeReview = async (pr = null) => {
        const targetPR = pr || selectedPR;

        if (!targetPR) {
            // No PR selected - open Teams meeting creation directly
            const teamsUrl = 'https://teams.microsoft.com/l/meeting/new?subject=' +
                encodeURIComponent('Code Review Session');
            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        setSchedulingMeeting(true);

        try {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE}/performance/schedule-review`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prId: targetPR.id,
                    prTitle: targetPR.title,
                    prUrl: targetPR.url,
                    repoName: targetPR.repoName,
                    reviewers: targetPR.reviewers?.map(r => ({
                        displayName: r.displayName,
                        email: r.email,
                    })) || [],
                }),
            });

            const result = await response.json();

            if (result.success && result.meetingUrl) {
                window.open(result.meetingUrl, '_blank', 'noopener,noreferrer');
            } else {
                // Fallback to deep link
                const subject = encodeURIComponent(`Code Review – PR #${targetPR.id}`);
                const body = encodeURIComponent(`Code review for: ${targetPR.title}\nPR Link: ${targetPR.url}`);
                const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${body}`;
                window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('Failed to schedule meeting:', err);
            // Fallback to Teams deep link
            const subject = encodeURIComponent(`Code Review – PR #${targetPR.id}`);
            const body = encodeURIComponent(`Code review for: ${targetPR.title}\nPR Link: ${targetPR.url}`);
            const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${body}`;
            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
        } finally {
            setSchedulingMeeting(false);
            setSelectedPR(null);
        }
    };

    // Format relative time
    const formatRelativeTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Get source badge color
    const getSourceColor = (source) => {
        return source === 'GitHub' ? '#238636' : '#0078d4';
    };

    if (loading) {
        return (
            <div className="card performance-card">
                <h2>My Performance</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading your data...</p>
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
        <div className="card performance-card">
            <div className="perf-header">
                <h2>My Performance</h2>
                {currentUser && (
                    <span className="user-badge" title={currentUser.email}>
                        {currentUser.displayName}
                    </span>
                )}
                <button
                    className="schedule-btn"
                    onClick={() => handleScheduleCodeReview()}
                    disabled={schedulingMeeting}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {schedulingMeeting ? 'Scheduling...' : 'Schedule Code Review'}
                </button>
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️</span> {error}
                </div>
            )}

            {/* Story Points Summary */}
            <div className="story-points-banner">
                <div className="sp-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                </div>
                <div className="sp-info">
                    <span className="sp-value">{storyPoints.notStarted}</span>
                    <span className="sp-label">Story Points Not Started (PBI/User Story)</span>
                </div>
                <div className="sp-count">
                    <span>{storyPoints.total} items</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="perf-tabs">
                <button
                    className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`}
                    onClick={() => setActiveTab('drafts')}
                >
                    Draft PRs ({draftPRs.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'commits' ? 'active' : ''}`}
                    onClick={() => setActiveTab('commits')}
                >
                    Recent Check-ins ({recentCommits.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'backlog' ? 'active' : ''}`}
                    onClick={() => setActiveTab('backlog')}
                >
                    Backlog ({storyPoints.total})
                </button>
            </div>

            {/* Tab Content */}
            <div className="perf-scroll">
                {/* Draft PRs Tab */}
                {activeTab === 'drafts' && (
                    <div className="tab-content">
                        {draftPRs.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">📝</span>
                                <p>No draft PRs found</p>
                            </div>
                        ) : (
                            draftPRs.map((pr) => (
                                <div
                                    key={`${pr.source}-${pr.id}`}
                                    className={`perf-item ${selectedPR?.id === pr.id ? 'selected' : ''}`}
                                >
                                    <div
                                        className="item-content"
                                        onClick={() => window.open(pr.url, '_blank', 'noopener,noreferrer')}
                                    >
                                        <div className="item-header">
                                            <span className="item-title">{pr.title}</span>
                                            <span className="source-badge" style={{ backgroundColor: getSourceColor(pr.source) }}>
                                                {pr.source}
                                            </span>
                                        </div>
                                        <div className="item-meta">
                                            <span>📁 {pr.repoName}</span>
                                            <span>→ {pr.targetBranch}</span>
                                            <span>⏱ {formatRelativeTime(pr.createdAt)}</span>
                                        </div>
                                        {pr.reviewers && pr.reviewers.length > 0 && (
                                            <div className="reviewers-list">
                                                <span className="reviewers-label">Reviewers:</span>
                                                {pr.reviewers.slice(0, 3).map((r, idx) => (
                                                    <span key={idx} className="reviewer-badge">
                                                        {r.displayName}
                                                    </span>
                                                ))}
                                                {pr.reviewers.length > 3 && (
                                                    <span className="reviewer-more">+{pr.reviewers.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="schedule-pr-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleScheduleCodeReview(pr);
                                        }}
                                        title={`Schedule Code Review for PR #${pr.id}`}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Recent Commits Tab */}
                {activeTab === 'commits' && (
                    <div className="tab-content">
                        {recentCommits.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">📦</span>
                                <p>No recent commits found</p>
                            </div>
                        ) : (
                            recentCommits.map((commit, idx) => (
                                <div
                                    key={`${commit.source}-${commit.id}-${idx}`}
                                    className="perf-item"
                                    onClick={() => window.open(commit.url, '_blank', 'noopener,noreferrer')}
                                >
                                    <div className="item-header">
                                        <span className="commit-hash">{commit.id}</span>
                                        <span className="source-badge" style={{ backgroundColor: getSourceColor(commit.source) }}>
                                            {commit.source}
                                        </span>
                                    </div>
                                    <div className="commit-message">{commit.message}</div>
                                    <div className="item-meta">
                                        <span>📁 {commit.repoName}</span>
                                        <span>⏱ {formatRelativeTime(commit.date)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Backlog Items Tab */}
                {activeTab === 'backlog' && (
                    <div className="tab-content">
                        {storyPoints.items.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">✅</span>
                                <p>No pending work items</p>
                            </div>
                        ) : (
                            storyPoints.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="perf-item"
                                    onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                                >
                                    <div className="item-header">
                                        <span className="item-title">{item.title}</span>
                                        <span className="sp-badge">{item.storyPoints} SP</span>
                                    </div>
                                    <div className="item-meta">
                                        <span className="work-item-type">{item.type}</span>
                                        <span className="work-item-state">{item.state}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .performance-card {
                    position: relative;
                }

                .perf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .perf-header h2 {
                    margin: 0;
                }

                .user-badge {
                    font-size: 12px;
                    padding: 4px 10px;
                    background: rgba(59, 130, 246, 0.15);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 12px;
                    color: #60a5fa;
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

                .schedule-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    margin-left: auto;
                }

                .schedule-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                }

                .schedule-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .schedule-btn:active:not(:disabled) {
                    transform: translateY(0);
                }

                .story-points-banner {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    border-radius: 12px;
                    margin-bottom: 16px;
                }

                .sp-icon {
                    color: #f59e0b;
                }

                .sp-info {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .sp-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: #f59e0b;
                }

                .sp-label {
                    font-size: 12px;
                    color: #94a3b8;
                }

                .sp-count {
                    font-size: 12px;
                    color: #64748b;
                    padding: 4px 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                }

                .perf-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding-bottom: 12px;
                }

                .tab-btn {
                    padding: 8px 16px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #94a3b8;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .tab-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: #e2e8f0;
                }

                .tab-btn.active {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .perf-scroll {
                    max-height: 350px;
                    overflow-y: auto;
                    padding-right: 6px;
                    scrollbar-width: thin;
                    scrollbar-color: #3b82f6 #1a1e2e;
                }

                .perf-scroll::-webkit-scrollbar {
                    width: 6px;
                }

                .perf-scroll::-webkit-scrollbar-thumb {
                    background-color: #3b82f6;
                    border-radius: 10px;
                }

                .perf-scroll::-webkit-scrollbar-track {
                    background: #1a1e2e;
                }

                .tab-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .perf-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .perf-item:hover {
                    transform: translateY(-2px);
                    border-color: rgba(59, 130, 246, 0.4);
                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
                }

                .perf-item.selected {
                    border-color: rgba(99, 102, 241, 0.6);
                    background: rgba(99, 102, 241, 0.1);
                }

                .item-content {
                    flex: 1;
                    min-width: 0;
                }

                .item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 8px;
                }

                .item-title {
                    font-size: 14px;
                    font-weight: 500;
                    color: #e2e8f0;
                    line-height: 1.4;
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .commit-hash {
                    font-family: 'Fira Code', 'Consolas', monospace;
                    font-size: 12px;
                    padding: 2px 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    color: #94a3b8;
                }

                .commit-message {
                    font-size: 13px;
                    color: #e2e8f0;
                    margin-bottom: 8px;
                    line-height: 1.4;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .source-badge {
                    font-size: 10px;
                    padding: 3px 8px;
                    border-radius: 12px;
                    color: white;
                    font-weight: 500;
                    white-space: nowrap;
                }

                .sp-badge {
                    font-size: 11px;
                    padding: 3px 8px;
                    background: rgba(245, 158, 11, 0.2);
                    border: 1px solid rgba(245, 158, 11, 0.4);
                    border-radius: 12px;
                    color: #f59e0b;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .item-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    font-size: 11px;
                    color: #64748b;
                }

                .reviewers-list {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-top: 8px;
                    flex-wrap: wrap;
                }

                .reviewers-label {
                    font-size: 11px;
                    color: #64748b;
                }

                .reviewer-badge {
                    font-size: 10px;
                    padding: 2px 6px;
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 4px;
                    color: #94a3b8;
                }

                .reviewer-more {
                    font-size: 10px;
                    color: #64748b;
                }

                .schedule-pr-btn {
                    padding: 6px;
                    background: rgba(99, 102, 241, 0.2);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: 6px;
                    color: #818cf8;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }

                .schedule-pr-btn:hover {
                    background: rgba(99, 102, 241, 0.3);
                    border-color: rgba(99, 102, 241, 0.5);
                    color: #a5b4fc;
                }

                .work-item-type {
                    padding: 2px 6px;
                    background: rgba(99, 102, 241, 0.2);
                    border-radius: 4px;
                    color: #818cf8;
                }

                .work-item-state {
                    padding: 2px 6px;
                    background: rgba(34, 197, 94, 0.2);
                    border-radius: 4px;
                    color: #22c55e;
                }

                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    color: #64748b;
                }

                .empty-icon {
                    font-size: 32px;
                    margin-bottom: 12px;
                }

                .empty-state p {
                    margin: 0;
                    font-size: 14px;
                }

                @media (max-width: 600px) {
                    .perf-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .schedule-btn {
                        margin-left: 0;
                    }

                    .perf-tabs {
                        flex-wrap: wrap;
                    }

                    .tab-btn {
                        flex: 1;
                        min-width: fit-content;
                        text-align: center;
                    }

                    .story-points-banner {
                        flex-wrap: wrap;
                    }
                }
            `}</style>
        </div>
    );
};

export default PerformanceCard;
