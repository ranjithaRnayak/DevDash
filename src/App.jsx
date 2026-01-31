// App.jsx
import React, { useEffect, useState } from 'react';
import './index.css';
import Dashboard from './pages/Dashboard';
import TestDashboard from './pages/TestDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GitHubConnect from './components/GitHubConnect';
import { isPATTokenMode } from './config/featureFlags';

// Dashboard Content Component (with user info when logged in)
const AuthenticatedDashboardContent = () => {
    const { user, logout, githubConnected } = useAuth();
    const [isTestMode, setIsTestMode] = useState(false);
    const [showGitHubModal, setShowGitHubModal] = useState(false);

    useEffect(() => {
        const toggle = document.getElementById("envToggle");
        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");

        if (!toggle || !labelLeft || !labelRight || !slider) return;

        const updateLabel = () => {
            if (toggle.checked) {
                labelLeft.style.color = "#ccc";
                labelLeft.style.fontSize = "14px";
                labelRight.style.color = "#3b82f6";
                labelRight.style.fontSize = "16px";
                document.body.style.backgroundColor = "#1b324f";
                slider.style.backgroundColor = "#3b82f6";
            } else {
                labelLeft.style.color = "#22c55e";
                labelLeft.style.fontSize = "16px";
                labelRight.style.color = "#ccc";
                labelRight.style.fontSize = "14px";
                document.body.style.backgroundColor = "#17271f";
                slider.style.backgroundColor = "#22c55e";
            }
            setIsTestMode(toggle.checked);
        };

        toggle.addEventListener("change", updateLabel);
        updateLabel();

        return () => toggle.removeEventListener("change", updateLabel);
    }, []);

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div className={isTestMode ? 'dashboard test-bg' : 'dashboard dev-bg'}>
            <div className="dashboard-header">
                <h1>DevDash</h1>
                <div className="header-right">
                    <div className="env-toggle">
                        <span className="toggle-label toggle-label-left" id="envLeftLabel">Dev</span>
                        <label className="switch">
                            <input type="checkbox" id="envToggle" />
                            <span className="slider round"></span>
                        </label>
                        <span className="toggle-label toggle-label-right" id="envRightLabel">Test</span>
                    </div>

                    {/* GitHub Connection Status */}
                    {githubConnected ? (
                        <button
                            className="github-status-btn connected"
                            onClick={() => setShowGitHubModal(true)}
                            title="GitHub Connected"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>{user?.githubUsername || 'GitHub'}</span>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            className="github-status-btn"
                            onClick={() => setShowGitHubModal(true)}
                            title="Connect GitHub"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            <span>Connect GitHub</span>
                        </button>
                    )}

                    {/* User Info Section */}
                    <div className="user-section">
                        <div className="user-info">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name} className="user-avatar" />
                            ) : (
                                <div className="user-avatar-placeholder">
                                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            )}
                            <div className="user-details">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-auth-method">via Microsoft</span>
                            </div>
                        </div>
                        <button className="logout-btn" onClick={handleLogout} title="Logout">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div>
                {isTestMode ? <TestDashboard /> : <Dashboard />}
            </div>

            {/* GitHub Connection Modal */}
            {showGitHubModal && (
                <div className="modal-overlay" onClick={() => setShowGitHubModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowGitHubModal(false)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <GitHubConnect onClose={() => setShowGitHubModal(false)} />
                    </div>
                </div>
            )}

            <style>{`
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .github-status-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    color: #94a3b8;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .github-status-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.25);
                }

                .github-status-btn.connected {
                    background: rgba(34, 197, 94, 0.1);
                    border-color: rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                }

                .user-section {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 16px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .user-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .user-avatar-placeholder {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #0078d4, #106ebe);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: 600;
                    font-size: 16px;
                }

                .user-details {
                    display: flex;
                    flex-direction: column;
                }

                .user-name {
                    color: #e2e8f0;
                    font-size: 14px;
                    font-weight: 500;
                }

                .user-auth-method {
                    color: #64748b;
                    font-size: 11px;
                }

                .logout-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    background: rgba(239, 68, 68, 0.15);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    color: #f87171;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .logout-btn:hover {
                    background: rgba(239, 68, 68, 0.25);
                    border-color: rgba(239, 68, 68, 0.5);
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .modal-content {
                    position: relative;
                    width: 100%;
                    max-width: 400px;
                }

                .modal-close {
                    position: absolute;
                    top: -40px;
                    right: 0;
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 8px;
                }

                .modal-close:hover {
                    color: white;
                }

                @media (max-width: 768px) {
                    .header-right {
                        flex-direction: column;
                        align-items: flex-end;
                        gap: 12px;
                    }

                    .user-section {
                        padding: 6px 12px;
                    }

                    .user-details {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

// PAT Token Mode Dashboard (original behavior - no login required)
const PATModeDashboard = () => {
    const [isTestMode, setIsTestMode] = useState(false);

    useEffect(() => {
        const toggle = document.getElementById("envToggle");
        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");

        if (!toggle || !labelLeft || !labelRight || !slider) return;

        const updateLabel = () => {
            if (toggle.checked) {
                labelLeft.style.color = "#ccc";
                labelLeft.style.fontSize = "14px";
                labelRight.style.color = "#3b82f6";
                labelRight.style.fontSize = "16px";
                document.body.style.backgroundColor = "#1b324f";
                slider.style.backgroundColor = "#3b82f6";
            } else {
                labelLeft.style.color = "#22c55e";
                labelLeft.style.fontSize = "16px";
                labelRight.style.color = "#ccc";
                labelRight.style.fontSize = "14px";
                document.body.style.backgroundColor = "#17271f";
                slider.style.backgroundColor = "#22c55e";
            }
            setIsTestMode(toggle.checked);
        };

        toggle.addEventListener("change", updateLabel);
        updateLabel();

        return () => toggle.removeEventListener("change", updateLabel);
    }, []);

    return (
        <div className={isTestMode ? 'dashboard test-bg' : 'dashboard dev-bg'}>
            <div className="dashboard-header">
                <h1>DevDash</h1>
                <div className="header-right">
                    <div className="env-toggle">
                        <span className="toggle-label toggle-label-left" id="envLeftLabel">Dev</span>
                        <label className="switch">
                            <input type="checkbox" id="envToggle" />
                            <span className="slider round"></span>
                        </label>
                        <span className="toggle-label toggle-label-right" id="envRightLabel">Test</span>
                    </div>

                    <div className="pat-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>PAT Auth</span>
                    </div>
                </div>
            </div>

            <div>
                {isTestMode ? <TestDashboard /> : <Dashboard />}
            </div>

            <style>{`
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                }

                .pat-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    background: rgba(34, 197, 94, 0.15);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    border-radius: 20px;
                    color: #22c55e;
                    font-size: 13px;
                    font-weight: 500;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                @media (max-width: 768px) {
                    .header-right {
                        flex-direction: column;
                        align-items: flex-end;
                        gap: 12px;
                    }
                }
            `}</style>
        </div>
    );
};

// Main App Component
const App = () => {
    if (isPATTokenMode()) {
        return <PATModeDashboard />;
    }

    return (
        <AuthProvider>
            <ProtectedRoute>
                <AuthenticatedDashboardContent />
            </ProtectedRoute>
        </AuthProvider>
    );
};

export default App;
