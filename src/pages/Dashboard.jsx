import Header from "../components/Header";
import PipelineStatus from "../components/PipelineStatus";
import PRAlerts from "../components/PRAlerts";
import CodeQuality from "../components/CodeQuality";
import AIAssistant from "../components/AIAssistant";
import PerformanceCard from "../components/PerformanceCard";

export default function Dashboard() {
    return (

        <div className="container">
            <PipelineStatus />
            <PRAlerts />
            <CodeQuality />
            <PerformanceCard />
            <AIAssistant />
        </div>
      );
}