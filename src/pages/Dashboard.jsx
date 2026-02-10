import React, { memo } from 'react';
import PipelineStatus from '../components/PipelineStatus';
import PRAlerts from '../components/PRAlerts';
import CodeQuality from '../components/CodeQuality';
import AIAssistant from '../components/AIAssistant';
import PerformanceCard from '../components/PerformanceCard';
import { DASHBOARD_CONFIGS } from '../config/dashboards';

const dashboardConfig = DASHBOARD_CONFIGS.dev;

const Dashboard = memo(function Dashboard() {
    return (
        <div className="container">
            <div className="dashboard-header">
                <h1>{dashboardConfig.name}</h1>
                <p className="dashboard-description">{dashboardConfig.description}</p>
            </div>

            <div className="dashboard-grid">
                {dashboardConfig.features.showPipelineStatus && (
                    <PipelineStatus
                        dashboardId="dev"
                        pipelines={dashboardConfig.azureDevOps.pipelines}
                    />
                )}

                {dashboardConfig.features.showPRAlerts && (
                    <PRAlerts
                        dashboardId="dev"
                        repos={dashboardConfig.github.repos}
                    />
                )}

                {dashboardConfig.features.showCodeQuality && (
                    <CodeQuality dashboardId="dev" />
                )}

                {dashboardConfig.features.showPerformanceMetrics && (
                    <PerformanceCard dashboardId="dev" />
                )}

                {dashboardConfig.features.showAIAssistant && (
                    <AIAssistant dashboardId="dev" />
                )}
            </div>
        </div>
    );
});

export default Dashboard;
