import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PAT = import.meta.env.VITE_AZDO_PAT;
const AZURE_ORG = import.meta.env.VITE_AZDO_ORG_URL;
const AZURE_PROJECT = import.meta.env.VITE_AZDO_PROJECT;
const ALLOWED_NAMES = import.meta.env.VITE_AZDO_PIPELINES?.split(',').map(p => p.trim());

const PipelineStatus = () => {
    const [builds, setBuilds] = useState([]);

    useEffect(() => {
        const fetchBuilds = async () => {
            try {
                // 🔍 Step 1: Get pipeline definitions
                const defRes = await axios.get(
                    `${AZURE_ORG}/${AZURE_PROJECT}/_apis/build/definitions?api-version=7.0`,
                    {
                        headers: {
                            Authorization: `Basic ${btoa(':' + PAT)}`
                        }
                    }
                );

                const definitions = defRes.data.value;
                const filteredDefs = definitions.filter(def => ALLOWED_NAMES.includes(def.name));
                const definitionIds = filteredDefs.map(def => def.id);

                if (definitionIds.length === 0) {
                    console.warn("⚠️ No matching pipeline definitions found!");
                    return;
                }

                // 🧱 Step 2: Fetch builds for filtered definitions
                const buildsRes = await axios.get(
                    `${AZURE_ORG}/${AZURE_PROJECT}/_apis/build/builds?definitions=${definitionIds.join(',')}&queryOrder=queueTimeDescending&$top=20&api-version=7.0`,
                    {
                        headers: {
                            Authorization: `Basic ${btoa(':' + PAT)}`
                        }
                    }
                );

                setBuilds(buildsRes.data.value);
            } catch (err) {
                console.error('❌ Error fetching builds:', err);
            }
        };

        fetchBuilds();
    }, []);

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'succeeded': return 'badge badge-success';
            case 'failed': return 'badge badge-danger';
            case 'inprogress': return 'badge badge-warning';
            default: return 'badge';
        }
    };

    return (
        <div className="pipeline-alerts-card">
            <h2>🚀 Pipeline Builds</h2>
            {builds.length === 0 && <p>Loading builds...</p>}

            <div className="table-header">
                <div>Build Name</div>
                <div>Status</div>
                <div>Duration</div>
            </div>

            <div className="pipeline-scroll">
                {builds.map((b) => {
                    const start = new Date(b.startTime);
                    const finish = new Date(b.finishTime);
                    const duration = (finish - start) > 0
                        ? ((finish - start) / 1000).toFixed(1) + 's'
                        : '...';
                    const fullBranch = b.sourceBranch?.replace('refs/heads/', '');

                    return (
                        <div
                            className="table-row"
                            key={b.id}
                            title={`Branch: ${fullBranch}`}
                        >
                            <div>{b.definition?.name || 'N/A'}</div>
                            <div>
                                <span className={getStatusClass(b.result)}>
                                    {b.result || b.status}
                                </span>
                            </div>
                            <div>{duration}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PipelineStatus;