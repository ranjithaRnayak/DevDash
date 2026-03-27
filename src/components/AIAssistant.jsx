import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { aiAPI, copilotAPI } from '../api/backendClient';
import { isFeatureEnabled, isPATTokenMode } from '../config/featureFlags';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getMockAIResponse = (query) => {
    if (query.toLowerCase().includes('fail')) {
        return `[Pipeline: API Deploy]
❌ Status: Failed
Error: Compilation error in BuildController.cs at line 57 – missing semicolon.

[Pipeline: Config Tools Release]
❌ Status: Failed
Error: ESLint failed – Unexpected token in Dashboard.jsx at line 23.`;
    } else if (query.toLowerCase().includes('pr') || query.toLowerCase().includes('pull request')) {
        return `[PR #142: Add authentication module]
⚠️ Status: Needs Review
Reviewers: 0/2 approved

[PR #139: Fix memory leak in data processor]
✅ Status: Approved
Ready to merge`;
    }
    return "✅ No critical errors found in recent builds. All systems operational.";
};

const AIAssistant = ({ dashboardId = 'dev' }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [relatedIssues, setRelatedIssues] = useState([]);
    const [suggestedResolutions, setSuggestedResolutions] = useState([]);
    const [aiSource, setAiSource] = useState('');
    const [useMockMode, setUseMockMode] = useState(isPATTokenMode());
    const [conversationHistory, setConversationHistory] = useState([]);
    const [aiProvider, setAiProvider] = useState('auto');
    const [copilotEnabled, setCopilotEnabled] = useState(false);
    const [copilotContext, setCopilotContext] = useState(null);

    useEffect(() => {
        checkCopilotStatus();
    }, []);

    useEffect(() => {
        if (copilotEnabled && dashboardId) {
            fetchCopilotContext();
        }
    }, [copilotEnabled, dashboardId]);

    const checkCopilotStatus = async () => {
        try {
            const response = await copilotAPI.getStatus();
            setCopilotEnabled(response.data.enabled && response.data.configured);
        } catch (err) {
            console.error('Copilot not available:', err.message);
        }
    };

    const fetchCopilotContext = async () => {
        try {
            const response = await copilotAPI.getContext(dashboardId);
            setCopilotContext(response.data);
        } catch (err) {
            console.error('Failed to fetch Copilot context:', err.message);
        }
    };

    const handleAsk = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');
        setResponse('');
        setRelatedIssues([]);
        setSuggestedResolutions([]);

        if (useMockMode) {
            setTimeout(() => {
                const answer = getMockAIResponse(query);
                setResponse(answer);
                setAiSource('Mock');
                addToHistory('user', query);
                addToHistory('assistant', answer);
                setLoading(false);
            }, 500);
            return;
        }

        try {
            let result;

            if (aiProvider === 'copilot' && copilotEnabled) {
                result = await copilotAPI.chat({
                    message: query,
                    context: copilotContext,
                    conversationHistory: conversationHistory.slice(-10),
                });

                if (result.data.success) {
                    setResponse(result.data.message);
                    setAiSource('Copilot');
                    addToHistory('user', query);
                    addToHistory('assistant', result.data.message);
                } else {
                    throw new Error(result.data.error || 'Copilot request failed');
                }
            } else {
                result = await aiAPI.query({
                    query,
                    queryType: 'General',
                    dashboardId,
                });

                setResponse(result.data.response);
                setRelatedIssues(result.data.relatedIssues || []);
                setSuggestedResolutions(result.data.suggestedResolutions || []);
                setAiSource(result.data.source || 'Azure OpenAI');
                addToHistory('user', query);
                addToHistory('assistant', result.data.response);
            }
        } catch (err) {
            console.error('AI query failed:', err);
            const answer = getMockAIResponse(query);
            setResponse(answer);
            setAiSource('Fallback');
            setError('Backend unavailable, showing cached response');
        } finally {
            setLoading(false);
        }
    };

    const addToHistory = (role, content) => {
        setConversationHistory(prev => [...prev, { role, content }]);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const clearConversation = () => {
        setConversationHistory([]);
        setResponse('');
        setRelatedIssues([]);
        setSuggestedResolutions([]);
        setError('');
    };

    return (
        <div className="card ai-assistant-card">
            <div className="ai-header">
                <h2>AI Assistant</h2>
                <div className="ai-controls">
                    {copilotEnabled && (
                        <select
                            className="ai-provider-select"
                            value={aiProvider}
                            onChange={(e) => setAiProvider(e.target.value)}
                        >
                            <option value="auto">Auto</option>
                            <option value="copilot">GitHub Copilot</option>
                            <option value="openai">Azure OpenAI</option>
                        </select>
                    )}
                    {aiSource && (
                        <span className={`ai-source-badge ${aiSource.toLowerCase().replace(/\s+/g, '')}`}>
                            {aiSource}
                        </span>
                    )}
                </div>
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

            <div className="quick-actions">
                <button className="quick-action-btn" onClick={() => setQuery('Show failed pipelines')}>
                    Failed Pipelines
                </button>
                <button className="quick-action-btn" onClick={() => setQuery('PRs needing review')}>
                    PRs to Review
                </button>
                <button className="quick-action-btn" onClick={() => setQuery('Recent build errors')}>
                    Build Errors
                </button>
                {conversationHistory.length > 0 && (
                    <button className="quick-action-btn clear-btn" onClick={clearConversation}>
                        Clear Chat
                    </button>
                )}
            </div>

            {error && <div className="ai-error">{error}</div>}

            {response && (
                <div className="ai-response-box">
                    <pre>{response}</pre>
                </div>
            )}

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

            {suggestedResolutions.length > 0 && (
                <div className="suggested-resolutions">
                    <h4>Suggested Resolutions</h4>
                    {suggestedResolutions.map((res, idx) => (
                        <div key={idx} className="resolution-item">
                            <strong>{res.title}</strong>
                            <p>{res.description}</p>
                            {res.steps?.length > 0 && (
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

            {copilotContext && copilotContext.recentFailures?.length > 0 && (
                <div className="copilot-context">
                    <h4>Context Loaded</h4>
                    <span className="context-info">
                        {copilotContext.recentFailures.length} recent failures,{' '}
                        {copilotContext.openPRs?.length || 0} open PRs
                    </span>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;
