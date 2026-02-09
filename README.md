# DevDash - Developer Productivity Dashboard

A modern developer dashboard that integrates Azure DevOps, GitHub, SonarQube, and AI-powered assistance into a unified interface for monitoring CI/CD pipelines, code quality, and team performance.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND                                       │
│                              (React + Vite)                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Dashboard  │  │    Test     │  │  Components │  │      Config             │ │
│  │   (Dev)     │  │  Dashboard  │  │             │  │                         │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────────────────┤ │
│  │ Pipeline    │  │ Pipeline    │  │ AIAssistant │  │ dashboards.js           │ │
│  │ Status      │  │ Status      │  │ (Copilot +  │  │ featureFlags.js         │ │
│  │ PRAlerts    │  │ PRAlerts    │  │  OpenAI)    │  │                         │ │
│  │ CodeQuality │  │ CodeQuality │  │             │  │ .env (non-sensitive)    │ │
│  │ Performance │  │ Lighthouse  │  │ Lighthouse  │  │ - VITE_API_URL          │ │
│  │ Card        │  │ Metrics     │  │ Metrics     │  │ - VITE_APP_ENV          │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                        │                                         │
│                          ┌─────────────┴─────────────┐                          │
│                          │    API Client (Axios)     │                          │
│                          │  backendClient.js         │                          │
│                          │  - Auth interceptors      │                          │
│                          │  - Token management       │                          │
│                          └─────────────┬─────────────┘                          │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │ HTTPS
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   BACKEND                                        │
│                            (.NET 8 Web API)                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         API Controllers                                  │    │
│  ├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤    │
│  │   DevOps     │  Performance │   Copilot    │  Lighthouse  │  SonarQube  │    │
│  │  Controller  │  Controller  │  Controller  │  Controller  │  Controller │    │
│  │              │              │              │              │             │    │
│  │ /builds     │ /dashboard   │ /chat        │ /audit       │ /projects   │    │
│  │ /pullrequests│ /draft-prs  │ /context     │ /branches    │ /config     │    │
│  │              │ /commits    │ /status      │ /history     │             │    │
│  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘    │
│         │              │              │              │              │           │
│  ┌──────┴───────┬──────┴───────┬──────┴───────┬──────┴───────┬──────┴──────┐    │
│  │              │              │              │              │             │    │
│  │  AzureDevOps │ Performance  │  Copilot     │  Lighthouse  │  SonarQube  │    │
│  │   Service    │   Service    │ ChatService  │   Service    │   Service   │    │
│  │              │              │              │              │             │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘    │
│                                        │                                         │
│  ┌─────────────────────────────────────┴───────────────────────────────────┐    │
│  │                      Configuration Service                               │    │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │    │
│  │  │  config/                                                         │    │    │
│  │  │  ├── app.config.json      (Non-sensitive settings)              │    │    │
│  │  │  │   ├── authentication.entraId.clientId                        │    │    │
│  │  │  │   ├── services.azureDevOps.organization                      │    │    │
│  │  │  │   ├── dashboards.dev/test                                    │    │    │
│  │  │  │   └── features.*                                             │    │    │
│  │  │  │                                                               │    │    │
│  │  │  └── secrets.config.json  (GITIGNORED - Sensitive secrets)      │    │    │
│  │  │      ├── services.azureDevOps.pat                               │    │    │
│  │  │      ├── services.sonarQube.token                               │    │    │
│  │  │      ├── services.azureOpenAI.apiKey                            │    │    │
│  │  │      └── authentication.github.clientSecret                     │    │    │
│  │  └─────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     Azure DevOps        │  │       GitHub            │  │      SonarQube          │
│                         │  │                         │  │                         │
│  /_apis/connectionData  │  │  /api/v3/user          │  │  /api/measures          │
│  /_apis/build/builds    │  │  /api/v3/repos         │  │  /api/projects          │
│  /_apis/git/pullrequests│  │  /copilot/chat         │  │  /api/qualitygates      │
│  /_apis/wit/wiql        │  │                         │  │                         │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
                    │                    │                    │
                    ▼                    ▼                    ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│    Azure OpenAI         │  │   Microsoft Graph       │  │     Elasticsearch       │
