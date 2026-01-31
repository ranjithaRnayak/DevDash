import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PRAlerts = () => {
    const [allPRs, setAllPRs] = useState([]);

    useEffect(() => {
        const fetchPRs = async () => {
            try {
                // Fetch PRs from backend API (tokens handled server-side)
                const response = await axios.get(`${API_BASE_URL}/devops/pullrequests?status=open`);
                const prs = response.data || [];

                // Filter out drafts and sort by created date
                const activePRs = prs
                    .filter(pr => pr.status !== 'Draft')
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                setAllPRs(activePRs);
            } catch (error) {
                console.error('Failed to fetch pull requests:', error);
                setAllPRs([]);
            }
        };

        fetchPRs();
    }, []);

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
                        const shouldBeClickableForEmail = isOverdue || isDraft;

                        const reviewerEmails = pr.reviewers
                            ?.map(r => r.uniqueName || r.email || '')
                            .filter(Boolean)
                            .join(',') || '';

                        const subject = isDraft
                            ? `Reminder: Draft PR Ready for Review - ${pr.title}`
                            : `Reminder: Review Pending PR - ${pr.title}`;
                        const body = `Hi Team,%0D%0A%0D%0A${isDraft ? 'This draft PR may need attention:' : 'This PR is pending for over 48 hours:'}%0D%0A${pr.title}%0D%0A${pr.url || ''}%0D%0APlease review it when you get a chance.%0D%0A%0D%0AThanks,%0D%0ADevDash`;

                        const handleEmailClick = (e) => {
                            e.stopPropagation();
                            if (shouldBeClickableForEmail && reviewerEmails) {
                                window.location.href = `mailto:${reviewerEmails}?subject=${encodeURIComponent(subject)}&body=${body}`;
                            }
                        };

                        return (
                            <div
                                key={`${pr.source}-${pr.id}-${index}`}
                                className={`pr-row ${isOverdue ? 'overdue' : ''} ${isDraft ? 'draft' : ''}`}
                                onClick={() => window.open(pr.url, '_blank')}
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
                                                onClick={handleEmailClick}
                                                title={shouldBeClickableForEmail ? 'Click to send reminder' : ''}
                                                style={{ cursor: shouldBeClickableForEmail ? 'pointer' : 'default' }}
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
