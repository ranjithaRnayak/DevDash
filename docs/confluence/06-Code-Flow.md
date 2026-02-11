# DevDash - Code Flow & Component Guide

## Overview

This document explains the code flow, component relationships, and the purpose of each component in DevDash.

---

## Application Entry Point

### index.html → main.jsx → App.jsx

```
index.html
    └── <div id="root">
            └── main.jsx
                └── <React.StrictMode>
                        └── <App />
```

### App.jsx - Root Component

```jsx
const App = () => {
    // Check authentication mode
    if (isPATTokenMode()) {
        return <PATModeDashboard />;  // No login required
    }

    // Enterprise mode with Entra ID
    return (
        <AuthProvider>              // Auth context wrapper
            <ProtectedRoute>        // Ensures user is logged in
                <AuthenticatedDashboardContent />
            </ProtectedRoute>
        </AuthProvider>
    );
};
```

**Why This Structure:**
- Separates auth modes at the top level
- AuthProvider only loaded when needed
- ProtectedRoute handles login flow

---

## Authentication Context

### Why AuthContext is Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                     WITHOUT CONTEXT                              │
│                                                                  │
│  Component A ────┐                                              │
│                  │   Each component manages                     │
│  Component B ────┼── its own auth state                        │
│                  │   = Inconsistent, duplicated                │
│  Component C ────┘                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      WITH CONTEXT                                │
│                                                                  │
│              ┌────────────────────┐                             │
│              │    AuthContext     │                             │
│              │  - user            │                             │
│              │  - isAuthenticated │                             │
│              │  - login()         │                             │
│              │  - logout()        │                             │
│              └─────────┬──────────┘                             │
│                        │                                         │
│        ┌───────────────┼───────────────┐                        │
│        ▼               ▼               ▼                        │
│   Component A    Component B    Component C                     │
│                                                                  │
│   All components share the same auth state                      │
└─────────────────────────────────────────────────────────────────┘
```

### AuthContext Implementation

```jsx
// context/AuthContext.jsx
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [githubConnected, setGithubConnected] = useState(false);

    // Initialize auth on mount
    useEffect(() => {
        const initializeAuth = async () => {
            if (authService.isAuthenticated()) {
                const storedUser = await authService.getCurrentUser();
                setUser(storedUser);
            }
            setLoading(false);
        };
        initializeAuth();
    }, []);

    // Provide auth state to children
    return (
        <AuthContext.Provider value={{
            user,
            loading,
            githubConnected,
            login: loginWithEntraID,
            logout,
            connectGitHub
        }}>
            {children}
        </AuthContext.Provider>
    );
};
```

---

## Dashboard Components

### Component Hierarchy

```
App.jsx
├── EnvironmentToggle         # Dev/Test switch
└── Dashboard / TestDashboard
    ├── PipelineStatus        # Build status from Azure DevOps
    ├── PRAlerts              # Open PRs from GitHub + Azure DevOps
    ├── CodeQuality           # SonarQube metrics
    ├── PerformanceCard       # Story points, commits, drafts
    └── AIAssistant           # Chat with AI
```

---

## Component Deep Dive

### 1. PipelineStatus

**Purpose:** Display recent pipeline builds and their status.

**Why Needed:**
- Quick visibility into CI/CD health
- Identify failing builds immediately
- Click to navigate directly to build in Azure DevOps

**Data Flow:**
```
PipelineStatus.jsx
    └── useEffect (on mount)
        └── devOpsAPI.getBuilds(20, environment)
            └── backendClient.js
                └── /api/devops/builds?environment={Dev|Test}
                    └── DevOpsController
                        └── DevOpsService.GetRecentBuildsAsync()
                            └── Azure DevOps API
                                └── Returns builds with _links.web.href URLs