│                         │  │                         │  │                         │
│  /openai/deployments/   │  │  /me/onlineMeetings    │  │  Issues Index           │
│  /chat/completions      │  │  (Teams scheduling)     │  │  Resolutions Index      │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. User Login (Microsoft Entra ID OAuth 2.0)                                 │
│    ┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│    │ Browser │───▶│ /auth/login │───▶│ Entra ID     │───▶│ JWT Token   │    │
│    └─────────┘    └─────────────┘    │ OAuth Flow   │    │ Stored      │    │
│                                      └──────────────┘    └─────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 2. Dashboard Load                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐       │
│    │  React App                                                       │       │
│    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │       │
│    │  │ Dashboard   │  │ dashboards  │  │ Feature Flags           │  │       │
│    │  │ Component   │◀─│ .js config  │  │ (dev/test/prod)         │  │       │
│    │  └──────┬──────┘  └─────────────┘  └─────────────────────────┘  │       │
│    │         │                                                        │       │
│    │         ▼                                                        │       │
│    │  ┌─────────────────────────────────────────────────────────┐    │       │
│    │  │ Parallel API Calls via backendClient.js                 │    │       │
│    │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │    │       │
│    │  │ │/devops/ │ │/sonar   │ │/perform │ │/copilot/status  │ │    │       │
│    │  │ │builds   │ │/projects│ │/dashboard│                   │ │    │       │
│    │  │ └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘ │    │       │
│    │  └──────┼───────────┼───────────┼───────────────┼──────────┘    │       │
│    └─────────┼───────────┼───────────┼───────────────┼───────────────┘       │
└──────────────┼───────────┼───────────┼───────────────┼───────────────────────┘
               │           │           │               │
               ▼           ▼           ▼               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 3. Backend Processing (All Secrets Handled Server-Side)                       │
│    ┌─────────────────────────────────────────────────────────────────┐       │
│    │  ConfigurationService loads:                                     │       │
│    │  • app.config.json (settings)                                   │       │
│    │  • secrets.config.json (PATs, API keys) ← NEVER sent to frontend│       │
│    └─────────────────────────────────────────────────────────────────┘       │
│                                      │                                        │
│    ┌─────────────────────────────────┴────────────────────────────────┐      │
│    │                    Service Layer                                  │      │
│    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │      │
│    │  │ DevOpsService│  │PerformService│  │ CopilotChatService   │   │      │
│    │  │ + PAT Auth   │  │ + User ID    │  │ + GitHub Token       │   │      │
│    │  │ (Basic Auth) │  │   Resolution │  │   (OAuth/PAT)        │   │      │
│    │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │      │
│    │         │                 │                      │               │      │
│    │         ▼                 ▼                      ▼               │      │
│    │  ┌──────────────────────────────────────────────────────────┐   │      │
│    │  │              External API Calls (Server-Side Only)       │   │      │
│    │  │  Azure DevOps ◄──► PerformanceService                    │   │      │
│    │  │  GitHub API ◄──► CopilotChatService                      │   │      │
│    │  │  SonarQube ◄──► SonarQubeController                      │   │      │
│    │  └──────────────────────────────────────────────────────────┘   │      │
│    └─────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ 4. AI Query Flow                                                              │
│    ┌───────────────────────────────────────────────────────────────────┐     │
│    │  User asks: "Why did the pipeline fail?"                          │     │
│    │                           │                                        │     │
│    │                           ▼                                        │     │
│    │  ┌─────────────────────────────────────────────────────────────┐  │     │
│    │  │  AIAssistant.jsx                                             │  │     │
│    │  │  ┌─────────────────┐                                         │  │     │
│    │  │  │ Provider Select │──▶ auto / copilot / openai              │  │     │
│    │  │  └────────┬────────┘                                         │  │     │
│    │  │           │                                                   │  │     │
│    │  │           ▼                                                   │  │     │
│    │  │  ┌─────────────────┐    ┌─────────────────────────────────┐  │  │     │
│    │  │  │ copilotAPI.chat │───▶│ Backend: /api/copilot/chat      │  │  │     │
│    │  │  └─────────────────┘    │ • Builds context (failures,PRs) │  │  │     │
│    │  │                          │ • Sends to GitHub Copilot API   │  │  │     │
│    │  │                          │ • Returns AI response           │  │  │     │
│    │  │                          └─────────────────────────────────┘  │  │     │
│    │  │           OR                                                  │  │     │
│    │  │  ┌─────────────────┐    ┌─────────────────────────────────┐  │  │     │
│    │  │  │ aiAPI.query     │───▶│ Backend: /api/aiassistant/query │  │  │     │
│    │  │  └─────────────────┘    │ • Searches Elasticsearch        │  │  │     │
│    │  │                          │ • Calls Azure OpenAI            │  │  │     │
│    │  │                          │ • Returns with related issues   │  │  │     │
│    │  │                          └─────────────────────────────────┘  │  │     │
│    │  └─────────────────────────────────────────────────────────────┘  │     │
│    └───────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Axios |
| **Backend** | .NET 8 Web API, C# |
| **Authentication** | Microsoft Entra ID (Azure AD), OAuth 2.0 |
| **AI Services** | Azure OpenAI, GitHub Copilot Chat |
| **DevOps Integration** | Azure DevOps REST API, GitHub API |
| **Code Quality** | SonarQube API |
| **Search** | Elasticsearch |
| **Caching** | Redis (optional), In-Memory fallback |
| **Database** | SQL Server (optional) |

## Features

