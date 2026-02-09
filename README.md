# DevDash - Developer Productivity Dashboard

A developer dashboard integrating Azure DevOps, GitHub, SonarQube, and AI assistance.

## Quick Start

```bash
# Install concurrently if not already installed
npm install

# Start both backend and frontend
npm run dev
```

This runs the .NET backend and Vite frontend concurrently.

---

## Configuration

### File Structure
```
appsettings.json       → Settings (URLs, repos, feature flags) - COMMITTED
secrets.config.json    → Secrets (PATs, API keys) - GITIGNORED
.env                   → Frontend config (API URL) - GITIGNORED
```

---

### 1. Backend Settings: `appsettings.json`

**Location:** `/DevDash.API/appsettings.json`

```json
{
  "AzureDevOps": {
    "OrganizationUrl": "https://dev.azure.com/YOUR_ORG",
    "Project": "YOUR_PROJECT",
    "Pipelines": {
      "Dev": {
        "Repos": "Repo1.API,Repo1.UI,Repo1.DevOps",
        "BuildDefinitionIds": "1,2,3"
      },
      "Test": {
        "Repos": "Repo1.API,Repo1.UI,Repo1.DevOps",
        "BuildDefinitionIds": "4,5,6"
      }
    }
  },

  "GitHub": {
    "ApiUrl": "https://github.yourcompany.com/api/v3",
    "Owner": "YOUR_ORG",
    "Repo": "YOUR_REPO",
    "Pipelines": {
      "Dev": {
        "Repos": "repo1,repo2",
        "WorkflowIds": "build.yml,deploy-dev.yml"
      },
      "Test": {
        "Repos": "repo1,repo2",
        "WorkflowIds": "build.yml,deploy-test.yml"
      }
    }
  },

  "PRAlerts": {
    "Approvers": [
      { "Name": "John Doe", "Email": "john.doe@company.com" },
      { "Name": "Jane Smith", "Email": "jane.smith@company.com" }
    ],
    "NotificationEmails": [
      "team-lead@company.com",
      "dev-team@company.com"
    ],
    "StalePRDays": 7,
    "RequiredApprovers": 2
  },

  "FeatureFlags": {
    "UseAzureOpenAI": true,
    "UseCopilot": false
  }
}
```

---

### 2. Backend Secrets: `secrets.config.json`

**Location:** `/DevDash.API/config/secrets.config.json`

**Setup:**
```bash
cd DevDash.API/config
cp secrets.config.json.template secrets.config.json
```

```json
{
  "AzureAd": {
    "TenantId": "YOUR_TENANT_ID",
    "ClientId": "YOUR_CLIENT_ID"
  },
  "AzureDevOps": {
    "PAT": "YOUR_AZURE_DEVOPS_PAT"
  },
  "GitHub": {
    "ClientId": "YOUR_GITHUB_OAUTH_CLIENT_ID",
    "ClientSecret": "YOUR_GITHUB_OAUTH_CLIENT_SECRET",
    "PAT": "YOUR_GITHUB_PAT"
  },
  "AzureOpenAI": {
    "ApiKey": "YOUR_AZURE_OPENAI_KEY"
  },
  "Copilot": {
    "ApiKey": "YOUR_GITHUB_COPILOT_API_KEY"
  },
  "SonarQube": {
    "Token": "YOUR_SONARQUBE_TOKEN"
  },
  "MicrosoftGraph": {
    "TenantId": "YOUR_TENANT_ID",
    "ClientId": "YOUR_GRAPH_CLIENT_ID",
    "ClientSecret": "YOUR_GRAPH_CLIENT_SECRET"
  }
}
```

---

### 3. Frontend Config: `.env`

**Setup:**
```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_USE_PAT_TOKEN=false
VITE_GITHUB_OAUTH_ENABLED=true
```

---

## AI Provider Configuration

The AI Assistant uses either Azure OpenAI or GitHub Copilot based on the `FeatureFlags.UseCopilot` setting:

| Flag | AI Provider | Token Location |
|------|-------------|----------------|
| `UseCopilot: false` | Azure OpenAI | `secrets.config.json → AzureOpenAI.ApiKey` |
| `UseCopilot: true` | GitHub Copilot | `secrets.config.json → Copilot.ApiKey` |

---

## Component → Configuration Mapping

| Component | Config Section | What to Configure |
|-----------|---------------|-------------------|
| **PipelineStatus** | `AzureDevOps.Pipelines` | Repos and build IDs for Dev/Test |
| **PRAlerts** | `PRAlerts.Approvers` | List of approvers with email |
| **PRAlerts** | `PRAlerts.NotificationEmails` | Email addresses for notifications |
| **AIAssistant** | `FeatureFlags.UseCopilot` | `true` = Copilot, `false` = Azure OpenAI |
| **GitHub PRs** | `GitHub.Owner`, `GitHub.Repo` | GitHub org and repo |
| **Azure PRs** | `AzureDevOps.Project` | Azure DevOps project name |

---

## Architecture

```
Frontend (React + Vite)
├── Dashboard.jsx / TestDashboard.jsx
│   ├── PipelineStatus.jsx  → GET /api/devops/builds
│   ├── PRAlerts.jsx        → GET /api/devops/pullrequests
│   ├── CodeQuality.jsx     → GET /api/sonarqube/projects
│   ├── PerformanceCard.jsx → GET /api/performance/dashboard
│   ├── AIAssistant.jsx     → POST /api/aiassistant/query (or /copilot/chat)
│   └── LighthouseMetrics   → GET /api/lighthouse/branches
│
Backend (.NET 8)
├── Controllers → Services → External APIs
└── Config: appsettings.json + secrets.config.json (merged)
```

---

## GitHubConnect vs AIAssistant

| Component | Purpose |
|-----------|---------|
| **GitHubConnect** | OAuth/PAT authentication for GitHub DevOps features (PRs, commits, repos) |
| **AIAssistant** | AI chat using Azure OpenAI or GitHub Copilot API |

These serve different purposes - GitHubConnect is for DevOps data, AIAssistant is for AI queries.

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run frontend` | Start only Vite dev server |
| `npm run backend` | Start only .NET backend |
| `npm run build` | Build frontend for production |
