import React, { useEffect, useState, useRef } from 'react';
import { devOpsAPI } from '../api/backendClient';

const PipelineStatus = ({ dashboardId, pipelines }) => {
    const [builds, setBuilds] = useState([]);
    const [loading, setLoading] = useState(true);
    const hasFetched = useRef(false);

    // Mock data for when API is unavailable
    const getMockBuilds = () => [
        {
            id: 1,
            pipelineName: 'CI-Build',
            buildNumber: '20240210.1',
            result: 'Succeeded',
            status: 'Completed',
            sourceBranch: 'refs/heads/main',
            finishTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            url: 'https://dev.azure.com/org/project/_build/results?buildId=1'
        },
        {
            id: 2,
            pipelineName: 'CD-Deploy-Dev',
            buildNumber: '20240210.2',
            result: 'Failed',
            status: 'Completed',
            sourceBranch: 'refs/heads/feature/auth',
            finishTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            url: 'https://dev.azure.com/org/project/_build/results?buildId=2'
        },
        {
            id: 3,
            pipelineName: 'CI-Build',
            buildNumber: '20240210.3',
            result: 'InProgress',
            status: 'InProgress',
            sourceBranch: 'refs/heads/develop',
            startTime: new Date().toISOString(),
            url: 'https://dev.azure.com/org/project/_build/results?buildId=3'
        }
    ];

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchBuilds = async () => {
            setLoading(true);
            try {
                const response = await devOpsAPI.getBuilds(20);
                setBuilds(response.data || []);
            } catch (error) {
                console.error('Failed to fetch pipeline builds:', error);
                // Use mock data when API fails
                setBuilds(getMockBuilds());
            } finally {
                setLoading(false);
            }
        };

        fetchBuilds();
    }, []);

    const getStatusClass = (result) => {
        switch (result?.toLowerCase()) {
            case 'succeeded': return 'badge badge-success';
            case 'failed': return 'badge badge-danger';
            case 'partiallysucceeded': return 'badge badge-warning';
            case 'inprogress': return 'badge badge-warning';
            default: return 'badge';
        }
    };

    const formatStatus = (result, status) => {
        if (!result) return status || 'N/A';

        if (result.toLowerCase() === 'partiallysucceeded') {
            return 'Partially Succeeded';
        }

        return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const handleRowClick = (url) => {
        if (url) {
            window.open(url, '_blank');
        }
    };

    if (loading) {
        return (
            <div className="pipeline-alerts-card">
                <h2>Pipeline Builds</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading builds...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pipeline-alerts-card">
            <h2>Pipeline Builds</h2>
            {builds.length === 0 && <p>No builds found.</p>}

            <div className="table-header">
                <div>Build Name</div>
                <div>Status</div>
                <div>Completed At</div>
            </div>

            <div className="pipeline-scroll">
                {builds.map((b) => {
                    const completedTime = formatDateTime(b.finishTime || b.startTime || b.queueTime);
                    const branchInfo = b.sourceBranch?.replace('refs/heads/', '') || 'Unknown branch';
                    const buildInfo = `${b.buildNumber || 'N/A'}`;
                    const tooltipText = `Branch: ${branchInfo} | Build: ${buildInfo}`;

                    return (
                        <div
                            className="table-row pipeline-row-clickable"
                            key={b.id}
                            title={tooltipText}
                            onClick={() => handleRowClick(b.url)}
                        >
                            <div className="pipeline-title">{b.pipelineName || 'N/A'}</div>
                            <div>
                                <span className={getStatusClass(b.result)}>
                                    {formatStatus(b.result, b.status)}
                                </span>
                            </div>
                            <div className="pipeline-datetime">{completedTime}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PipelineStatus;
