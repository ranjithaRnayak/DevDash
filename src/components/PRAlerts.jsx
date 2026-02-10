import React, { useEffect, useState, useRef } from 'react';
import { devOpsAPI } from '../api/backendClient';

const PRAlerts = ({ dashboardId, repos }) => {
    const [allPRs, setAllPRs] = useState([]);
    const [loading, setLoading] = useState(true);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchPRs = async () => {
            setLoading(true);
            try {
                const response = await devOpsAPI.getPullRequests('open');
                const prs = response.data || [];

                const activePRs = prs
                    .filter(pr => pr.status !== 'Draft')
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setAllPRs(activePRs);
            } catch (error) {
                console.error('Failed to fetch pull requests:', error);
                // Use mock data when API fails
                setAllPRs(getMockPRs());
            } finally {
                setLoading(false);
            }
        };

        fetchPRs();
    }, []);

    // Mock data for when API is unavailable
    const getMockPRs = () => [
        {
            id: 1,
            title: 'Feature: Add user authentication',
            author: 'john.doe',
            sourceBranch: 'refs/heads/feature/auth',
            targetBranch: 'refs/heads/main',
            status: 'Open',
            source: 'GitHub',
            createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72 hours ago (overdue)
            url: 'https://github.com/org/repo/pull/1',
            reviewers: [{ uniqueName: 'reviewer@company.com', email: 'reviewer@company.com' }]
        },
        {
            id: 2,
            title: 'Fix: Resolve login redirect issue',
            author: 'jane.smith',
            sourceBranch: 'refs/heads/bugfix/login',
            targetBranch: 'refs/heads/main',
            status: 'Open',
            source: 'AzureDevOps',
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
            url: 'https://dev.azure.com/org/project/_git/repo/pullrequest/2',
            reviewers: []
        }
    ];

    // Handle PR row click - open the actual PR URL
    const handlePRClick = (pr, e) => {
        // Don't open if clicking on overdue label
        if (e.target.classList.contains('warning-label')) return;

        const prUrl = getPRUrl(pr);
        if (prUrl) {
            window.open(prUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Get the correct PR URL based on source
    const getPRUrl = (pr) => {
        // If url is already set and valid, use it
        if (pr.url && (pr.url.startsWith('http://') || pr.url.startsWith('https://'))) {
            return pr.url;
        }

        // Construct URL based on source
        if (pr.source === 'GitHub' && pr.repository) {
            return `https://github.com/${pr.repository}/pull/${pr.id}`;
        }

        if (pr.source === 'AzureDevOps' && pr.repository) {
            return `https://dev.azure.com/_git/${pr.repository}/pullrequest/${pr.id}`;
        }

        return pr.url || null;
    };

    // Handle overdue label click - send email reminder
    const handleOverdueClick = (e, pr, reviewerEmails, subject, body) => {
        e.preventDefault();
        e.stopPropagation();

        if (reviewerEmails) {
            window.location.href = `mailto:${reviewerEmails}?subject=${encodeURIComponent(subject)}&body=${body}`;
        } else {
            // If no reviewers, open a generic email
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
        }
    };

    if (loading) {
        return (
            <div className="pr-alerts-card">
                <h2>Active Pull Requests</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading PRs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pr-alerts-card">
            <h2>Active Pull Requests</h2>
            <div className="pr-scroll">
                {allPRs.length === 0 ? (
                    <p>No Active PRs found.</p>
                ) : (
                    allPRs.map((pr, index) => {
                        const created = new Date(pr.createdAt);
                        const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);
                        const isOverdue = hoursOpen > 48;
                        const isDraft = pr.status === 'Draft';

                        const reviewerEmails = pr.reviewers
                            ?.map(r => r.uniqueName || r.email || '')
                            .filter(Boolean)
                            .join(',') || '';

                        const subject = isDraft
                            ? `Reminder: Draft PR Ready for Review - ${pr.title}`
                            : `Reminder: Review Pending PR - ${pr.title}`;
                        const body = `Hi Team,%0D%0A%0D%0A${isDraft ? 'This draft PR may need attention:' : 'This PR is pending for over 48 hours:'}%0D%0A${pr.title}%0D%0A${getPRUrl(pr) || ''}%0D%0APlease review it when you get a chance.%0D%0A%0D%0AThanks,%0D%0ADevDash`;

                        return (
                            <div
                                key={`${pr.source}-${pr.id}-${index}`}
                                className={`pr-row ${isOverdue ? 'overdue' : ''} ${isDraft ? 'draft' : ''}`}
                                onClick={(e) => handlePRClick(pr, e)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="pr-header">
                                    <strong className="pr-title-link">
                                        {pr.title}
                                    </strong>

                                    <div className="pr-labels-container">
                                        <span className="source-label">
                                            {pr.source === 'AzureDevOps' ? 'Azure' : pr.source}
                                        </span>
                                        {isDraft && (
                                            <span className="draft-label">Draft</span>
                                        )}
                                        {isOverdue && (
                                            <span
                                                className="warning-label"
                                                onClick={(e) => handleOverdueClick(e, pr, reviewerEmails, subject, body)}
                                                title="Click to send reminder email"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                Over 48 hrs
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="pr-details">
                                    <span className="pr-item">{pr.sourceBranch?.split('/').pop() || 'Unknown'}</span>
                                    <span className="pr-item">{pr.author}</span>
                                    <span className="pr-item">{created.toLocaleDateString()} {created.toLocaleTimeString()}</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PRAlerts;
