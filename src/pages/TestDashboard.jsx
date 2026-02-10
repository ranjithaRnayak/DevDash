import React, { memo } from 'react';
import PipelineStatus from '../components/PipelineStatus';
import PRAlerts from '../components/PRAlerts';
import CodeQuality from '../components/CodeQuality';
import AIAssistant from '../components/AIAssistant';
import { DASHBOARD_CONFIGS } from '../config/dashboards';

const dashboardConfig = DASHBOARD_CONFIGS.test;

const TestDashboard = memo(function TestDashboard() {
    return (
        <div className="container">
            <div className="dashboard-header">
                <h1>{dashboardConfig.name}</h1>
                <p className="dashboard-description">{dashboardConfig.description}</p>
            </div>

            <div className="dashboard-grid">
                {dashboardConfig.features.showPipelineStatus && (
                    <PipelineStatus
                        dashboardId="test"
                        pipelines={dashboardConfig.azureDevOps.pipelines}
                    />
                )}

                {dashboardConfig.features.showPRAlerts && (
                    <PRAlerts
                        dashboardId="test"
                        repos={dashboardConfig.github.repos}
                    />
                )}

                {dashboardConfig.features.showCodeQuality && (
                    <CodeQuality dashboardId="test" />
                )}

                {dashboardConfig.features.showAIAssistant && (
                    <AIAssistant dashboardId="test" />
                )}
            </div>
        </div>
    );
});

export default TestDashboard;
