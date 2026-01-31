// Login Component - Microsoft Entra ID Authentication
import React from 'react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { loginWithEntraID, loading, error, clearError } = useAuth();

  const handleEntraIDLogin = async () => {
    clearError();
    try {
      await loginWithEntraID();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="4" fill="#22c55e" />
              <path
                d="M7 8h10M7 12h10M7 16h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>DevDash</h1>
          <p>Developer Productivity Dashboard</p>
        </div>

        <div className="login-content">
          <p className="sign-in-text">Sign in to continue</p>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Microsoft Entra ID Login Button */}
          <button
            type="button"
            className="entra-btn"
            onClick={handleEntraIDLogin}
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <>
                <svg viewBox="0 0 23 23" width="20" height="20">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>

          <p className="info-text">
            Use your organization's Microsoft account to sign in.
          </p>
        </div>

        <div className="login-footer">
          <p className="security-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Secured by Microsoft Entra ID
          </p>
        </div>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: rgba(30, 41, 59, 0.95);
          border-radius: 16px;
          padding: 48px 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .logo {
          margin-bottom: 16px;
        }

        .login-header h1 {
          color: #22c55e;
          font-size: 32px;
          margin: 0 0 8px 0;
          font-weight: 700;
        }

        .login-header p {
          color: #64748b;
          margin: 0;
          font-size: 14px;
        }

        .login-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sign-in-text {
          color: #94a3b8;
          text-align: center;
          margin: 0;
          font-size: 16px;
        }

        .error-message {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 14px;
          text-align: center;
        }

        .entra-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 14px 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 52px;
        }

        .entra-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: #0078d4;
          box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.15);
        }

        .entra-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .info-text {
          color: #64748b;
          text-align: center;
          font-size: 13px;
          margin: 0;
        }

        .login-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .security-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default Login;
