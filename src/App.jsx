// App.jsx
import React, { useEffect, useState } from 'react';
import './index.css';
import Dashboard from './pages/Dashboard';
import TestDashboard from './pages/TestDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { isPATTokenMode } from './config/featureFlags';

// Dashboard Content Component (with user info when logged in)
const AuthenticatedDashboardContent = () => {
    const { user, logout, authMethod } = useAuth();
    const [isTestMode, setIsTestMode] = useState(false);

    useEffect(() => {
        const toggle = document.getElementById("envToggle");
        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");

        if (!toggle || !labelLeft || !labelRight || !slider) return;

        const updateLabel = () => {
            if (toggle.checked) {
                // TEST selected
                labelLeft.style.color = "#ccc";
                labelLeft.style.fontSize = "14px";

                labelRight.style.color = "#3b82f6";
                labelRight.style.fontSize = "16px";
                document.body.style.backgroundColor = "#1b324f";
                slider.style.backgroundColor = "#3b82f6";
            } else {
                // DEV selected
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

    const getAuthMethodDisplay = () => {
        if (!authMethod) return '';
        if (authMethod.startsWith('oauth_')) {
            const provider = authMethod.replace('oauth_', '');
            return `via ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
        }
        return 'via Email';
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
                                <span className="user-auth-method">{getAuthMethodDisplay()}</span>
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
                {isTestMode ? (
                    <TestDashboard />
                ) : (
                    <Dashboard />
                )}
            </div>

            <style>{`
                .header-right {
                    display: flex;
                    align-items: center;
                    gap: 24px;
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
                    background: linear-gradient(135deg, #22c55e, #16a34a);
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
                // TEST selected
                labelLeft.style.color = "#ccc";
                labelLeft.style.fontSize = "14px";

                labelRight.style.color = "#3b82f6";
                labelRight.style.fontSize = "16px";
                document.body.style.backgroundColor = "#1b324f";
                slider.style.backgroundColor = "#3b82f6";
            } else {
                // DEV selected
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

                    {/* PAT Token Badge */}
                    <div className="pat-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>PAT Auth</span>
                    </div>
                </div>
            </div>

            <div>
                {isTestMode ? (
                    <TestDashboard />
                ) : (
                    <Dashboard />
                )}
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
    // Check if PAT token mode is enabled
    if (isPATTokenMode()) {
        // PAT Token Mode: No login required, uses existing PAT authentication
        return <PATModeDashboard />;
    }

    // Login Mode: Requires authentication via OAuth or email/password
    return (
        <AuthProvider>
            <ProtectedRoute>
                <AuthenticatedDashboardContent />
            </ProtectedRoute>
        </AuthProvider>
    );
};

export default App;
