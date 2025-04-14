//import React, { useEffect, useState } from 'react';
//import axios from 'axios';

//const CodeQuality = () => {
//    const [metrics, setMetrics] = useState(null);

//    useEffect(() => {
//        const fetchSonarMetrics = async () => {
//            try {
//                const res = await axios.get(
//                    `${import.meta.env.VITE_SONARCUBE_URL}/sonar/api/measures/component?component=${import.meta.env.VITE_SONARCUBE_REPO}&metricKeys=bugs,vulnerabilities,code_smells,coverage`,
//                    {
//                        headers: {
//                            Authorization: `Basic ${btoa(import.meta.env.VITE_SONAR_TOKEN + ':')}`
//                        }
//                    }
//                );

//                const metricMap = {};
//                res.data.component.measures.forEach((m) => {
//                    metricMap[m.metric] = m.value;
//                });
//                setMetrics(metricMap);
//            } catch (err) {
//                console.error('SonarQube fetch error:', err);
//            }
//        };

//        fetchSonarMetrics();
//    }, []);

//    if (!metrics) return <div className="card">Loading Code Quality...</div>;

//    return (
//        <div className="card">
//            <h2>🛡️ Code Quality</h2>
//            <ul>
//                <li>🐞 Bugs: {metrics.bugs}</li>
//                <li>🚨 Vulnerabilities: {metrics.vulnerabilities}</li>
//                <li>🧹 Code Smells: {metrics.code_smells}</li>
//                <li>📈 Coverage: {metrics.coverage}%</li>
//            </ul>
//        </div>
//    );
//};


// components/CodeQuality.jsx
import React from 'react';
const mockMetrics = {
    sonar: {
        bugs: 5,
        vulnerabilities: 2,
        codeSmells: 18,
        coverage: '82.3%',
    },
    github: {
        alerts: 3,
        outdatedDeps: 6,
    },
    visualStudio: {
        warnings: 4,
        suggestions: 7,
    },
    coverity: {
        defects: 2,
        critical: 1,
    },
};
const CodeQuality = () => (
    <div className="card">
        <h2>🛠️ Code Quality Overview</h2>
        <div>
            <p><strong>SonarQube</strong></p>
            <ul>
                <li>🐞 Bugs: {mockMetrics.sonar.bugs}</li>
                <li>⚠️ Vulnerabilities: {mockMetrics.sonar.vulnerabilities}</li>
                <li>💨 Code Smells: {mockMetrics.sonar.codeSmells}</li>
                <li>🧪 Coverage: {mockMetrics.sonar.coverage}</li>
            </ul>

            <p><strong>GitHub</strong></p>
            <ul>
                <li>🧬 Security Alerts: {mockMetrics.github.alerts}</li>
                <li>📦 Outdated Packages: {mockMetrics.github.outdatedDeps}</li>
            </ul>

            <p><strong>Visual Studio</strong></p>
            <ul>
                <li>📝 Warnings: {mockMetrics.visualStudio.warnings}</li>
                <li>💡 Suggestions: {mockMetrics.visualStudio.suggestions}</li>
            </ul>

            <p><strong>Coverity</strong></p>
            <ul>
                <li>🚨 Defects: {mockMetrics.coverity.defects}</li>
                <li>❗ Critical: {mockMetrics.coverity.critical}</li>
            </ul>
        </div>
    </div>
);


export default CodeQuality;
