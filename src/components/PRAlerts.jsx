import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PRAlerts = () => {
    const [allPRs, setAllPRs] = useState([]);

    useEffect(() => {
        const fetchPRs = async () => {
            const githubToken = import.meta.env.VITE_GITHUB_PAT;
            const azureToken = import.meta.env.VITE_AZDO_PAT;
            const azureOrg = import.meta.env.VITE_AZDO_ORG_URL;
            const azureProject = import.meta.env.VITE_AZDO_PROJECT;
            const azureRepos = import.meta.env.VITE_AZDO_REPOS?.split(',');
            const githubOrg = import.meta.env.VITE_GITHUB_OWNER;

            const headers = {
                github: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github+json',
                },
                azure: {
                    Authorization: `Basic ${btoa(':' + azureToken)}`,
                },
            };

            const combinedPRs = [];

            // 🔷 Azure PRs
            for (const repo of azureRepos) {
                try {
                    const res = await axios.get(
                        `${azureOrg}/${azureProject}/_apis/git/repositories/${repo}/pullrequests?searchCriteria.status=active&$top=50&api-version=7.0`,
                        { headers: headers.azure }
                    );
                    const published = res.data.value.filter((pr) => !pr.isDraft);
                    published.forEach((pr) =>
                        combinedPRs.push({
                            title: pr.title,
                            repoName: pr.repository?.name,
                            author: pr.createdBy?.displayName,
                            createdAt: pr.creationDate,
                            source: 'Azure',
                        })
                    );
                } catch (err) {
                    console.warn('Azure PR error:', err);
                }
            }

            // 🐙 GitHub PRs
            try {
                const res = await axios.get(
                    githubOrg,
                    { headers: headers.github }
                );
                res.data.forEach((pr) =>
                    combinedPRs.push({
                        title: pr.title,
                        repoName: import.meta.env.VITE_GITHUB_REPO,
                        author: pr.user?.login,
                        createdAt: pr.created_at,
                        source: 'GitHub',
                    })
                );
            } catch (err) {
                console.warn('GitHub PR error:', err);
            }

            // 🔄 Sort by createdAt DESC
            const sorted = combinedPRs.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
            setAllPRs(sorted);
        };

        fetchPRs();
    }, []);

    return (
        <div className="pr-alerts-card">
            <h2>🧵 Active Pull Requests</h2>
            <div className="pr-scroll">
                {allPRs.length === 0 ? (
                    <p>No Active PRs found.</p>
                ) : (
                    allPRs.map((pr, index) => {
                        const created = new Date(pr.createdAt);
                        const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);
                        const isOverdue = hoursOpen > 48;
                        const envApprovers = import.meta.env.VITE_PR_APPROVERS || '';
                        const reviewers = pr.reviewers?.map(r =>
                            r.uniqueName || r.email || r.login
                        ) || envApprovers.split(',').filter(Boolean);
                        const envTeam = import.meta.env.VITE_PR_TEAM;
                        const fullEmailList = reviewers.join(',');
                        const tooltipPreview =
                            reviewers.length > 2
                                ? `${reviewers.slice(0, 2).join(', ')}, and ${reviewers.length - 2} more`
                                : reviewers.join(',');

                        const subject = `Reminder: Review Pending PR - ${pr.title}`;
                        const body = `Hi Team,%0D%0A%0D%0AThis PR is pending for over 48 hours:%0D%0A${pr.title}%0D%0A${pr.url || ''}%0D%0APlease review it when you get a chance.%0D%0A%0D%0AThanks,%0D%0ADevDash`;

                        return (
                            <div
                                key={index}
                                className={`pr-row ${isOverdue ? 'overdue' : ''}`}
                                title={isOverdue ? `Click to remind: ${tooltipPreview}` : 'PR under review'}
                                style={{ cursor: isOverdue ? 'pointer' : 'default' }}
                                onClick={() => {
                                    if (isOverdue) {
                                        window.location.href = `mailto:${fullEmailList}?cc=${envTeam}&subject=${encodeURIComponent(subject)}&body=${body}`;
                                    }
                                }}
                            >
                                <strong>{pr.title}</strong>
                                <p>📁 Repo: <span>{pr.repoName}</span></p>
                                <p>👤 {pr.author} | ⏱ {created.toLocaleString()}</p>
                                <p className="source-label">{pr.source}</p>
                                {isOverdue && (
                                    <span className="warning-label">🔴 Over 48 hrs</span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
export default PRAlerts;