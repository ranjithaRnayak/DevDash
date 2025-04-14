import Header from "../components/Header";
import PipelineStatus from "../components/PipelineStatus";

import AIAssistant from "../components/AIAssistant";


export default function TestDashboard() {
    return (

        <div className="container">
            <PipelineStatus />
            <AIAssistant />
        </div>
    );
}