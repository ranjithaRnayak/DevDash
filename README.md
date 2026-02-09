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
│                                                                          │
│  Config: dashboards.js, featureFlags.js                                 │
│  .env: VITE_API_URL (no secrets)                                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (.NET 8 Web API)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Controllers                           Services                          │
│  ├── DevOpsController      ←──→       AzureDevOpsService                │
│  ├── PerformanceController ←──→       PerformanceService                │
│  ├── CopilotController     ←──→       CopilotChatService                │
│  ├── SonarQubeController   ←──→       SonarQubeService                  │
│  └── LighthouseController  ←──→       LighthouseService                 │
│                                                                          │
│  ConfigurationService                                                    │
│  ├── config/app.config.json      (settings - committed)                 │
│  └── config/secrets.config.json  (PATs, keys - GITIGNORED)              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Azure DevOps  │     │ GitHub/Copilot  │     │   SonarQube     │
│ /_apis/*      │     │ /copilot/chat   │     │ /api/measures   │
└───────────────┘     └─────────────────┘     └─────────────────┘
```

## Quick Start

### 1. Clone and Setup Backend

```bash
cd DevDash.API

# Copy the secrets template and fill in your credentials
cp config/secrets.config.json.template config/secrets.config.json
```

Edit `config/secrets.config.json`:
```json
{
  "authentication": {
    "entraId": {
      "clientId": "your-entra-client-id",
      "tenantId": "your-tenant-id"
    },
    "github": {
      "clientId": "your-github-oauth-client-id",
      "clientSecret": "your-github-oauth-client-secret"
    }
  },
  "services": {
    "azureDevOps": {
      "pat": "your-azure-devops-pat-token"
    },
    "sonarQube": {
      "token": "your-sonarqube-token"
    },
    "azureOpenAI": {
      "apiKey": "your-azure-openai-key"
    },
    "github": {
      "pat": "your-github-pat-for-copilot"
    }
  }
}
```

Update `config/app.config.json` with your org settings:
```json
{
  "services": {
    "azureDevOps": {
      "organization": "your-org",
      "project": "YourProject"
    }
  }
}
```

Run backend:
```bash
dotnet run
```

### 2. Setup Frontend

```bash
# From project root
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_ENV=dev

# OAuth Client IDs (safe to expose - not secrets)
VITE_ENTRA_CLIENT_ID=your-entra-client-id
VITE_ENTRA_TENANT_ID=your-tenant-id
VITE_GITHUB_CLIENT_ID=your-github-oauth-client-id
```

Run frontend:
```bash
npm install
npm run dev
```

Open http://localhost:5173

## Configuration Files

| File | Location | Purpose | Git Status |
|------|----------|---------|------------|
| `.env.example` | `/` | Frontend config template | Committed |
| `.env` | `/` | Frontend config (your values) | **Gitignored** |
| `app.config.json` | `/DevDash.API/config/` | Backend settings (org, project) | Committed |
| `secrets.config.json.template` | `/DevDash.API/config/` | Backend secrets template | Committed |
| `secrets.config.json` | `/DevDash.API/config/` | Backend secrets (your values) | **Gitignored** |

## API Endpoints

| Component | Endpoint |
|-----------|----------|
| PipelineStatus | `GET /api/devops/builds` |
| PRAlerts | `GET /api/devops/pullrequests` |
| CodeQuality | `GET /api/sonarqube/projects` |
| PerformanceCard | `GET /api/performance/dashboard` |
| AIAssistant | `POST /api/copilot/chat` |
| LighthouseMetrics | `GET /api/lighthouse/branches` |

## Security

- **Secrets server-side only**: PATs and API keys in `secrets.config.json` (gitignored)
- **Frontend safe**: Only OAuth client IDs in `.env` (not secrets)
- **Backend proxy**: All external API calls go through backend with server-side auth
