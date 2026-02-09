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

## Data Flow

```
User Request → React Component → axios → .NET Controller → Service → External API
                                              ↓
                                    ConfigurationService
                                    ├── app.config.json (settings)
                                    └── secrets.config.json (PATs - server only)
```

## Project Structure

```
DevDash/
├── src/                              # React Frontend
│   ├── components/
│   │   ├── PipelineStatus.jsx        # CI/CD build status
│   │   ├── PRAlerts.jsx              # Pull request alerts
│   │   ├── CodeQuality.jsx           # SonarQube metrics
│   │   ├── PerformanceCard.jsx       # Personal dev stats
│   │   ├── AIAssistant.jsx           # Copilot/OpenAI chat
│   │   └── LighthouseMetrics.jsx     # Performance audits
│   ├── config/
│   │   ├── dashboards.js             # Dev/Test configs
│   │   └── featureFlags.js           # Feature toggles
│   └── api/backendClient.js          # API client
│
├── DevDash.API/                      # .NET Backend
│   ├── Controllers/                  # API endpoints
│   ├── Services/                     # Business logic
│   └── config/
│       ├── app.config.json           # Settings (committed)
│       └── secrets.config.json       # Secrets (gitignored)
```

## Configuration

### Backend - app.config.json
```json
{
  "services": {
    "azureDevOps": { "organization": "your-org", "project": "YourProject" }
  },
  "features": { "enableCopilot": true, "enableLighthouse": false }
}
```

### Backend - secrets.config.json (GITIGNORED)
```json
{
  "services": {
    "azureDevOps": { "pat": "YOUR_PAT" },
    "sonarQube": { "token": "YOUR_TOKEN" },
    "azureOpenAI": { "apiKey": "YOUR_KEY" }
  }
}
```

### Frontend - .env
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_ENV=dev
```

## Getting Started

```bash
# Backend
cd DevDash.API
cp config/secrets.config.json.template config/secrets.config.json
# Edit secrets.config.json with your credentials
dotnet run

# Frontend
npm install
npm run dev
```

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

- Secrets stored server-side only (never in frontend)
- Backend proxy pattern for all external API calls
- `secrets.config.json` is gitignored
