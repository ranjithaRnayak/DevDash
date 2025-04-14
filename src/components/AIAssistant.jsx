import React, { useState } from 'react';

// Mock response logic
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
    } else {
        return "✅ No critical errors found in recent builds.";
    }
};

const AIAssistant = () => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');

    const handleAsk = () => {
        const answer = getMockAIResponse(query);
        setResponse(answer);
    };

    return (
        <div className="card">
            <h2>🧠 AI Assistant</h2>

            <div className="ai-query-box">
                <input
                    type="text"
                    placeholder="Ask e.g. Why did pipeline fail?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="query-input"
                />
                <button onClick={handleAsk} className="btn">Ask</button>
            </div>

            {response && (
                <div className="ai-response-box">
                    <pre>{response}</pre>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;