```

**Key Features:**
- **Clickable Rows:** Each build row links directly to Azure DevOps build page
- **Environment Filtering:** Dev dashboard shows Dev pipelines, Test shows Test pipelines
- **Build URL Mapping:** Uses `[JsonPropertyName("_links")]` to correctly map Azure DevOps URL structure

**Key Code:**
```jsx
const PipelineStatus = () => {
    const [builds, setBuilds] = useState([]);
    const hasFetched = useRef(false);

    const handleRowClick = (url) => {
        if (url) window.open(url, '_blank');
    };

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const fetchBuilds = async () => {
            const response = await devOpsAPI.getBuilds(20, dashboardId);
            setBuilds(response.data || []);
        };
        fetchBuilds();
    }, []);
};
```

---

### 2. PRAlerts

**Purpose:** Show open pull requests that need attention.

**Why Needed:**
- Track PRs across multiple platforms (GitHub + Azure DevOps)
- Highlight overdue PRs (>48 hours)
- One-click email reminder for stale PRs

**Data Flow:**
```
PRAlerts.jsx
    └── devOpsAPI.getPullRequests('open')
        └── DevOpsController.GetPullRequests()
            └── DevOpsService
                ├── Azure DevOps API → Azure PRs
                └── GitHub API → GitHub PRs
                    └── Merge & Sort by date
```

**Key Features:**
```jsx
// Highlight overdue PRs
const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);
const isOverdue = hoursOpen > 48;

// Email reminder functionality
const handleEmailClick = () => {
    window.location.href = `mailto:${reviewerEmails}?subject=${subject}`;
};
```

---

### 3. CodeQuality

**Purpose:** Display SonarQube code quality metrics.

**Why Needed:**
- Track code health across projects
- Visibility into bugs, vulnerabilities, code smells
- Quality gate status at a glance

**Data Flow:**
```
CodeQuality.jsx
    └── Promise.all([
            sonarqubeAPI.getConfig(),
            sonarqubeAPI.getProjects()
        ])
        └── SonarQubeController
            └── SonarQubeService
                └── SonarQube API
```

**Metrics Displayed:**
| Metric | Description |
|--------|-------------|
| Quality Gate | Pass/Fail status |
| Bugs | Code defects |
| Vulnerabilities | Security issues |
| Code Smells | Maintainability issues |
| Coverage | Test coverage % |
| Duplications | Duplicate code % |

---

### 4. PerformanceCard

**Purpose:** Show individual developer performance metrics.

**Why Needed:**
- Track personal draft PRs
- View recent commits/check-ins
- Story points not started (sprint awareness)
- Schedule code review meetings

**Tabs:**
1. **Draft PRs** - Your PRs in draft status
2. **Recent Check-ins** - Your recent commits
3. **Backlog** - Story points/Effort assigned to you

**Data Flow:**
```
PerformanceCard.jsx
    └── performanceAPI.getDashboard()
        └── PerformanceController
            └── PerformanceService
                ├── GetAuthenticatedAzDoUserAsync()
                │   ├── PAT Mode: connectionData API → Profile API
                │   └── Entra ID Mode: HTTP context claims
                ├── GetMyDraftPRsAsync() → User's draft PRs
                ├── GetMyRecentCommitsAsync() → User's commits
                └── GetMyStoryPointsAsync()
                    ├── GetUserTeamNameAsync() → Resolve team for @CurrentIteration
                    └── WIQL query with @Me macro
                        └── Returns both StoryPoints and Effort fields
```

**Key Features:**
- **Dual Authentication:** Supports PAT token mode and Entra ID mode
- **Team Resolution:** Dynamically resolves user's team for sprint filtering
- **Story Points + Effort:** Supports both Scrum (StoryPoints) and Agile/CMMI (Effort) templates
- **User Filtering:** Uses @Me WIQL macro for accurate user matching

---

### 5. AIAssistant

**Purpose:** AI-powered chat for development assistance.

**Why Needed:**
- Quick answers about codebase
- Error explanation
- Code suggestions
- Issue search

**Provider Routing:**
```
AIAssistant.jsx
    └── aiAPI.query(message)
        └── AIController
            └── AIService
                └── UseCopilot flag?
                    ├── Yes → GitHub Copilot API
                    └── No  → Azure OpenAI API
