// GitHub Connection Component
// Allows users to connect their GitHub account (optional integration)
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const GitHubConnect = ({ onClose }) => {
  const { connectGitHub, disconnectGitHub, githubConnected, user, error, clearError } = useAuth();
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showPATInput, setShowPATInput] = useState(false);

  const handleConnect = async () => {
    if (!pat.trim()) {
      setLocalError('Please enter a GitHub Personal Access Token');
      return;
    }

    setLoading(true);
    setLocalError('');
    clearError();

    try {
      await connectGitHub(pat);
      setPat('');
      setShowPATInput(false);
      if (onClose) onClose();
    } catch (err) {
      setLocalError(err.message || 'Failed to connect GitHub');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGitHub();
    if (onClose) onClose();
  };

  if (githubConnected) {
    return (
      <div className="github-connect-card connected">
        <div className="github-header">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          <span>GitHub Connected</span>
        </div>

        <div className="github-user-info">
          {user?.githubAvatar && (
            <img src={user.githubAvatar} alt={user.githubUsername} className="github-avatar" />
          )}
          <div className="github-user-details">
            <span className="github-username">@{user?.githubUsername}</span>
            <span className="github-status">Integration active</span>
          </div>
        </div>

        <div className="github-actions">
          <button className="disconnect-btn" onClick={handleDisconnect}>
            Disconnect GitHub
          </button>
        </div>

        <style>{`
          .github-connect-card {
            background: rgba(30, 41, 59, 0.95);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }

          .github-connect-card.connected {
            border-color: rgba(34, 197, 94, 0.3);
          }

          .github-header {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #22c55e;
            font-weight: 600;
            margin-bottom: 16px;
          }

          .github-user-info {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .github-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
          }

          .github-user-details {
            display: flex;
            flex-direction: column;
          }

          .github-username {
            color: #e2e8f0;
            font-weight: 500;
          }

          .github-status {
            color: #22c55e;
            font-size: 12px;
          }

          .github-actions {
            display: flex;
            gap: 10px;
          }

          .disconnect-btn {
            flex: 1;
            padding: 10px 16px;
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 6px;
            color: #f87171;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .disconnect-btn:hover {
            background: rgba(239, 68, 68, 0.25);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="github-connect-card">
      <div className="github-header">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        <span>Connect GitHub</span>
      </div>

      <p className="github-description">
        Connect your GitHub account to view PRs, code insights, and repository information.
      </p>

      {!showPATInput ? (
        <button className="connect-btn" onClick={() => setShowPATInput(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Connect with Personal Access Token
        </button>
      ) : (
        <div className="pat-input-section">
          <div className="form-group">
            <label htmlFor="github-pat">GitHub Personal Access Token</label>
            <input
              type="password"
              id="github-pat"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              disabled={loading}
            />
          </div>

          {(localError || error) && (
            <div className="error-message">{localError || error}</div>
          )}

          <div className="pat-actions">
            <button
              className="cancel-btn"
              onClick={() => {
                setShowPATInput(false);
                setPat('');
                setLocalError('');
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="submit-btn"
              onClick={handleConnect}
              disabled={loading || !pat.trim()}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>

          <p className="pat-help">
            Create a token at{' '}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
              GitHub Settings
            </a>
            {' '}with repo and read:user scopes.
          </p>
        </div>
      )}

      <style>{`
        .github-connect-card {
          background: rgba(30, 41, 59, 0.95);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .github-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e2e8f0;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .github-description {
          color: #94a3b8;
          font-size: 14px;
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .connect-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .connect-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .pat-input-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          color: #94a3b8;
          font-size: 13px;
          font-weight: 500;
        }

        .form-group input {
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #e2e8f0;
          font-size: 14px;
          font-family: monospace;
        }

        .form-group input:focus {
          outline: none;
          border-color: #22c55e;
        }

        .form-group input:disabled {
          opacity: 0.6;
        }

        .error-message {
          padding: 10px 12px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 6px;
          color: #fca5a5;
          font-size: 13px;
        }

        .pat-actions {
          display: flex;
          gap: 10px;
        }

        .cancel-btn {
          flex: 1;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
        }

        .submit-btn {
          flex: 1;
          padding: 10px 16px;
          background: #22c55e;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          background: #16a34a;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .pat-help {
          color: #64748b;
          font-size: 12px;
          margin: 0;
          text-align: center;
        }

        .pat-help a {
          color: #22c55e;
          text-decoration: none;
        }

        .pat-help a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default GitHubConnect;
