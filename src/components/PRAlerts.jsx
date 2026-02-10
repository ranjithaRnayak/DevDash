import React, { useEffect, useState, useRef } from 'react';
import { devOpsAPI } from '../api/backendClient';

const PRAlerts = ({ dashboardId, repos }) => {
    const [allPRs, setAllPRs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchPRs = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await devOpsAPI.getPullRequests('open');
                const prs = response.data || [];

                // Include all PRs (including drafts), sort by created date
                const activePRs = prs
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setAllPRs(activePRs);
            } catch (err) {
                console.error('Failed to fetch pull requests:', err);
                setError(err.message || 'Failed to fetch PRs');
                setAllPRs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchPRs();
    }, []);

    // Handle PR row click - open the actual PR URL
    const handlePRClick = (pr, e) => {
        // Don't open if clicking on overdue/draft label
        if (e.target.classList.contains('warning-label') || e.target.classList.contains('draft-label')) return;

        const prUrl = getPRUrl(pr);
        if (prUrl) {
            window.open(prUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Get the correct PR URL based on source
    const getPRUrl = (pr) => {
        // Prefer webUrl (the actual PR page URL from API)
        if (pr.webUrl && (pr.webUrl.startsWith('http://') || pr.webUrl.startsWith('https://'))) {
            return pr.webUrl;
        }

        // Fallback to url if webUrl not available
        if (pr.url && (pr.url.startsWith('http://') || pr.url.startsWith('https://'))) {
            return pr.url;
        }

        // Construct URL based on source as last resort
        if (pr.source === 'GitHub' && pr.repository) {
            return `https://github.com/${pr.repository}/pull/${pr.id}`;
        }

        if (pr.source === 'AzureDevOps' && pr.repository) {
            return `https://dev.azure.com/_git/${pr.repository}/pullrequest/${pr.id}`;
        }

        return pr.url || pr.webUrl || null;
    };

    // Handle overdue/draft label click - send email reminder
    const handleLabelClick = (e, pr, reviewerEmails, authorEmail, subject, body) => {
        e.preventDefault();
        e.stopPropagation();

        // Build mailto with To (reviewers) and CC (author)
        const toList = reviewerEmails || '';
        const ccList = authorEmail || '';

        let mailtoUrl = 'mailto:';
        if (toList) {
            mailtoUrl += toList;
        }

        const params = [];
        if (ccList) {
            params.push(`cc=${encodeURIComponent(ccList)}`);
        }
        params.push(`subject=${encodeURIComponent(subject)}`);
        params.push(`body=${body}`);

        if (params.length > 0) {
            mailtoUrl += '?' + params.join('&');
        }

        window.location.href = mailtoUrl;
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

    if (error) {
        return (
            <div className="pr-alerts-card">
                <h2>Active Pull Requests</h2>
                <div className="error-state" style={{ color: '#f87171', padding: '1rem' }}>
                    <p>Error: {error}</p>
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
                        const isDraft = pr.isDraft === true || pr.status === 'Draft';

                        const reviewerEmails = pr.reviewers
                            ?.map(r => r.uniqueName || r.email || '')
                            .filter(Boolean)
                            .join(',') || '';

                        const authorEmail = pr.authorEmail || pr.createdBy?.uniqueName || pr.createdBy?.email || '';

                        const subject = isDraft
                            ? `Reminder: Draft PR Ready for Review - ${pr.title}`
                            : `Reminder: Review Pending PR - ${pr.title}`;
                        const body = `Hi Team,%0D%0A%0D%0A${isDraft ? 'This draft PR may need attention:' : 'This PR is pending for over 48 hours:'}%0D%0A${pr.title}%0D%0A${getPRUrl(pr) || ''}%0D%0APlease review it when you get a chance.%0D%0A%0D%0AThanks,%0D%0ADevDash`;

                        // Determine shadow color based on status
                        const getRowShadow = () => {
                            if (isDraft) {
                                return '0 2px 8px rgba(245, 158, 11, 0.4)'; // Yellow shadow for draft
                            } else if (isOverdue) {
                                return '0 2px 8px rgba(239, 68, 68, 0.4)'; // Red shadow for overdue
                            }
                            return '0 2px 8px rgba(59, 130, 246, 0.3)'; // Blue shadow for normal
                        };

                        return (
                            <div
                                key={`${pr.source}-${pr.id}-${index}`}
                                className={`pr-row ${isOverdue ? 'overdue' : ''} ${isDraft ? 'draft' : ''}`}
                                onClick={(e) => handlePRClick(pr, e)}
                                style={{
                                    cursor: 'pointer',
                                    borderColor: isDraft ? 'rgba(245, 158, 11, 0.5)' : isOverdue ? 'rgba(239, 68, 68, 0.5)' : undefined,
                                    boxShadow: getRowShadow()
                                }}
                            >
                                <div className="pr-header">
                                    <strong className="pr-title-link">
                                        {pr.title}
                                    </strong>

                                    <div className="pr-labels-container">
                                        {isDraft && (
                                            <span
                                                className="draft-label"
                                                onClick={(e) => handleLabelClick(e, pr, reviewerEmails, authorEmail, subject, body)}
                                                title="Click to send reminder email"
                                                style={{
                                                    cursor: 'pointer',
                                                    backgroundColor: 'rgba(245, 158, 11, 0.25)',
                                                    color: '#f59e0b',
                                                    border: '2px solid rgba(245, 158, 11, 0.6)',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    letterSpacing: '0.5px'
                                                }}
                                            >
                                                DRAFT
                                            </span>
                                        )}
                                        {isOverdue && (
                                            <span
                                                className="warning-label"
                                                onClick={(e) => handleLabelClick(e, pr, reviewerEmails, authorEmail, subject, body)}
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
