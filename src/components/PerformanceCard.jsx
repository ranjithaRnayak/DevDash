import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PerformanceCard = () => {
    const [draftPRs, setDraftPRs] = useState([]);
    const [recentCommits, setRecentCommits] = useState([]);
    const [storyPoints, setStoryPoints] = useState({ notStarted: 0, total: 0, items: [] });
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('drafts');
    const [schedulingMeeting, setSchedulingMeeting] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                // Fetch all data from backend
                const response = await axios.get(`${API_BASE_URL}/performance/dashboard`);
                const data = response.data || {};

                setCurrentUser(data.user);
                setDraftPRs(data.draftPRs || []);
                setRecentCommits(data.recentCommits || []);
                setStoryPoints(data.storyPoints || { notStarted: 0, total: 0, items: [] });
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
                // Try individual endpoints as fallback
                try {
                    const [draftsRes, commitsRes, pointsRes] = await Promise.allSettled([
                        axios.get(`${API_BASE_URL}/performance/draft-prs`),
                        axios.get(`${API_BASE_URL}/performance/commits`),
                        axios.get(`${API_BASE_URL}/performance/story-points`),
                    ]);

                    if (draftsRes.status === 'fulfilled') setDraftPRs(draftsRes.value.data || []);
                    if (commitsRes.status === 'fulfilled') setRecentCommits(commitsRes.value.data || []);
                    if (pointsRes.status === 'fulfilled') setStoryPoints(pointsRes.value.data || { notStarted: 0, total: 0, items: [] });
                } catch (fallbackErr) {
                    console.error('Fallback fetch failed:', fallbackErr);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleScheduleCodeReview = async (pr = null) => {
        if (!pr) {
            // No PR selected - open Teams meeting creation directly
            const teamsUrl = 'https://teams.microsoft.com/l/meeting/new?subject=' +
                encodeURIComponent('Code Review Session');
            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        setSchedulingMeeting(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/performance/schedule-review`, {
                prId: pr.id,
                prTitle: pr.title,
                prUrl: pr.url,
                repoName: pr.repoName,
                reviewers: pr.reviewers?.map(r => ({
                    displayName: r.displayName,
                    email: r.email,
                })) || [],
            });

            const result = response.data;

            if (result.success && result.meetingUrl) {
                window.open(result.meetingUrl, '_blank', 'noopener,noreferrer');
            } else {
                // Fallback to deep link
                const subject = encodeURIComponent(`Code Review – PR #${pr.id}`);
                const body = encodeURIComponent(`Code review for: ${pr.title}\nPR Link: ${pr.url}`);
                const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${body}`;
                window.open(teamsUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('Failed to schedule meeting:', err);
            // Fallback to Teams deep link
            const subject = encodeURIComponent(`Code Review – PR #${pr.id}`);
            const body = encodeURIComponent(`Code review for: ${pr.title}\nPR Link: ${pr.url}`);
            const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${body}`;
            window.open(teamsUrl, '_blank', 'noopener,noreferrer');
        } finally {
            setSchedulingMeeting(false);
        }
    };

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
                                    className="perf-item"
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
        </div>
    );
};

export default PerformanceCard;
