import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const PipelineStatus = () => {
    const [builds, setBuilds] = useState([]);

    useEffect(() => {
        const fetchBuilds = async () => {
            try {
                // Fetch builds from backend API (tokens handled server-side)
                const response = await axios.get(`${API_BASE_URL}/devops/builds?count=20`);
                setBuilds(response.data || []);
            } catch (error) {
                console.error('Failed to fetch pipeline builds:', error);
                setBuilds([]);
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

    return (
        <div className="pipeline-alerts-card">
            <h2>Pipeline Builds</h2>
            {builds.length === 0 && <p>Loading builds...</p>}

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
