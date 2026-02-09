# DevDash - Code Flow & Architecture

## Project Overview

DevDash is a developer productivity dashboard that integrates:
- **Azure DevOps** - Pipelines, PRs, Work Items
- **GitHub** - Repositories, PRs, Actions
- **SonarQube** - Code Quality Metrics
- **AI Assistance** - Azure OpenAI or GitHub Copilot

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐     │
│  │  App.jsx    │───▶│  AuthContext.jsx                        │     │
│  │             │    │  - Manages authentication state          │     │
│  │  ├─ PAT Mode│    │  - Provides login/logout methods         │     │
│  │  └─ Entra ID│    │  - Stores tokens in localStorage         │     │
│  └─────────────┘    └─────────────────────────────────────────┘     │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Dashboard.jsx / TestDashboard.jsx                          │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │    │
│  │  │PipelineStatus│ │  PRAlerts    │ │ CodeQuality  │        │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │    │
│  │  │PerformanceCard│ │ AIAssistant │ │LighthouseMetrics│     │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  backendClient.js - Centralized API Client                  │    │
│  │  - Axios instance with auth interceptors                    │    │
│  │  - All API calls go through here                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (.NET 8 Web API)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Controllers (HTTP Entry Points)                            │    │
│  │  ├── AuthController        /api/auth/*                      │    │
│  │  ├── DevOpsController      /api/devops/*                    │    │
│  │  ├── PerformanceController /api/performance/*               │    │
│  │  ├── AIAssistantController /api/aiassistant/*               │    │
│  │  ├── CopilotController     /api/copilot/*                   │    │
│  │  ├── SonarQubeController   /api/sonarqube/*                 │    │
│  │  ├── LighthouseController  /api/lighthouse/*                │    │
│  │  └── HealthController      /api/health/*                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Services (Business Logic)                                  │    │
│  │  ├── DevOpsService         - Azure DevOps/GitHub API calls  │    │
│  │  ├── PerformanceService    - User-specific metrics          │    │
│  │  ├── AIServiceRouter       - Routes to OpenAI or Copilot    │    │
│  │  ├── AzureOpenAIService    - Azure OpenAI integration       │    │
│  │  ├── CopilotService        - GitHub Copilot integration     │    │
│  │  ├── CopilotChatService    - Copilot Chat with context      │    │
│  │  ├── CacheService          - Redis or In-Memory cache       │    │
│  │  ├── IssueSearchService    - Elasticsearch for issues       │    │
│  │  └── ConfigurationService  - Centralized config access      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  External APIs                                              │    │
│  │  ├── Azure DevOps REST API                                  │    │
│  │  ├── GitHub REST API                                        │    │
│  │  ├── SonarQube API                                          │    │
│  │  ├── Azure OpenAI API                                       │    │
│  │  ├── GitHub Copilot API                                     │    │
│  │  └── Microsoft Graph API (Teams meetings)                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Code Flows

### 1. PipelineStatus.jsx

**Purpose**: Display CI/CD pipeline build status

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
                            PipelineStatus.jsx
                                   │
                                   │ useEffect (on mount)
                                   ▼
                            devOpsAPI.getBuilds(20)
                                   │
                                   │ GET /api/devops/builds?count=20
                                   ▼
                            DevOpsController.GetBuilds()
                                   │
                                   ▼
                            DevOpsService.GetRecentBuildsAsync()
                                   │
                                   │ Calls Azure DevOps API:
                                   │ {org}/{project}/_apis/build/builds
                                   ▼
                            Returns: List<Build>
                                   │
                                   ▼
                            Renders build cards with status
```

**Configuration Used**:
- `AzureDevOps.OrganizationUrl`
- `AzureDevOps.Project`
- `AzureDevOps.Dev.Pipelines` or `AzureDevOps.Test.Pipelines`

---

### 2. PRAlerts.jsx

**Purpose**: Show open pull requests with aging alerts

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
                            PRAlerts.jsx
                                   │
                                   │ useEffect (on mount)
                                   ▼
                            devOpsAPI.getPullRequests('open')
                                   │
                                   │ GET /api/devops/pullrequests?status=open
                                   ▼
                            DevOpsController.GetPullRequests()
                                   │
                                   ▼
                            DevOpsService.GetPullRequestsAsync()
                                   │
                                   │ Calls Azure DevOps + GitHub APIs
                                   ▼
                            Returns: Combined PR list
                                   │
                                   ▼
                            Calculates overdue (>48 hours)
                            Renders PR cards with age indicator
```

**Configuration Used**:
- `PRAlerts.OverdueHours` (default: 48)
- `PRAlerts.OverdueEmail.To`, `PRAlerts.OverdueEmail.Cc`

---

### 3. PerformanceCard.jsx

**Purpose**: Show user's draft PRs, commits, and story points

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
                            PerformanceCard.jsx
                                   │
                                   │ useEffect (on mount)
                                   ▼
                            performanceAPI.getDashboard()
                                   │
                                   │ GET /api/performance/dashboard
                                   ▼
                            PerformanceController.GetDashboard()
                                   │
                                   ▼
                            PerformanceService
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
            GetMyDraftPRs()  GetMyCommits()  GetStoryPoints()
                    │              │              │
                    │ Gets authenticated user via:
                    │ /_apis/connectionData
                    ▼              ▼              ▼
            Filters by user  Last 7 days   Current iteration
                    │              │         (not Done/Closed)
                    └──────────────┼──────────────┘
                                   ▼
                            Returns: Dashboard data
```

**Configuration Used**:
- `StoryPoints.IncludeTypes` (User Story, PBI)
- `StoryPoints.ExcludeStates` (Done, Closed, Removed)
- `StoryPoints.CurrentIterationOnly`

---

### 4. AIAssistant.jsx

**Purpose**: AI-powered DevOps assistant (Azure OpenAI or Copilot)

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
User types question
        │
        ▼
                            AIAssistant.jsx
                                   │
                                   │ Check FeatureFlags.UseCopilot
                                   ▼
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
           UseCopilot: true              UseCopilot: false
                    │                             │
       copilotAPI.chat(message)      aiAPI.query(message)
                    │                             │
       POST /api/copilot/chat       POST /api/aiassistant/query
                    │                             │
                    ▼                             ▼
       CopilotController         AIAssistantController
                    │                             │
                    ▼                             ▼
       CopilotChatService            AIServiceRouter
                    │                             │
                    │                   ┌─────────┴─────────┐
                    ▼                   ▼                   ▼
       GitHub Copilot API    AzureOpenAIService    CopilotService
                    │                   │                   │
                    └───────────────────┴───────────────────┘
                                   │
                                   ▼
                            Returns: AI Response
```

**Configuration Used**:
- `FeatureFlags.UseCopilot` (true/false)
- `AzureOpenAI.Endpoint`, `AzureOpenAI.ApiKey`
- `Copilot.Endpoint`, `Copilot.ApiKey`

---

### 5. CodeQuality.jsx

**Purpose**: Display SonarQube code quality metrics

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
                            CodeQuality.jsx
                                   │
                                   │ useEffect (on mount)
                                   ▼
                            sonarqubeAPI.getProjects()
                                   │
                                   │ GET /api/sonarqube/projects
                                   ▼
                            SonarQubeController.GetProjects()
                                   │
                                   ▼
                            Calls SonarQube API:
                            /api/components/search
                                   │
                                   ▼
                            Returns: Project metrics
                            (bugs, vulnerabilities, code smells)
```

**Configuration Used**:
- `SonarQube.Url`
- `SonarQube.Token`
- `SonarQube.Projects`

---

### 6. LighthouseMetrics.jsx

**Purpose**: Web performance audits for branch deployments

```
User View                    Frontend                      Backend
─────────────────────────────────────────────────────────────────────
                            LighthouseMetrics.jsx
                                   │
                                   │ useEffect (on mount)
                                   ▼
                            lighthouseAPI.getBranches()
                                   │
                                   │ GET /api/lighthouse/branches
                                   ▼
                            LighthouseController.GetBranches()
                                   │
                                   ▼
                            LighthouseService.GetBranchesAsync()
                                   │
                                   ▼
                            Returns: Branch list with scores
                                   │
User selects branch                ▼
        │              lighthouseAPI.getBranchResult(branch)
        ▼                          │
                            GET /api/lighthouse/branch/{branch}
                                   │
                                   ▼
                            Returns: Performance, SEO, Accessibility scores
```

---

## Authentication Flow

### AuthContext.jsx - How It Works

```javascript
AuthContext provides:
├── user              - Current user object
├── isAuthenticated   - Boolean auth state
├── isLoading         - Loading state
├── error             - Auth error message
├── githubConnected   - GitHub integration status
├── login()           - Entra ID login via MSAL
├── logout()          - Clear tokens and redirect
├── connectGitHubWithPAT(pat)   - Store GitHub PAT
├── connectGitHubWithOAuth()    - GitHub OAuth flow
├── disconnectGitHub()          - Remove GitHub connection
└── clearError()      - Clear error message
```

### Authentication Modes

**1. PAT Token Mode** (`FeatureFlags.UsePATToken: true`)
```
User                     Frontend                    Backend
──────────────────────────────────────────────────────────────
                    No login required
                         │
                    PATs configured in
                    secrets.config.json
                         │
                    Backend uses PATs for
                    Azure DevOps/GitHub calls
```

**2. Microsoft Entra ID Mode** (`FeatureFlags.UsePATToken: false`)
```
User                     Frontend                    Backend
──────────────────────────────────────────────────────────────
Click Login              │
    │                    ▼
    │              AuthContext.login()
    │                    │
    │              MSAL redirect to
    │              login.microsoftonline.com
    │                    │
    ◀────────────────────┘
Enter credentials
    │
    │              Redirect back with token
    │                    │
    │              Store in localStorage
    │                    │
    │              Include in API headers
    │                    │
    │                    ▼
                    Backend validates JWT
                    via Microsoft.Identity.Web
```

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Configuration Loading                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Program.cs (Startup)                                           │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. Load appsettings.json (committed)                   │    │
│  │     - URLs, project names, feature flags                │    │
│  │     - NO secrets                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  2. Load secrets.config.json (gitignored)               │    │
│  │     - PAT tokens, API keys                              │    │
│  │     - Overrides appsettings.json values                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  3. Environment Variables (optional)                    │    │
│  │     - Can override any setting                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ConfigurationService                                            │
│  - Provides typed access to all settings                        │
│  - Used by all services                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dev vs Test Environment

The dashboard supports separate configurations for Dev and Test:

```json
{
  "AzureDevOps": {
    "Dev": {
      "Repos": "Repo1.API,Repo1.UI",
      "Pipelines": "CI-Build,CD-Deploy-Dev"
    },
    "Test": {
      "Repos": "Repo1.API,Repo1.UI",
      "Pipelines": "CI-Build,CD-Deploy-Test"
    }
  }
}
```

**Toggle in UI**: Dev/Test switch in header changes which repos/pipelines are shown.

---

## API Endpoint Summary

| Component | Endpoint | Method | Description |
|-----------|----------|--------|-------------|
| PipelineStatus | `/api/devops/builds` | GET | Recent build status |
| PRAlerts | `/api/devops/pullrequests` | GET | Open pull requests |
| PerformanceCard | `/api/performance/dashboard` | GET | User metrics |
| PerformanceCard | `/api/performance/draft-prs` | GET | User's draft PRs |
| PerformanceCard | `/api/performance/story-points` | GET | Sprint story points |
| PerformanceCard | `/api/performance/schedule-review` | POST | Schedule Teams meeting |
| AIAssistant | `/api/aiassistant/query` | POST | AI query (OpenAI) |
| AIAssistant | `/api/copilot/chat` | POST | AI query (Copilot) |
| CodeQuality | `/api/sonarqube/projects` | GET | SonarQube metrics |
| LighthouseMetrics | `/api/lighthouse/branches` | GET | Performance scores |

---

## Error Handling

```
Frontend Error                  Backend Error
────────────────────────────────────────────────────
axios interceptor               ErrorHandlingMiddleware
    │                                  │
    │ 401 → Clear token               │ Log exception
    │ 403 → Show forbidden            │ Return ProblemDetails
    │ 500 → Show error message        │
    ▼                                  ▼
Display error toast             Structured error response
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                        CacheService                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Redis Available?                                                │
│       │                                                          │
│       ├── Yes → RedisCacheService                               │
│       │         - Distributed cache                              │
│       │         - Shared across instances                        │
│       │                                                          │
│       └── No  → InMemoryCacheService                            │
│                 - Single instance cache                          │
│                 - Auto-fallback if Redis fails                   │
│                                                                  │
│  Cache Keys:                                                     │
│  - azdo:authenticated-user (30 min)                             │
│  - ai:query:{hash} (1 hour)                                     │
│  - copilot_context_{user}_{dashboard} (5 min)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
DevDash/
├── src/                          # Frontend (React)
│   ├── api/
│   │   └── backendClient.js      # Centralized API client
│   ├── components/
│   │   ├── PipelineStatus.jsx    # Build status
│   │   ├── PRAlerts.jsx          # Pull requests
│   │   ├── CodeQuality.jsx       # SonarQube
│   │   ├── PerformanceCard.jsx   # User metrics
│   │   ├── AIAssistant.jsx       # AI chat
│   │   ├── LighthouseMetrics.jsx # Performance
│   │   ├── GitHubConnect.jsx     # GitHub auth
│   │   └── ProtectedRoute.jsx    # Auth wrapper
│   ├── context/
│   │   └── AuthContext.jsx       # Auth state management
│   ├── hooks/
│   │   └── useEnvironmentToggle.js # Dev/Test toggle
│   ├── pages/
│   │   ├── Dashboard.jsx         # Dev dashboard
│   │   └── TestDashboard.jsx     # Test dashboard
│   └── App.jsx                   # Main app
│
├── DevDash.API/                  # Backend (.NET)
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── DevOpsController.cs
│   │   ├── PerformanceController.cs
│   │   ├── AIAssistantController.cs
│   │   ├── CopilotController.cs
│   │   ├── SonarQubeController.cs
│   │   ├── LighthouseController.cs
│   │   └── HealthController.cs
│   ├── Services/
│   │   ├── DevOpsService.cs
│   │   ├── PerformanceService.cs
│   │   ├── AIServiceRouter.cs
│   │   ├── AzureOpenAIService.cs
│   │   ├── CopilotService.cs
│   │   ├── CopilotChatService.cs
│   │   ├── CacheService.cs
│   │   ├── IssueSearchService.cs
│   │   └── ConfigurationService.cs
│   ├── config/
│   │   ├── secrets.config.json.template
│   │   └── secrets.config.json   # (gitignored)
│   ├── appsettings.json          # Settings (committed)
│   └── Program.cs                # Startup
│
├── package.json                  # npm scripts
├── startup.bat                   # Windows startup
├── startup.sh                    # Linux/Mac startup
├── README.md                     # Quick start
├── INSTRUCTIONS.md               # Detailed setup
└── CODE_FLOW.md                  # This file
```
