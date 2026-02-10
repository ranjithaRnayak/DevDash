import { useEffect, useState, useRef } from 'react';

/**
 * Custom hook for managing Dev/Test environment toggle
 * Uses CSS classes for smooth transitions without flickering
 */
export function useEnvironmentToggle() {
    const [isTestMode, setIsTestMode] = useState(() => {
        // Initialize from localStorage if available
        const saved = localStorage.getItem('devdash_env_mode');
        return saved === 'test';
    });
    const initialized = useRef(false);
    const listenerAttached = useRef(false);

    useEffect(() => {
        // Set initial body class immediately
        if (!initialized.current) {
            initialized.current = true;
            document.body.classList.add(isTestMode ? 'env-test' : 'env-dev');
        }
    }, []);

    useEffect(() => {
        // Update body class when mode changes
        document.body.classList.remove('env-dev', 'env-test');
        document.body.classList.add(isTestMode ? 'env-test' : 'env-dev');

        // Persist to localStorage
        localStorage.setItem('devdash_env_mode', isTestMode ? 'test' : 'dev');

        // Update toggle UI elements
        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");
        const toggle = document.getElementById("envToggle");

        if (toggle && toggle.checked !== isTestMode) {
            toggle.checked = isTestMode;
        }

        if (labelLeft && labelRight && slider) {
            if (isTestMode) {
                labelLeft.style.color = "#ccc";
                labelLeft.style.fontSize = "14px";
                labelRight.style.color = "#3b82f6";
                labelRight.style.fontSize = "16px";
                slider.style.backgroundColor = "#3b82f6";
            } else {
                labelLeft.style.color = "#22c55e";
                labelLeft.style.fontSize = "16px";
                labelRight.style.color = "#ccc";
                labelRight.style.fontSize = "14px";
                slider.style.backgroundColor = "#22c55e";
            }
        }
    }, [isTestMode]);

    useEffect(() => {
        if (listenerAttached.current) return;

        const toggle = document.getElementById("envToggle");
        if (!toggle) return;

        listenerAttached.current = true;

        const handleChange = (e) => {
            setIsTestMode(e.target.checked);
        };

        toggle.addEventListener("change", handleChange);

        // Sync toggle with state
        toggle.checked = isTestMode;

        return () => {
            toggle.removeEventListener("change", handleChange);
            listenerAttached.current = false;
        };
    });

    return isTestMode;
}

export default useEnvironmentToggle;
