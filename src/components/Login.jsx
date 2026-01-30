// Login Component - Dual Authentication UI
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isFeatureEnabled } from '../config/featureFlags';

const Login = () => {
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithOAuth,
    requestPasswordReset,
    loading,
    error,
    clearError,
    isDualAuthEnabled,
    getAvailableAuthMethods,
  } = useAuth();

  const [mode, setMode] = useState('login'); // 'login', 'register', 'forgot'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    rememberMe: false,
  });
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const availableMethods = getAvailableAuthMethods();
  const hasEmailAuth = availableMethods.includes('email');
  const hasGoogleAuth = availableMethods.includes('google');
  const hasGitHubAuth = availableMethods.includes('github');

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setFormError('');
    clearError();
  };

  const validateForm = () => {
    if (!formData.email) {
      setFormError('Email is required');
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setFormError('Please enter a valid email address');
      return false;
    }

    if (mode === 'forgot') {
      return true;
    }

    if (!formData.password) {
      setFormError('Password is required');
      return false;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return false;
    }

    if (mode === 'register') {
      if (!formData.name) {
        setFormError('Name is required');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setFormError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!validateForm()) return;

    try {
      if (mode === 'login') {
        await loginWithEmail(formData.email, formData.password, formData.rememberMe);
      } else if (mode === 'register') {
        await registerWithEmail(formData.email, formData.password, formData.name);
      } else if (mode === 'forgot') {
        const result = await requestPasswordReset(formData.email);
        setSuccessMessage(result.message);
        setFormData((prev) => ({ ...prev, email: '' }));
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleOAuthLogin = async (provider) => {
    try {
      await loginWithOAuth(provider);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setFormError('');
    setSuccessMessage('');
    clearError();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>DevDash</h1>
          <p>
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'register' && 'Create your account'}
            {mode === 'forgot' && 'Reset your password'}
          </p>
        </div>

        {/* OAuth Buttons */}
        {mode !== 'forgot' && (hasGoogleAuth || hasGitHubAuth) && (
          <div className="oauth-section">
            {hasGoogleAuth && (
              <button
                type="button"
                className="oauth-btn google-btn"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            )}

            {hasGitHubAuth && (
              <button
                type="button"
                className="oauth-btn github-btn"
                onClick={() => handleOAuthLogin('github')}
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span>Continue with GitHub</span>
              </button>
            )}

            {hasEmailAuth && (hasGoogleAuth || hasGitHubAuth) && (
              <div className="divider">
                <span>or</span>
              </div>
            )}
          </div>
        )}

        {/* Email/Password Form */}
        {hasEmailAuth && (
          <form onSubmit={handleEmailSubmit} className="login-form">
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                  disabled={loading}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  disabled={loading}
                />
              </div>
            )}

            {mode === 'login' && isFeatureEnabled('auth.enableRememberMe') && (
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <span>Remember me</span>
                </label>
              </div>
            )}

            {/* Error Message */}
            {(formError || error) && (
              <div className="error-message">{formError || error}</div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="success-message">{successMessage}</div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <span className="loading-spinner" />
              ) : (
                <>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </>
              )}
            </button>
          </form>
        )}

        {/* Mode Switch Links */}
        <div className="login-footer">
          {mode === 'login' && (
            <>
              {hasEmailAuth && isFeatureEnabled('auth.enablePasswordReset') && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot password?
                </button>
              )}
              {hasEmailAuth && (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => switchMode('register')}
                  >
                    Sign up
                  </button>
                </p>
              )}
            </>
          )}

          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* Dual Auth Badge */}
        {isDualAuthEnabled && (
          <div className="dual-auth-badge">
            Dual Authentication Enabled
          </div>
        )}
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
          max-width: 420px;
          background: rgba(30, 41, 59, 0.95);
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-header h1 {
          color: #22c55e;
          font-size: 32px;
          margin: 0 0 8px 0;
          font-weight: 700;
        }

        .login-header p {
          color: #94a3b8;
          margin: 0;
          font-size: 16px;
        }

        .oauth-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .oauth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .oauth-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .oauth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .google-btn:hover:not(:disabled) {
          border-color: #4285F4;
        }

        .github-btn:hover:not(:disabled) {
          border-color: #f0f6fc;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 8px 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .divider span {
          padding: 0 16px;
          color: #64748b;
          font-size: 14px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          color: #94a3b8;
          font-size: 14px;
          font-weight: 500;
        }

        .form-group input[type="text"],
        .form-group input[type="email"],
        .form-group input[type="password"] {
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.3);
          color: #e2e8f0;
          font-size: 15px;
          transition: all 0.2s ease;
        }

        .form-group input:focus {
          outline: none;
          border-color: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
        }

        .form-group input::placeholder {
          color: #475569;
        }

        .form-group input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .checkbox-group {
          flex-direction: row;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #22c55e;
        }

        .error-message {
          padding: 12px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #fca5a5;
          font-size: 14px;
        }

        .success-message {
          padding: 12px;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          color: #86efac;
          font-size: 14px;
        }

        .submit-btn {
          padding: 14px 24px;
          background: #22c55e;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #16a34a;
        }

        .submit-btn:disabled {
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

        .login-footer {
          margin-top: 24px;
          text-align: center;
        }

        .login-footer p {
          color: #94a3b8;
          font-size: 14px;
          margin: 8px 0;
        }

        .link-btn {
          background: none;
          border: none;
          color: #22c55e;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }

        .link-btn:hover {
          color: #16a34a;
        }

        .dual-auth-badge {
          margin-top: 24px;
          padding: 8px 16px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 20px;
          color: #22c55e;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default Login;
