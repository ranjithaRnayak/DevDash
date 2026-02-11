# DevDash - Developer Productivity Dashboard

A developer dashboard integrating Azure DevOps, GitHub, SonarQube, and AI assistance.

## Quick Start

```bash
# Windows
startup.bat

# Linux/Mac
./startup.sh

# Or using npm
npm install
npm run dev
```

---

## Configuration

### File Structure
```
appsettings.json       → Settings (URLs, repos, emails) - COMMITTED
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
    "Dev": {
      "Repos": "Repo1.API,Repo1.UI,Repo1.Services",
      "Pipelines": "CI-Build,CD-Deploy-Dev"
    },
    "Test": {
      "Repos": "Repo1.API,Repo1.UI,Repo1.Services",
      "Pipelines": "CI-Build,CD-Deploy-Test"
    }
  },

  "GitHub": {
    "ApiUrl": "https://api.github.com",
    "Owner": "YOUR_ORG",
    "Dev": { "Repos": "repo1,repo2" },
    "Test": { "Repos": "repo1,repo2" }
  },

  "PRAlerts": {
    "OverdueHours": 48,
    "OverdueEmail": {
      "To": ["team-lead@company.com", "manager@company.com"],
      "Cc": ["dev-team@company.com"],
      "Subject": "Overdue PR Alert - Action Required"
    }
  },

  "CodeReview": {
    "DefaultReviewers": [
      { "Name": "John Doe", "Email": "john.doe@company.com" },
      { "Name": "Jane Smith", "Email": "jane.smith@company.com" }
    ],
    "MeetingDurationMinutes": 30
  },

  "StoryPoints": {
    "IncludeTypes": ["User Story", "Product Backlog Item"],
    "ExcludeStates": ["Done", "Closed", "Removed"],
    "CurrentIterationOnly": true
  },

  "FeatureFlags": {
    "UseCopilot": false,
    "UsePATToken": true
  }
}
```

---

### 2. Backend Secrets: `secrets.config.json`

**Location:** `/DevDash.API/config/secrets.config.json`

```bash
cd DevDash.API/config
cp secrets.config.json.template secrets.config.json
```

```json
{
  "AzureDevOps": { "PAT": "YOUR_AZURE_DEVOPS_PAT" },
  "GitHub": { "PAT": "ghp_YOUR_GITHUB_PAT" },
  "SonarQube": { "Token": "YOUR_SONARQUBE_TOKEN" },
  "AzureOpenAI": { "ApiKey": "YOUR_AZURE_OPENAI_KEY" },
  "Copilot": { "ApiKey": "YOUR_COPILOT_KEY" }
}
```

---

## Configuration Reference

### Azure DevOps (Dev/Test Environments)

| Setting | Description |
|---------|-------------|
| `AzureDevOps.Dev.Repos` | Comma-separated repos for Dev environment |
| `AzureDevOps.Dev.Pipelines` | Comma-separated pipelines for Dev |
| `AzureDevOps.Test.Repos` | Comma-separated repos for Test environment |
| `AzureDevOps.Test.Pipelines` | Comma-separated pipelines for Test |

### PR Alerts & Overdue Notifications

| Setting | Description |
|---------|-------------|
| `PRAlerts.OverdueHours` | Hours before PR is considered overdue (default: 48) |
| `PRAlerts.OverdueEmail.To` | Email recipients for overdue alerts |
| `PRAlerts.OverdueEmail.Cc` | CC recipients for overdue alerts |

### Code Review Scheduling

| Setting | Description |
|---------|-------------|
| `CodeReview.DefaultReviewers` | Default reviewers (TO field) when scheduling |
| `CodeReview.MeetingDurationMinutes` | Default meeting duration |

### Story Points (Current Iteration)

| Setting | Description |
|---------|-------------|
| `StoryPoints.IncludeTypes` | Work item types to include |
| `StoryPoints.ExcludeStates` | States to exclude (Done, Closed) |
| `StoryPoints.CurrentIterationOnly` | Only show current sprint items |

---

## AI Provider Configuration

| Flag | AI Provider | Token Location |
|------|-------------|----------------|
| `UseCopilot: false` | Azure OpenAI | `secrets.config.json → AzureOpenAI.ApiKey` |
| `UseCopilot: true` | GitHub Copilot | `secrets.config.json → Copilot.ApiKey` |

---

## Features

| Feature | Description |
|---------|-------------|
| **Draft PRs** | Shows only PRs created by logged-in user |
| **Story Points** | Current iteration, excludes Done/Closed. Supports both StoryPoints (Scrum) and Effort (Agile/CMMI) fields |
| **Overdue PRs** | Alerts after 48 hours with email notification |
| **Code Review** | Schedule Teams meeting with default reviewers |
| **AI Assistant** | Azure OpenAI or GitHub Copilot |
| **Pipeline Status** | Clickable builds with direct links to Azure DevOps. Environment-based filtering (Dev/Test) |
| **Dual Auth** | Supports both PAT token and Entra ID authentication modes |
| **Team Resolution** | Automatically resolves user's team membership for sprint filtering |

---

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run frontend` | Start only Vite dev server |
| `npm run backend` | Start only .NET backend |
