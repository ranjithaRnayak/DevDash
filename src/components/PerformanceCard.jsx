// components/PerformanceCard.jsx
import React from 'react';

const PerformanceCard = () => (
    <div className="card">
        <h2>📊 Developer Performance</h2>
        <div>
            <p>📦 <strong>Bundle Size:</strong> 302 KB</p>
            <p>⚡ <strong>API Latency:</strong> 210 ms</p>
            <p>🧪 <strong>Lighthouse Score:</strong> 91/100</p>
            <p>🧬 <strong>Test Coverage:</strong> 84%</p>
        </div>
    </div>
);

export default PerformanceCard;