// Protected Route Component - Guards routes that require authentication
import React from 'react';
import { useAuth } from '../context/AuthContext';

// Lazy load Login to avoid potential circular dependency
const Login = React.lazy(() => import('./Login'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="protected-loading">
    <div className="loading-content">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
    <style>{`
      .protected-loading {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      }

      .loading-content {
        text-align: center;
      }

      .loading-content .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(34, 197, 94, 0.2);
        border-top-color: #22c55e;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }

      .loading-content p {
        color: #94a3b8;
        font-size: 16px;
        margin: 0;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </div>
);

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return <LoadingFallback />;
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return (
      <React.Suspense fallback={<LoadingFallback />}>
        <Login />
      </React.Suspense>
    );
  }

  // If a specific role is required, check for it
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
          <p className="required-role">Required role: {requiredRole}</p>
        </div>
        <style>{`
          .access-denied {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          }

          .access-denied-content {
            text-align: center;
            padding: 40px;
            background: rgba(30, 41, 59, 0.95);
            border-radius: 16px;
            border: 1px solid rgba(239, 68, 68, 0.3);
          }

          .access-denied-content h2 {
            color: #ef4444;
            font-size: 24px;
            margin: 0 0 16px 0;
          }

          .access-denied-content p {
            color: #94a3b8;
            margin: 8px 0;
          }

          .access-denied-content .required-role {
            color: #64748b;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  // User is authenticated and has the required role (if any)
  return <>{children}</>;
};

export default ProtectedRoute;