```

**Features:**
- Chat history
- Context from dashboard (failures, PRs)
- Issue search and resolution lookup

---

## API Client Architecture

### Why Centralized backendClient.js

```
┌─────────────────────────────────────────────────────────────────┐
│                   WITHOUT CENTRALIZED CLIENT                     │
│                                                                  │
│  PipelineStatus.jsx                                             │
│    const API_URL = '...';                                       │
│    axios.get(`${API_URL}/builds`, { headers: {...} })          │
│                                                                  │
│  PRAlerts.jsx                                                   │
│    const API_URL = '...';  // Duplicated!                       │
│    axios.get(`${API_URL}/prs`, { headers: {...} })             │
│                                                                  │
│  Problems:                                                       │
│  - Duplicate URL definitions                                    │
│  - Duplicate auth header logic                                  │
│  - Inconsistent error handling                                  │
│  - Hard to update globally                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    WITH CENTRALIZED CLIENT                       │
│                                                                  │
│  backendClient.js                                               │
│    - Single API_URL                                             │
│    - Automatic auth headers                                     │
│    - Centralized error handling                                 │
│    - 401 auto-logout                                            │
│                                                                  │
│  PipelineStatus.jsx                                             │
│    devOpsAPI.getBuilds()  // Clean!                            │
│                                                                  │
│  PRAlerts.jsx                                                   │
│    devOpsAPI.getPullRequests()  // Clean!                      │
└─────────────────────────────────────────────────────────────────┘
```

### backendClient.js Structure

```javascript
// Centralized Axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Automatic auth token attachment
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('devdash_auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Automatic 401 handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('devdash_auth_token');
            window.location.reload();  // Force re-login
        }
        return Promise.reject(error);
    }
);

// Organized API exports
export const devOpsAPI = {
    getBuilds: (count) => apiClient.get(`/devops/builds?count=${count}`),
    getPullRequests: (status) => apiClient.get(`/devops/pullrequests?status=${status}`)
};

export const sonarqubeAPI = {
    getConfig: () => apiClient.get('/sonarqube/config'),
    getProjects: () => apiClient.get('/sonarqube/projects')
};
```

---

## Hook: useEnvironmentToggle

### Purpose

Manages Dev/Test environment switching with:
- CSS class changes for background color
- localStorage persistence
- Event listener for toggle changes

### Why Separated into a Hook

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITHOUT CUSTOM HOOK                           │
│                                                                  │
│  App.jsx                                                        │
│    const [isTestMode, setIsTestMode] = useState(false);        │
│    useEffect(() => {                                            │
│      // 30 lines of toggle logic                               │
│      // DOM manipulation                                        │
│      // localStorage                                            │
│      // Event listeners                                         │
│    }, []);                                                      │
│                                                                  │
│  Problems:                                                       │
│  - Cluttered App component                                      │
│  - Hard to test                                                 │
│  - Not reusable                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     WITH CUSTOM HOOK                             │
│                                                                  │
│  App.jsx                                                        │
│    const isTestMode = useEnvironmentToggle();  // Clean!       │
│                                                                  │
│  hooks/useEnvironmentToggle.js                                  │
│    - All toggle logic encapsulated                              │
│    - Testable in isolation                                      │
│    - Reusable across components                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Performance Optimizations

### React.memo

**Why Needed:**
Components re-render when parent state changes. Dashboard and TestDashboard are memoized to prevent unnecessary re-renders when `isTestMode` changes.

```jsx
const Dashboard = memo(function Dashboard() {
    // Only re-renders if props change (none in this case)
    return (...);
});
```

### useRef Guards

**Why Needed:**
React Strict Mode double-invokes effects in development. `useRef` prevents duplicate API calls.

```jsx
const hasFetched = useRef(false);

useEffect(() => {
    if (hasFetched.current) return;  // Skip if already fetched
    hasFetched.current = true;
    fetchData();
}, []);
```

### CSS Visibility

**Why Needed:**
Instead of conditionally rendering dashboards (which causes unmount/remount), both stay mounted and CSS toggles visibility.

```jsx
// Both dashboards always mounted
<div className={`dashboard-panel ${!isTestMode ? 'active' : 'hidden'}`}>
    <Dashboard />
</div>
<div className={`dashboard-panel ${isTestMode ? 'active' : 'hidden'}`}>
    <TestDashboard />
