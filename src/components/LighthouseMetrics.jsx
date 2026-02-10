import React, { useEffect, useState, useRef } from 'react';
import { lighthouseAPI } from '../api/backendClient';

const LighthouseMetrics = ({ selectedBranch, dashboardId }) => {
    const [metrics, setMetrics] = useState(null);
    const [history, setHistory] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [currentBranch, setCurrentBranch] = useState(selectedBranch || '');
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        checkStatus();
    }, []);

    useEffect(() => {
        if (enabled && currentBranch) {
            fetchMetrics(currentBranch);
        }
    }, [enabled, currentBranch]);

    const checkStatus = async () => {
        try {
            const response = await lighthouseAPI.getStatus();
            setEnabled(response.data.enabled && response.data.configured);

            if (response.data.enabled) {
                fetchBranches();
            }
        } catch (error) {
            console.error('Failed to check Lighthouse status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBranches = async () => {
        try {
            const response = await lighthouseAPI.getBranches();
            setBranches(response.data || []);

            if (!currentBranch && response.data.length > 0) {
                setCurrentBranch(response.data[0].branch);
            }
        } catch (error) {
            console.error('Failed to fetch branches:', error);
        }
    };

    const fetchMetrics = async (branch) => {
        setLoading(true);
        try {
            const [metricsRes, historyRes] = await Promise.all([
                lighthouseAPI.getBranchResult(branch),
                lighthouseAPI.getBranchHistory(branch, 7),
            ]);

            setMetrics(metricsRes.data);
            setHistory(historyRes.data || []);
        } catch (error) {
            console.error('Failed to fetch Lighthouse metrics:', error);
            setMetrics(null);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 90) return '#22c55e';
        if (score >= 50) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreClass = (score) => {
        if (score >= 90) return 'score-good';
        if (score >= 50) return 'score-average';
        return 'score-poor';
    };

    const formatMetricValue = (value, unit = 'ms') => {
        if (unit === 'ms') {
            if (value >= 1000) {
                return `${(value / 1000).toFixed(1)}s`;
            }
            return `${Math.round(value)}ms`;
        }
        return value.toFixed(2);
    };

    if (!enabled) {
        return (
            <div className="card lighthouse-card">
                <h2>Lighthouse Metrics</h2>
                <div className="empty-state">
                    <span className="empty-icon">📊</span>
                    <p>Lighthouse feature is not enabled</p>
                </div>
            </div>
        );
    }

    if (loading && !metrics) {
        return (
            <div className="card lighthouse-card">
                <h2>Lighthouse Metrics</h2>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading metrics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card lighthouse-card">
            <div className="lighthouse-header">
                <h2>Lighthouse Metrics</h2>
                <select
                    className="branch-select"
                    value={currentBranch}
                    onChange={(e) => setCurrentBranch(e.target.value)}
                >
                    {branches.map((b) => (
                        <option key={b.branch} value={b.branch}>
                            {b.branch}
                        </option>
                    ))}
                </select>
            </div>

            {metrics ? (
                <>
                    <div className="scores-grid">
                        <ScoreCard
                            title="Performance"
                            score={metrics.performance}
                            color={getScoreColor(metrics.performance)}
                        />
                        <ScoreCard
                            title="Accessibility"
                            score={metrics.accessibility}
                            color={getScoreColor(metrics.accessibility)}
                        />
                        <ScoreCard
                            title="Best Practices"
                            score={metrics.bestPractices}
                            color={getScoreColor(metrics.bestPractices)}
                        />
                        <ScoreCard
                            title="SEO"
                            score={metrics.seo}
                            color={getScoreColor(metrics.seo)}
                        />
                    </div>

                    {metrics.metrics && (
                        <div className="core-web-vitals">
                            <h3>Core Web Vitals</h3>
                            <div className="vitals-grid">
                                <VitalCard
                                    label="FCP"
                                    value={formatMetricValue(metrics.metrics.firstContentfulPaint)}
                                    description="First Contentful Paint"
                                />
                                <VitalCard
                                    label="LCP"
                                    value={formatMetricValue(metrics.metrics.largestContentfulPaint)}
                                    description="Largest Contentful Paint"
                                />
                                <VitalCard
                                    label="TTI"
                                    value={formatMetricValue(metrics.metrics.timeToInteractive)}
                                    description="Time to Interactive"
                                />
                                <VitalCard
                                    label="TBT"
                                    value={formatMetricValue(metrics.metrics.totalBlockingTime)}
                                    description="Total Blocking Time"
                                />
                                <VitalCard
                                    label="CLS"
                                    value={metrics.metrics.cumulativeLayoutShift.toFixed(3)}
                                    description="Cumulative Layout Shift"
                                />
                                <VitalCard
                                    label="SI"
                                    value={formatMetricValue(metrics.metrics.speedIndex)}
                                    description="Speed Index"
                                />
                            </div>
                        </div>
                    )}

                    {history.length > 1 && (
                        <div className="trend-section">
                            <h3>Performance Trend (Last 7 Audits)</h3>
                            <div className="trend-chart">
                                {history.slice().reverse().map((h, idx) => (
                                    <div key={idx} className="trend-bar-container">
                                        <div
                                            className={`trend-bar ${getScoreClass(h.performance)}`}
                                            style={{ height: `${h.performance}%` }}
                                            title={`${h.performance}% - ${new Date(h.timestamp).toLocaleDateString()}`}
                                        />
                                        <span className="trend-label">
                                            {new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="lighthouse-footer">
                        <span className="last-audit">
                            Last audit: {new Date(metrics.timestamp).toLocaleString()}
                        </span>
                    </div>
                </>
            ) : (
                <div className="empty-state">
                    <span className="empty-icon">📊</span>
                    <p>No metrics available for {currentBranch}</p>
                </div>
            )}
        </div>
    );
};

const ScoreCard = ({ title, score, color }) => (
    <div className="score-card">
        <div className="score-circle" style={{ borderColor: color }}>
            <span className="score-value" style={{ color }}>{score}</span>
        </div>
        <span className="score-title">{title}</span>
    </div>
);

const VitalCard = ({ label, value, description }) => (
    <div className="vital-card" title={description}>
        <span className="vital-label">{label}</span>
        <span className="vital-value">{value}</span>
    </div>
);

export default LighthouseMetrics;
