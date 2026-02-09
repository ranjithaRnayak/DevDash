import { useEffect, useState } from 'react';

/**
 * Custom hook for managing Dev/Test environment toggle
 * Handles visual updates and state management for the environment switch
 */
export function useEnvironmentToggle() {
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

    return isTestMode;
}

export default useEnvironmentToggle;