</div>
```

```css
.dashboard-panel.hidden {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    pointer-events: none;
}
```

---

## Backend Service Layer

### Dual Authentication System

PerformanceService supports two authentication modes:

```
┌─────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATION FLOW                            │
│                                                                  │
│  GetAuthenticatedAzDoUserAsync()                                │
│      │                                                          │
│      ├── Check FeatureFlags:UsePATToken                         │
│      │                                                          │
│      ├── Entra ID Mode (UsePATToken: false)                     │
│      │   └── GetUserFromEntraIdClaimsAsync()                    │
│      │       └── Extract from HTTP context claims:              │
│      │           - oid (Object ID)                              │
│      │           - email / preferred_username                   │
│      │           - name                                         │
│      │                                                          │
│      └── PAT Mode (UsePATToken: true)                           │
│          └── GetUserFromAzureDevOpsApiAsync()                   │
│              ├── TryGetUserFromConnectionDataAsync()            │
│              │   └── GET /_apis/connectionData                  │
│              │                                                  │
│              └── TryGetUserFromProfileApiAsync() (fallback)     │
│                  └── GET vssps.dev.azure.com/{org}/profiles/me  │
└─────────────────────────────────────────────────────────────────┘
```

### Team Resolution for Sprint Filtering

```
GetUserTeamNameAsync(user)
    └── GET /_apis/projects/{project}/teams
        └── For each team:
            └── GET /_apis/projects/{project}/teams/{teamId}/members
                └── Match user by ID, Email, or UniqueName
                    └── Return team name for @CurrentIteration macro
```

### Why Service Layer Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                   WITHOUT SERVICE LAYER                          │
│                                                                  │
│  DevOpsController                                               │
│    [HttpGet("builds")]                                          │
│    public async Task<IActionResult> GetBuilds()                 │
│    {                                                            │
│      var pat = _config["AzureDevOps:PAT"];                     │
│      var client = new HttpClient();                             │
│      client.DefaultRequestHeaders.Add("Authorization", ...);   │
│      var response = await client.GetAsync("...");              │
│      // 50+ lines of API logic in controller                   │
│    }                                                            │
│                                                                  │
│  Problems:                                                       │
│  - Fat controllers                                              │
│  - Untestable                                                   │
│  - Duplicate HTTP client logic                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    WITH SERVICE LAYER                            │
│                                                                  │
│  DevOpsController                                               │
│    [HttpGet("builds")]                                          │
│    public async Task<IActionResult> GetBuilds()                 │
│    {                                                            │
│      var builds = await _devOpsService.GetBuildsAsync();       │
│      return Ok(builds);                                         │
│    }                                                            │
│                                                                  │
│  DevOpsService                                                  │
│    - All business logic                                         │
│    - Easily testable with mocks                                 │
│    - Reusable across controllers                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure Summary

```
DevDash/
├── src/
│   ├── api/
│   │   └── backendClient.js    # Centralized API client
│   ├── components/
│   │   ├── PipelineStatus.jsx  # Build status card
│   │   ├── PRAlerts.jsx        # PR tracking card
│   │   ├── CodeQuality.jsx     # SonarQube metrics
│   │   ├── PerformanceCard.jsx # Personal metrics
│   │   └── AIAssistant.jsx     # AI chat
│   ├── context/
│   │   └── AuthContext.jsx     # Auth state management
│   ├── hooks/
│   │   └── useEnvironmentToggle.js  # Dev/Test toggle
│   ├── pages/
│   │   ├── Dashboard.jsx       # Dev environment
│   │   └── TestDashboard.jsx   # Test environment
│   ├── config/
│   │   ├── featureFlags.js     # Feature toggles
│   │   └── dashboards.js       # Dashboard configs
│   └── App.jsx                 # Root component
│
└── DevDash.API/
    ├── Controllers/
    │   ├── DevOpsController.cs
    │   ├── PerformanceController.cs
    │   ├── SonarQubeController.cs
    │   └── AIController.cs
    ├── Services/
    │   ├── DevOpsService.cs       # Azure DevOps & GitHub integration
    │   ├── PerformanceService.cs  # User-specific metrics (dual auth)
    │   ├── SonarQubeService.cs
    │   ├── CacheService.cs        # In-memory/Redis caching
    │   └── AIService.cs
    └── Middleware/
        └── RateLimitingMiddleware.cs
```

---

## Related Documents

- [Architecture Overview](./01-Architecture-Overview.md)
- [Architecture Flow & Data Pipeline](./03-Architecture-Flow.md)
