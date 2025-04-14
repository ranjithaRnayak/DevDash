// App.jsx
import React, { useEffect, useState } from 'react';
import './index.css';
import Dashboard from './pages/Dashboard';
import TestDashboard from './pages/TestDashboard';

const App = () => {
    const [isTestMode, setIsTestMode] = useState(false);
    useEffect(() => {
        const toggle = document.getElementById("envToggle");
        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");

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
                <h1>🚀 DevDash</h1>
                <div className="env-toggle">
                    <span className="toggle-label toggle-label-left" id="envLeftLabel">Dev</span>
                    <label className="switch">
                        <input type="checkbox" id="envToggle" />
                        <span className="slider round"></span>
                    </label>
                    <span className="toggle-label toggle-label-right" id="envRightLabel">Test</span>
                </div>
            </div>

            <div>
                {isTestMode ? (
                    <>
                        <TestDashboard />

                    </>
                ) : (
                    <>
                        <Dashboard />
                    </>
                )}
            </div>
        </div>

    );
};

export default App;

