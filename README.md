# DevDash - Developer Productivity Dashboard

A developer dashboard integrating Azure DevOps, GitHub, SonarQube, and AI assistance for monitoring CI/CD pipelines, code quality, and team performance.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React + Vite)                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Dashboard.jsx / TestDashboard.jsx                                       │
│  ├── PipelineStatus.jsx  ──→  GET /api/devops/builds                    │
│  ├── PRAlerts.jsx        ──→  GET /api/devops/pullrequests              │
│  ├── CodeQuality.jsx     ──→  GET /api/sonarqube/projects               │
│  ├── PerformanceCard.jsx ──→  GET /api/performance/dashboard            │
│  ├── AIAssistant.jsx     ──→  POST /api/copilot/chat                    │
│  │                            POST /api/aiassistant/query               │
│  └── LighthouseMetrics   ──→  GET /api/lighthouse/branches              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (.NET 8 Web API)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Controllers ←──→ Services ←──→ External APIs                           │
│                                                                          │
│  Configuration (merged at startup):                                      │
│  ├── appsettings.json           (settings - COMMITTED)                  │
│  └── config/secrets.config.json (secrets - GITIGNORED)                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration (Only 2 Files Needed)

### How it works:
```
appsettings.json + secrets.config.json = Final Configuration
     (settings)         (secrets)              (merged)
```

The backend merges both files at startup. Values in `secrets.config.json` override `appsettings.json`.

---

### File 1: `appsettings.json` (Committed - Settings Only)

Location: `/DevDash.API/appsettings.json`

Contains: URLs, org names, project names, feature flags (no secrets)

```json
{
  "AzureDevOps": {
    "OrganizationUrl": "https://dev.azure.com/YOUR_ORG",
    "Project": "YOUR_PROJECT",
    "PAT": ""
  },
  "SonarQube": {
    "Url": "https://sonarqube.yourcompany.com",
    "Token": "",
    "Projects": "project-key-1,project-key-2"
  },
  "GitHub": {
    "ApiUrl": "https://github.yourcompany.com/api/v3",
    "ClientId": "",
    "ClientSecret": "",
    "PAT": ""
  },
  "FeatureFlags": {
    "UseAzureOpenAI": true,
    "UseCopilot": false
  }
}
```

---

### File 2: `secrets.config.json` (Gitignored - Secrets Only)

Location: `/DevDash.API/config/secrets.config.json`

**Setup:**
```bash
cd DevDash.API/config
cp secrets.config.json.template secrets.config.json
# Edit secrets.config.json with your values
```

Contains: PATs, API keys, client secrets

```json
{
  "AzureDevOps": {
    "PAT": "your-azure-devops-pat-token"
  },
  "SonarQube": {
    "Token": "your-sonarqube-token"
  },
  "AzureOpenAI": {
    "ApiKey": "your-azure-openai-key"
  },
  "GitHub": {
    "ClientSecret": "your-github-client-secret",
    "PAT": "your-github-pat"
  },
  "MicrosoftGraph": {
    "ClientSecret": "your-graph-client-secret"
  }
}
```

---

### File 3: `.env` (Gitignored - Frontend Only)

Location: `/.env`

**Setup:**
```bash
cp .env.example .env
# Edit .env with your values
```

Contains: API URL and OAuth client IDs (not secrets)

```env
VITE_API_URL=http://localhost:5000/api
VITE_ENTRA_CLIENT_ID=your-client-id
VITE_GITHUB_CLIENT_ID=your-github-client-id
```

---

## Quick Start

```bash
# 1. Backend setup
cd DevDash.API
cp config/secrets.config.json.template config/secrets.config.json
# Edit appsettings.json (org, project, URLs)
# Edit config/secrets.config.json (PATs, keys)
dotnet run

# 2. Frontend setup
cd ..
cp .env.example .env
# Edit .env (API URL, client IDs)
npm install
npm run dev
```

Open http://localhost:5173

## Configuration Summary

| File | Location | What to Put | Git Status |
|------|----------|-------------|------------|
| `appsettings.json` | `/DevDash.API/` | Org, project, URLs, feature flags | **Committed** |
| `secrets.config.json` | `/DevDash.API/config/` | PATs, API keys, client secrets | **Gitignored** |
| `.env` | `/` | API URL, OAuth client IDs | **Gitignored** |

## API Endpoints

| Component | Endpoint |
|-----------|----------|
| PipelineStatus | `GET /api/devops/builds` |
| PRAlerts | `GET /api/devops/pullrequests` |
| CodeQuality | `GET /api/sonarqube/projects` |
| PerformanceCard | `GET /api/performance/dashboard` |
| AIAssistant | `POST /api/copilot/chat` |
| LighthouseMetrics | `GET /api/lighthouse/branches` |