### Dashboard Components
- **Pipeline Status** - Real-time CI/CD build status from Azure DevOps
- **PR Alerts** - Open pull requests requiring attention
- **Code Quality** - SonarQube metrics (bugs, vulnerabilities, code smells)
- **Performance Card** - Personal metrics (draft PRs, commits, story points)
- **AI Assistant** - Natural language queries powered by Copilot/OpenAI
- **Lighthouse Metrics** - Performance audits for branch deployments

### Security Features
- All sensitive credentials stored server-side only
- Frontend never receives PATs, API keys, or client secrets
- OAuth 2.0 authentication with Microsoft Entra ID
- Token-based authorization for all API calls
- Secrets file gitignored by default

## Project Structure

```
DevDash/
├── src/                          # React Frontend
│   ├── components/
│   │   ├── AIAssistant.jsx       # AI chat with Copilot integration
│   │   ├── PipelineStatus.jsx    # Build status display
│   │   ├── PRAlerts.jsx          # Pull request notifications
│   │   ├── CodeQuality.jsx       # SonarQube metrics
│   │   ├── PerformanceCard.jsx   # Personal developer stats
│   │   └── LighthouseMetrics.jsx # Performance scores
│   ├── pages/
│   │   ├── Dashboard.jsx         # Dev dashboard
│   │   └── TestDashboard.jsx     # Test dashboard
│   ├── config/
│   │   ├── dashboards.js         # Dashboard configurations
│   │   └── featureFlags.js       # Feature toggles
│   ├── api/
│   │   ├── apiClient.js          # Base axios client
│   │   └── backendClient.js      # Typed API methods
│   └── index.css                 # Global styles
│
├── DevDash.API/                  # .NET Backend
│   ├── Controllers/
│   │   ├── DevOpsController.cs
│   │   ├── PerformanceController.cs
│   │   ├── CopilotController.cs
│   │   ├── LighthouseController.cs
│   │   └── SonarQubeController.cs
│   ├── Services/
│   │   ├── ConfigurationService.cs
│   │   ├── PerformanceService.cs
│   │   ├── CopilotChatService.cs
│   │   └── LighthouseService.cs
│   ├── config/
│   │   ├── app.config.json           # Non-sensitive settings
│   │   └── secrets.config.json.template  # Secret template
│   └── Program.cs
│
└── .gitignore                    # Excludes secrets.config.json
```

## Configuration

### Backend Configuration (app.config.json)

```json
{
  "authentication": {
    "entraId": {
      "clientId": "YOUR_CLIENT_ID",
      "tenantId": "YOUR_TENANT_ID"
    }
  },
  "services": {
    "azureDevOps": {
      "organization": "your-org",
      "project": "YourProject"
    }
  },
  "features": {
    "enableCopilot": true,
    "enableLighthouse": false
  },
  "dashboards": {
    "dev": {
      "pipelines": ["CI-Pipeline", "Nightly-Build"]
    },
    "test": {
      "pipelines": ["Integration-Tests", "E2E-Tests"]
    }
  }
}
```

### Secrets Configuration (secrets.config.json)

Copy `secrets.config.json.template` to `secrets.config.json` and fill in:

```json
{
  "services": {
    "azureDevOps": { "pat": "YOUR_PAT" },
    "sonarQube": { "token": "YOUR_TOKEN" },
    "azureOpenAI": { "apiKey": "YOUR_KEY" },
    "github": { "clientSecret": "YOUR_SECRET" }
  }
}
```

**Important**: `secrets.config.json` is gitignored and should never be committed.

### Frontend Configuration (.env)

```env
# Only non-sensitive configuration
VITE_API_URL=http://localhost:5000/api
VITE_APP_ENV=dev
VITE_USE_PAT_TOKEN=false
```

## Getting Started

### Prerequisites
- Node.js 18+
- .NET 8 SDK
- Azure DevOps organization with PAT
- (Optional) GitHub Enterprise with Copilot
- (Optional) SonarQube instance

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-org/DevDash.git
cd DevDash
```

2. Setup backend
```bash
cd DevDash.API
cp config/secrets.config.json.template config/secrets.config.json
# Edit secrets.config.json with your credentials
dotnet restore
dotnet run
```

3. Setup frontend
```bash
cd ..
npm install
cp .env.example .env
# Edit .env with your API URL
npm run dev
```

4. Open http://localhost:5173

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/devops/builds` | Recent pipeline builds |
| `GET /api/devops/pullrequests` | Open pull requests |
| `GET /api/performance/dashboard` | User's performance metrics |
| `POST /api/copilot/chat` | AI chat with context |
| `GET /api/sonarqube/projects` | Code quality metrics |
| `GET /api/lighthouse/branches` | Performance audit results |

## Security Best Practices

1. **Never commit secrets** - All tokens are in gitignored files
2. **Backend proxy pattern** - Frontend never calls external APIs directly
3. **Token validation** - All requests validated against Entra ID
4. **Audit logging** - API requests logged for security review
5. **Rate limiting** - Prevents abuse of AI endpoints

## License

MIT License - See LICENSE file for details
