import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Custom hook for managing Dev/Test environment toggle
 * Uses CSS classes for smooth transitions without flickering
 */
export function useEnvironmentToggle() {
    const [isTestMode, setIsTestMode] = useState(false);
    const initialized = useRef(false);

    const updateEnvironment = useCallback((isTest) => {
        document.body.classList.remove('env-dev', 'env-test');
        document.body.classList.add(isTest ? 'env-test' : 'env-dev');

        const labelLeft = document.getElementById("envLeftLabel");
        const labelRight = document.getElementById("envRightLabel");
        const slider = document.querySelector(".slider");

        if (labelLeft && labelRight && slider) {
            if (isTest) {
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

        setIsTestMode(isTest);
    }, []);

    useEffect(() => {
        if (initialized.current) return;

        const toggle = document.getElementById("envToggle");
        if (!toggle) return;

        initialized.current = true;

        const handleChange = () => {
            updateEnvironment(toggle.checked);
        };

        toggle.addEventListener("change", handleChange);

        // Use requestAnimationFrame for initial render to prevent flickering
        requestAnimationFrame(() => {
            updateEnvironment(toggle.checked);
        });

        return () => {
            toggle.removeEventListener("change", handleChange);
        };
    }, [updateEnvironment]);

    return isTestMode;
}

export default useEnvironmentToggle;
