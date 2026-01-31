// CodeQuality.jsx - SonarQube Integration with Authentication
import React, { useEffect, useState } from 'react';

// SonarQube configuration from environment
const SONAR_CONFIG = {
  // Always use Vite proxy in dev to avoid CORS (configured in vite.config.js)
  // The proxy forwards /sonar/* to your SonarQube server
  proxyUrl: '/sonar',
  projectKey: import.meta.env.VITE_SONARCUBE_REPO || '',
  token: import.meta.env.VITE_SONAR_TOKEN || '',
  isConfigured: !!(import.meta.env.VITE_SONARCUBE_URL && import.meta.env.VITE_SONARCUBE_REPO),
};

// Mock data for when SonarQube is not configured
const mockMetrics = {
  sonar: {
    bugs: 5,
    vulnerabilities: 2,
    codeSmells: 18,
    coverage: '82.3%',
    duplications: '3.2%',
    qualityGate: 'Passed',
  },
  github: {
    alerts: 3,
    outdatedDeps: 6,
  },
};

const CodeQuality = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    const fetchSonarMetrics = async () => {
      // If SonarQube is not configured, use mock data
      if (!SONAR_CONFIG.isConfigured) {
        console.log('SonarQube not configured, using mock data');
        setMetrics(mockMetrics.sonar);
        setUsingMockData(true);
        setLoading(false);
        return;
      }

      try {
        // Use Vite proxy to avoid CORS - proxy configured in vite.config.js
        const apiUrl = `${SONAR_CONFIG.proxyUrl}/api/measures/component?component=${encodeURIComponent(SONAR_CONFIG.projectKey)}&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,alert_status`;

        const headers = {
          'Accept': 'application/json',
        };

        // Add authentication if token is provided (required for private projects)
        if (SONAR_CONFIG.token) {
          // SonarQube uses Basic auth with token as username, empty password
          headers['Authorization'] = `Basic ${btoa(SONAR_CONFIG.token + ':')}`;
        }

        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Authentication failed - check your SonarQube token');
          } else if (response.status === 403) {
            throw new Error('Access denied - token may not have access to this project');
          } else if (response.status === 404) {
            throw new Error('Project not found - check VITE_SONARCUBE_REPO');
          }
          throw new Error(`SonarQube API error: ${response.status}`);
        }

        const data = await response.json();

        // Parse SonarQube response
        const metricMap = {};
        if (data.component && data.component.measures) {
          data.component.measures.forEach((m) => {
            metricMap[m.metric] = m.value;
          });
        }

        setMetrics({
          bugs: metricMap.bugs || 0,
          vulnerabilities: metricMap.vulnerabilities || 0,
          codeSmells: metricMap.code_smells || 0,
          coverage: metricMap.coverage ? `${metricMap.coverage}%` : 'N/A',
          duplications: metricMap.duplicated_lines_density ? `${metricMap.duplicated_lines_density}%` : 'N/A',
          qualityGate: metricMap.alert_status === 'OK' ? 'Passed' : (metricMap.alert_status || 'Unknown'),
        });
        setUsingMockData(false);
      } catch (err) {
        console.error('SonarQube fetch error:', err);
        setError(err.message);
        // Fall back to mock data on error
        setMetrics(mockMetrics.sonar);
        setUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSonarMetrics();
  }, []);

  // Quality gate status styling
  const getQualityGateStyle = (status) => {
    if (status === 'Passed' || status === 'OK') {
      return { color: '#22c55e', icon: '✓' };
    } else if (status === 'Failed' || status === 'ERROR') {
      return { color: '#ef4444', icon: '✗' };
    }
    return { color: '#f59e0b', icon: '?' };
  };

  // Metric severity styling
  const getMetricStyle = (value, thresholds = { low: 0, medium: 5, high: 10 }) => {
    const numValue = parseInt(value) || 0;
    if (numValue <= thresholds.low) return '#22c55e';
    if (numValue <= thresholds.medium) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Code Quality</h2>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading metrics...</p>
        </div>
        <style>{`
          .loading-state { text-align: center; padding: 20px; }
          .spinner {
            width: 30px;
            height: 30px;
            border: 3px solid rgba(34, 197, 94, 0.2);
            border-top-color: #22c55e;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 10px;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const qualityGate = getQualityGateStyle(metrics?.qualityGate);

  return (
    <div className="card code-quality-card">
      <div className="card-header">
        <h2>Code Quality</h2>
        {usingMockData && (
          <span className="mock-badge" title={error || 'SonarQube not configured'}>
            Demo Data
          </span>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Quality Gate Status */}
      <div className="quality-gate" style={{ borderColor: qualityGate.color }}>
        <span className="gate-icon" style={{ color: qualityGate.color }}>{qualityGate.icon}</span>
        <div className="gate-info">
          <span className="gate-label">Quality Gate</span>
          <span className="gate-status" style={{ color: qualityGate.color }}>{metrics?.qualityGate}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-icon">🐞</span>
          <div className="metric-info">
            <span className="metric-value" style={{ color: getMetricStyle(metrics?.bugs, { low: 0, medium: 3, high: 10 }) }}>
              {metrics?.bugs}
            </span>
            <span className="metric-label">Bugs</span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-icon">🔓</span>
          <div className="metric-info">
            <span className="metric-value" style={{ color: getMetricStyle(metrics?.vulnerabilities, { low: 0, medium: 2, high: 5 }) }}>
              {metrics?.vulnerabilities}
            </span>
            <span className="metric-label">Vulnerabilities</span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-icon">💨</span>
          <div className="metric-info">
            <span className="metric-value" style={{ color: getMetricStyle(metrics?.codeSmells, { low: 5, medium: 20, high: 50 }) }}>
              {metrics?.codeSmells}
            </span>
            <span className="metric-label">Code Smells</span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-icon">🧪</span>
          <div className="metric-info">
            <span className="metric-value">{metrics?.coverage}</span>
            <span className="metric-label">Coverage</span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-icon">📋</span>
          <div className="metric-info">
            <span className="metric-value">{metrics?.duplications}</span>
            <span className="metric-label">Duplications</span>
          </div>
        </div>
      </div>

      {/* GitHub Security (if connected) */}
      {mockMetrics.github && (
        <div className="github-security">
          <h3>GitHub Security</h3>
          <div className="security-items">
            <div className="security-item">
              <span className="security-icon">🔒</span>
              <span className="security-value">{mockMetrics.github.alerts}</span>
              <span className="security-label">Security Alerts</span>
            </div>
            <div className="security-item">
              <span className="security-icon">📦</span>
              <span className="security-value">{mockMetrics.github.outdatedDeps}</span>
              <span className="security-label">Outdated Deps</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .code-quality-card {
          position: relative;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .card-header h2 {
          margin: 0;
        }

        .mock-badge {
          font-size: 10px;
          padding: 4px 8px;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          border-radius: 12px;
          color: #f59e0b;
          cursor: help;
        }

        .error-banner {
          padding: 8px 12px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          color: #fca5a5;
          font-size: 12px;
          margin-bottom: 16px;
        }

        .quality-gate {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          border-left: 4px solid;
          margin-bottom: 20px;
        }

        .gate-icon {
          font-size: 24px;
          font-weight: bold;
        }

        .gate-info {
          display: flex;
          flex-direction: column;
        }

        .gate-label {
          font-size: 12px;
          color: #64748b;
        }

        .gate-status {
          font-size: 16px;
          font-weight: 600;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .metric-icon {
          font-size: 20px;
        }

        .metric-info {
          display: flex;
          flex-direction: column;
        }

        .metric-value {
          font-size: 18px;
          font-weight: 600;
        }

        .metric-label {
          font-size: 11px;
          color: #64748b;
        }

        .github-security {
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .github-security h3 {
          font-size: 14px;
          color: #94a3b8;
          margin: 0 0 12px 0;
        }

        .security-items {
          display: flex;
          gap: 16px;
        }

        .security-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .security-icon {
          font-size: 16px;
        }

        .security-value {
          font-weight: 600;
          color: #e2e8f0;
        }

        .security-label {
          font-size: 12px;
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default CodeQuality;
