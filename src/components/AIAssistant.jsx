import React, { useState, useEffect } from 'react';
import { aiAPI } from '../api/backendClient';
import { isFeatureEnabled, isPATTokenMode } from '../config/featureFlags';

// Mock response logic (fallback when backend is not available)
const getMockAIResponse = (query) => {
    if (query.toLowerCase().includes('fail')) {
        return `
[Pipeline: API Deploy]
❌ Status: Failed
Error: Compilation error in BuildController.cs at line 57 – missing semicolon.

[Pipeline: Config Tools Release]
❌ Status: Failed
Error: ESLint failed – Unexpected token in Dashboard.jsx at line 23.

[Pipeline: UI Tests]
❌ Status: Cancelled
Note: Cancelled manually by SuryaN.
    `;
    } else if (query.toLowerCase().includes('pr') || query.toLowerCase().includes('pull request')) {
        return `
[PR #142: Add authentication module]
⚠️ Status: Needs Review
Reviewers: 0/2 approved
Comments: 3 unresolved

[PR #139: Fix memory leak in data processor]
✅ Status: Approved
Ready to merge

Suggestion: Address the unresolved comments on PR #142 before proceeding.
        `;
    } else {
        return "✅ No critical errors found in recent builds. All systems operational.";
    }
};

const AIAssistant = () => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [relatedIssues, setRelatedIssues] = useState([]);
    const [suggestedResolutions, setSuggestedResolutions] = useState([]);
    const [aiSource, setAiSource] = useState('');
    const [useMockMode, setUseMockMode] = useState(isPATTokenMode());

    // Check if AI features are enabled
    const aiEnabled = isFeatureEnabled('dashboard.enableAIAssistant');

    const handleAsk = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResponse('');
        setRelatedIssues([]);
        setSuggestedResolutions([]);

        // Use mock mode if PAT token mode is enabled or backend is unavailable
        if (useMockMode) {
            setTimeout(() => {
                const answer = getMockAIResponse(query);
                setResponse(answer);
                setAiSource('Mock');
                setLoading(false);
            }, 500);
            return;
        }

        try {
            const result = await aiAPI.query({
                query,
                queryType: 'General',
            });

            setResponse(result.data.response);
            setRelatedIssues(result.data.relatedIssues || []);
            setSuggestedResolutions(result.data.suggestedResolutions || []);
            setAiSource(result.data.source || 'AI');
        } catch (err) {
            console.error('AI query failed:', err);
            // Fallback to mock response
            const answer = getMockAIResponse(query);
            setResponse(answer);
            setAiSource('Fallback');
            setError('Backend unavailable, showing cached response');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const handleExplainError = async (errorLog) => {
        setLoading(true);
        try {
            const result = await aiAPI.explainError(errorLog);
            setResponse(result.data.explanation);
            setRelatedIssues(result.data.similarIssues || []);
            setSuggestedResolutions(result.data.suggestedResolutions || []);
        } catch (err) {
            setError('Failed to explain error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card ai-assistant-card">
            <div className="ai-header">
                <h2>AI Assistant</h2>
                {aiSource && (
                    <span className={`ai-source-badge ${aiSource.toLowerCase()}`}>
                        {aiSource}
                    </span>
                )}
            </div>

            <div className="ai-query-box">
                <input
                    type="text"
                    placeholder="Ask e.g. Why did pipeline fail? What PRs need review?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="query-input"
                    disabled={loading}
                />
                <button
                    onClick={handleAsk}
                    className="btn"
                    disabled={loading || !query.trim()}
                >
                    {loading ? 'Thinking...' : 'Ask'}
                </button>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <button
                    className="quick-action-btn"
                    onClick={() => setQuery('Show failed pipelines')}
                >
                    Failed Pipelines
                </button>
                <button
                    className="quick-action-btn"
                    onClick={() => setQuery('PRs needing review')}
                >
                    PRs to Review
                </button>
                <button
                    className="quick-action-btn"
                    onClick={() => setQuery('Recent build errors')}
                >
                    Build Errors
                </button>
            </div>

            {error && (
                <div className="ai-error">
                    {error}
                </div>
            )}

            {response && (
                <div className="ai-response-box">
                    <pre>{response}</pre>
                </div>
            )}

            {/* Related Issues */}
            {relatedIssues.length > 0 && (
                <div className="related-issues">
                    <h4>Related Issues</h4>
                    <ul>
                        {relatedIssues.map((issue, idx) => (
                            <li key={idx} className="related-issue-item">
                                <span className="issue-title">{issue.title}</span>
                                <span className="issue-score">
                                    {Math.round(issue.similarityScore * 100)}% match
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Suggested Resolutions */}
            {suggestedResolutions.length > 0 && (
                <div className="suggested-resolutions">
                    <h4>Suggested Resolutions</h4>
                    {suggestedResolutions.map((res, idx) => (
                        <div key={idx} className="resolution-item">
                            <strong>{res.title}</strong>
                            <p>{res.description}</p>
                            {res.steps && res.steps.length > 0 && (
                                <ol className="resolution-steps">
                                    {res.steps.map((step, stepIdx) => (
                                        <li key={stepIdx}>{step}</li>
                                    ))}
                                </ol>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .ai-assistant-card {
                    position: relative;
                }

                .ai-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }

                .ai-header h2 {
                    margin: 0;
                }

                .ai-source-badge {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .ai-source-badge.azureopenai {
                    background: rgba(0, 120, 212, 0.2);
                    color: #0078d4;
                }

                .ai-source-badge.microsoftcopilot {
                    background: rgba(134, 97, 193, 0.2);
                    color: #8661c1;
                }

                .ai-source-badge.knowledgebase,
                .ai-source-badge.cachedresponse {
                    background: rgba(34, 197, 94, 0.2);
                    color: #22c55e;
                }

                .ai-source-badge.mock,
                .ai-source-badge.fallback {
                    background: rgba(251, 191, 36, 0.2);
                    color: #fbbf24;
                }

                .quick-actions {
                    display: flex;
                    gap: 8px;
                    margin: 12px 0;
                    flex-wrap: wrap;
                }

                .quick-action-btn {
                    padding: 6px 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    color: #94a3b8;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .quick-action-btn:hover {
                    background: rgba(34, 197, 94, 0.15);
                    border-color: rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                }

                .ai-error {
                    padding: 8px 12px;
                    background: rgba(251, 191, 36, 0.15);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    border-radius: 6px;
                    color: #fbbf24;
                    font-size: 13px;
                    margin-bottom: 12px;
                }

                .related-issues,
                .suggested-resolutions {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .related-issues h4,
                .suggested-resolutions h4 {
                    color: #94a3b8;
                    font-size: 13px;
                    margin: 0 0 12px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .related-issues ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .related-issue-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 12px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 6px;
                    margin-bottom: 6px;
                }

                .issue-title {
                    color: #e2e8f0;
                    font-size: 14px;
                }

                .issue-score {
                    color: #22c55e;
                    font-size: 12px;
                    font-weight: 500;
                }

                .resolution-item {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                }

                .resolution-item strong {
                    color: #22c55e;
                    font-size: 14px;
                }

                .resolution-item p {
                    color: #94a3b8;
                    font-size: 13px;
                    margin: 8px 0;
                }

                .resolution-steps {
                    color: #e2e8f0;
                    font-size: 13px;
                    padding-left: 20px;
                    margin: 8px 0 0 0;
                }

                .resolution-steps li {
                    margin-bottom: 4px;
                }
            `}</style>
        </div>
    );
};

export default AIAssistant;
