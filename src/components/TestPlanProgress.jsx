import React, { useEffect, useState, useRef } from 'react';
import { devOpsAPI } from '../api/backendClient';

const TestPlanProgress = () => {
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedPlans, setExpandedPlans] = useState({});
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchTestPlanProgress = async () => {
            console.log('[TestPlanProgress] Fetching test plan progress...');
            setLoading(true);
            try {
                const response = await devOpsAPI.getTestPlanProgress();
                console.log('[TestPlanProgress] API response:', response.data);
                setProgress(response.data);
            } catch (err) {
                console.error('[TestPlanProgress] Failed to fetch test plan progress:', err);
                console.error('[TestPlanProgress] Error details:', err.response?.status, err.response?.data);
                setError('Failed to load test plan progress');
            } finally {
                setLoading(false);
            }
        };

        fetchTestPlanProgress();
    }, []);

    const togglePlan = (planId) => {
        setExpandedPlans(prev => ({
            ...prev,
            [planId]: !prev[planId]
        }));
    };

    const getPassRateColor = (passRate) => {
        if (passRate >= 90) return '#22c55e';
        if (passRate >= 70) return '#eab308';
        if (passRate >= 50) return '#f97316';
        return '#ef4444';
    };

    const getOutcomeColor = (outcome) => {
        switch (outcome) {
            case 'passed': return '#22c55e';
            case 'failed': return '#ef4444';
            case 'blocked': return '#f97316';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="card test-plan-card">
                <h2>Test Plan Progress</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading test plan data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card test-plan-card">
                <h2>Test Plan Progress</h2>
                <div className="error-state" style={{ color: '#f87171', padding: '1rem' }}>
                    <p>Error: {error}</p>
                </div>
            </div>
        );
    }

    if (!progress || progress.plans.length === 0) {
        return (
            <div className="card test-plan-card">
                <h2>Test Plan Progress</h2>
                <div className="empty-state">
                    <span className="empty-icon">📋</span>
                    <p>No test plans configured</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card test-plan-card">
            <div className="test-plan-header">
                <h2>Test Plan Progress</h2>
                <span className="refresh-time">
                    Updated: {new Date(progress.generatedAt).toLocaleTimeString()}
                </span>
            </div>

            {/* Overall Summary */}
            <div className="test-summary-banner">
                <div className="summary-stat">
                    <span className="stat-value" style={{ color: getPassRateColor(progress.overallPassRate) }}>
                        {progress.overallPassRate}%
                    </span>
                    <span className="stat-label">Pass Rate</span>
                </div>
                <div className="summary-breakdown">
                    <div className="breakdown-item">
                        <span className="breakdown-dot" style={{ backgroundColor: '#22c55e' }}></span>
                        <span>{progress.passedCount} Passed</span>
                    </div>
                    <div className="breakdown-item">
                        <span className="breakdown-dot" style={{ backgroundColor: '#ef4444' }}></span>
                        <span>{progress.failedCount} Failed</span>
                    </div>
                    <div className="breakdown-item">
                        <span className="breakdown-dot" style={{ backgroundColor: '#f97316' }}></span>
                        <span>{progress.blockedCount} Blocked</span>
                    </div>
                    <div className="breakdown-item">
                        <span className="breakdown-dot" style={{ backgroundColor: '#6b7280' }}></span>
                        <span>{progress.notRunCount} Not Run</span>
                    </div>
                </div>
                <div className="total-tests">
                    <span className="total-value">{progress.totalTestCases}</span>
                    <span className="total-label">Total Tests</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="overall-progress-bar">
                {progress.totalTestCases > 0 && (
                    <>
                        <div
                            className="progress-segment passed"
                            style={{ width: `${(progress.passedCount / progress.totalTestCases) * 100}%` }}
                            title={`Passed: ${progress.passedCount}`}
                        ></div>
                        <div
                            className="progress-segment failed"
                            style={{ width: `${(progress.failedCount / progress.totalTestCases) * 100}%` }}
                            title={`Failed: ${progress.failedCount}`}
                        ></div>
                        <div
                            className="progress-segment blocked"
                            style={{ width: `${(progress.blockedCount / progress.totalTestCases) * 100}%` }}
                            title={`Blocked: ${progress.blockedCount}`}
                        ></div>
                        <div
                            className="progress-segment not-run"
                            style={{ width: `${(progress.notRunCount / progress.totalTestCases) * 100}%` }}
                            title={`Not Run: ${progress.notRunCount}`}
                        ></div>
                    </>
                )}
            </div>

            {/* Test Plans List */}
            <div className="test-plans-list">
                {progress.plans.map((plan) => (
                    <div key={plan.id} className="test-plan-item">
                        <div
                            className="plan-header"
                            onClick={() => togglePlan(plan.id)}
                        >
                            <div className="plan-info">
                                <svg
                                    className={`expand-icon ${expandedPlans[plan.id] ? 'expanded' : ''}`}
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                                <span className="plan-name">{plan.name}</span>
                                <span className="suite-count">({plan.suites.length} suites)</span>
                            </div>
                            <div className="plan-stats">
                                <span
                                    className="pass-rate-badge"
                                    style={{ backgroundColor: getPassRateColor(plan.passRate) }}
                                >
                                    {plan.passRate}%
                                </span>
                                <span className="test-count">{plan.totalTests} tests</span>
                                {plan.url && (
                                    <a
                                        href={plan.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="plan-link"
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open in Azure DevOps"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                            <polyline points="15 3 21 3 21 9"></polyline>
                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                        </svg>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Plan Progress Bar */}
                        <div className="plan-progress-bar">
                            {plan.totalTests > 0 && (
                                <>
                                    <div
                                        className="progress-segment passed"
                                        style={{ width: `${(plan.passedCount / plan.totalTests) * 100}%` }}
                                    ></div>
                                    <div
                                        className="progress-segment failed"
                                        style={{ width: `${(plan.failedCount / plan.totalTests) * 100}%` }}
                                    ></div>
                                    <div
                                        className="progress-segment blocked"
                                        style={{ width: `${(plan.blockedCount / plan.totalTests) * 100}%` }}
                                    ></div>
                                    <div
                                        className="progress-segment not-run"
                                        style={{ width: `${(plan.notRunCount / plan.totalTests) * 100}%` }}
                                    ></div>
                                </>
                            )}
                        </div>

                        {/* Expanded Suites */}
                        {expandedPlans[plan.id] && (
                            <div className="suites-list">
                                {plan.suites.map((suite) => (
                                    <div
                                        key={suite.id}
                                        className={`suite-item ${suite.url ? 'clickable' : ''}`}
                                        onClick={() => suite.url && window.open(suite.url, '_blank')}
                                        style={{ cursor: suite.url ? 'pointer' : 'default' }}
                                        title={suite.url ? 'Click to open in Azure DevOps' : ''}
                                    >
                                        <div className="suite-info">
                                            <span className="suite-name">{suite.name}</span>
                                            {suite.url && (
                                                <svg
                                                    className="external-link-icon"
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                >
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                    <polyline points="15 3 21 3 21 9"></polyline>
                                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                                </svg>
                                            )}
                                        </div>
                                        <div className="suite-stats">
                                            <span className="suite-passed" title="Passed">{suite.passedCount}</span>
                                            <span className="suite-failed" title="Failed">{suite.failedCount}</span>
                                            <span className="suite-blocked" title="Blocked">{suite.blockedCount}</span>
                                            <span className="suite-notrun" title="Not Run">{suite.notRunCount}</span>
                                            <span
                                                className="suite-pass-rate"
                                                style={{ color: getPassRateColor(suite.passRate) }}
                                            >
                                                {suite.passRate}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TestPlanProgress;
