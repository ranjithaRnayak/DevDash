// components/PerformanceCard.jsx - Personal Developer Dashboard
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const PerformanceCard = () => {
    const { user } = useAuth();
    const [draftPRs, setDraftPRs] = useState([]);
    const [recentCommits, setRecentCommits] = useState([]);
    const [storyPoints, setStoryPoints] = useState({ notStarted: 0, total: 0, items: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('drafts');

    // Configuration from environment
    const config = {
        // User identification
        userEmail: import.meta.env.VITE_USER_EMAIL || user?.email || '',
        azdoUserId: import.meta.env.VITE_AZDO_USER_ID || import.meta.env.VITE_USER_EMAIL || user?.email || '',
        githubUsername: import.meta.env.VITE_GITHUB_USERNAME || user?.githubUsername || '',

        // Azure DevOps
        azdoToken: import.meta.env.VITE_AZDO_PAT,
        azdoOrg: import.meta.env.VITE_AZDO_ORG_URL,
        azdoProject: import.meta.env.VITE_AZDO_PROJECT,
        azdoRepos: import.meta.env.VITE_AZDO_REPOS?.split(',') || [],

        // GitHub
        githubToken: import.meta.env.VITE_GITHUB_PAT,
        githubApiUrl: import.meta.env.VITE_GITHUB_API_URL || 'https://api.github.com',
        githubOwner: import.meta.env.VITE_GITHUB_OWNER,
        githubRepo: import.meta.env.VITE_GITHUB_REPO,

        // Teams
        teamsTenantId: import.meta.env.VITE_TEAMS_TENANT_ID || import.meta.env.VITE_ENTRA_TENANT_ID,
    };

    const headers = {
        github: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: 'application/vnd.github+json',
        },
        azure: {
            Authorization: `Basic ${btoa(':' + config.azdoToken)}`,
            'Content-Type': 'application/json',
        },
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchDraftPRs(),
            fetchRecentCommits(),
            fetchStoryPoints(),
        ]);
        setLoading(false);
    };

    // Fetch Draft PRs from both Azure DevOps and GitHub
    const fetchDraftPRs = async () => {
        const drafts = [];

        // Azure DevOps Draft PRs
        for (const repo of config.azdoRepos) {
            try {
                const res = await axios.get(
                    `${config.azdoOrg}/${config.azdoProject}/_apis/git/repositories/${repo}/pullrequests?searchCriteria.status=active&searchCriteria.creatorId=${encodeURIComponent(config.azdoUserId)}&$top=50&api-version=7.0`,
                    { headers: headers.azure }
                );
                const userDrafts = res.data.value.filter((pr) => pr.isDraft);
                userDrafts.forEach((pr) =>
                    drafts.push({
                        id: pr.pullRequestId,
                        title: pr.title,
                        repoName: pr.repository?.name,
                        url: pr.url?.replace('_apis/git/repositories', '_git').replace('/pullRequests/', '/pullrequest/') || `${config.azdoOrg}/${config.azdoProject}/_git/${repo}/pullrequest/${pr.pullRequestId}`,
                        createdAt: pr.creationDate,
                        source: 'Azure',
                        targetBranch: pr.targetRefName?.replace('refs/heads/', ''),
                    })
                );
            } catch (err) {
                console.warn('Azure Draft PR error:', err);
            }
        }

        // GitHub Draft PRs
        if (config.githubToken && config.githubOwner && config.githubRepo) {
            try {
                const res = await axios.get(
                    `${config.githubApiUrl}/repos/${config.githubOwner}/${config.githubRepo}/pulls?state=open`,
                    { headers: headers.github }
                );
                const userDrafts = res.data.filter(
                    (pr) => pr.draft && pr.user?.login?.toLowerCase() === config.githubUsername?.toLowerCase()
                );
                userDrafts.forEach((pr) =>
                    drafts.push({
                        id: pr.number,
                        title: pr.title,
                        repoName: config.githubRepo,
                        url: pr.html_url,
                        createdAt: pr.created_at,
                        source: 'GitHub',
                        targetBranch: pr.base?.ref,
                    })
                );
            } catch (err) {
                console.warn('GitHub Draft PR error:', err);
            }
        }

        // Sort by created date (newest first)
        drafts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setDraftPRs(drafts);
    };

    // Fetch Recent Commits (Check-ins)
    const fetchRecentCommits = async () => {
        const commits = [];
        const since = new Date();
        since.setDate(since.getDate() - 7); // Last 7 days

        // Azure DevOps Commits
        for (const repo of config.azdoRepos) {
            try {
                const res = await axios.get(
                    `${config.azdoOrg}/${config.azdoProject}/_apis/git/repositories/${repo}/commits?searchCriteria.author=${encodeURIComponent(config.azdoUserId)}&searchCriteria.fromDate=${since.toISOString()}&$top=10&api-version=7.0`,
                    { headers: headers.azure }
                );
                res.data.value?.forEach((commit) =>
                    commits.push({
                        id: commit.commitId?.substring(0, 7),
                        message: commit.comment?.split('\n')[0] || 'No message',
                        repoName: repo,
                        url: `${config.azdoOrg}/${config.azdoProject}/_git/${repo}/commit/${commit.commitId}`,
                        date: commit.committer?.date || commit.author?.date,
                        source: 'Azure',
                    })
                );
            } catch (err) {
                console.warn('Azure commits error:', err);
            }
        }

        // GitHub Commits
        if (config.githubToken && config.githubOwner && config.githubRepo && config.githubUsername) {
            try {
                const res = await axios.get(
                    `${config.githubApiUrl}/repos/${config.githubOwner}/${config.githubRepo}/commits?author=${config.githubUsername}&since=${since.toISOString()}&per_page=10`,
                    { headers: headers.github }
                );
                res.data.forEach((commit) =>
                    commits.push({
                        id: commit.sha?.substring(0, 7),
                        message: commit.commit?.message?.split('\n')[0] || 'No message',
                        repoName: config.githubRepo,
                        url: commit.html_url,
                        date: commit.commit?.committer?.date || commit.commit?.author?.date,
                        source: 'GitHub',
                    })
                );
            } catch (err) {
                console.warn('GitHub commits error:', err);
            }
        }

        // Sort by date (newest first)
        commits.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentCommits(commits.slice(0, 15)); // Limit to 15 most recent
    };

    // Fetch Story Points not started in current sprint
    const fetchStoryPoints = async () => {
        if (!config.azdoToken || !config.azdoOrg || !config.azdoProject) {
            setStoryPoints({ notStarted: 0, total: 0, items: [] });
            return;
        }

        try {
            // WIQL query for user's work items in current sprint that are not started
            const wiqlQuery = {
                query: `SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints]
                        FROM WorkItems
                        WHERE [System.TeamProject] = '${config.azdoProject}'
                        AND [System.AssignedTo] = '${config.azdoUserId}'
                        AND [System.WorkItemType] IN ('User Story', 'Product Backlog Item', 'Task')
                        AND [System.IterationPath] UNDER @CurrentIteration
                        AND [System.State] IN ('New', 'To Do', 'Approved')
                        ORDER BY [Microsoft.VSTS.Scheduling.StoryPoints] DESC`
            };

            const wiqlRes = await axios.post(
                `${config.azdoOrg}/${config.azdoProject}/_apis/wit/wiql?api-version=7.0`,
                wiqlQuery,
                { headers: headers.azure }
            );

            const workItemIds = wiqlRes.data.workItems?.map(wi => wi.id) || [];

            if (workItemIds.length === 0) {
                setStoryPoints({ notStarted: 0, total: 0, items: [] });
                return;
            }

            // Fetch work item details
            const detailsRes = await axios.get(
                `${config.azdoOrg}/${config.azdoProject}/_apis/wit/workitems?ids=${workItemIds.slice(0, 50).join(',')}&fields=System.Id,System.Title,System.State,Microsoft.VSTS.Scheduling.StoryPoints,System.WorkItemType&api-version=7.0`,
                { headers: headers.azure }
            );

            const items = detailsRes.data.value?.map(wi => ({
                id: wi.id,
                title: wi.fields['System.Title'],
                state: wi.fields['System.State'],
                storyPoints: wi.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || 0,
                type: wi.fields['System.WorkItemType'],
                url: `${config.azdoOrg}/${config.azdoProject}/_workitems/edit/${wi.id}`,
            })) || [];

            const totalPoints = items.reduce((sum, item) => sum + item.storyPoints, 0);

            setStoryPoints({
                notStarted: totalPoints,
                total: items.length,
                items: items.slice(0, 5), // Show top 5
            });
        } catch (err) {
            console.warn('Story points error:', err);
            setStoryPoints({ notStarted: 0, total: 0, items: [] });
        }
    };

    // Schedule Code Review via Teams
    const handleScheduleCodeReview = () => {
        // Create Teams meeting deep link
        const subject = encodeURIComponent('Code Review Session');
        const content = encodeURIComponent('Code review meeting scheduled via DevDash');

        // Teams meeting creation URL
        // Option 1: Teams calendar deep link
        const teamsUrl = `https://teams.microsoft.com/l/meeting/new?subject=${subject}&content=${content}`;

        window.open(teamsUrl, '_blank', 'noopener,noreferrer');
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
                <button className="schedule-btn" onClick={handleScheduleCodeReview}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Schedule Code Review
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
                    <span className="sp-label">Story Points Not Started</span>
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
                            recentCommits.map((commit) => (
                                <div
                                    key={`${commit.source}-${commit.id}`}
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
                }

                .schedule-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
                }

                .schedule-btn:active {
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
