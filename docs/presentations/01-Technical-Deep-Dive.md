# DevDash - Technical Deep Dive
## For Technical Reviewers & Architects

---

## Agenda

1. Architecture Deep Dive
2. Code Flow & Data Pipeline
3. Design Decisions & Rationale
4. Lighthouse: Why Built but Not Enabled
5. Challenges Faced & Solutions
6. Why This Flow for Azure Dashboard?
7. Q&A

---

## 1. Architecture Deep Dive

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DevDash Frontend                               │
│                        (React 18 + Vite + Axios)                        │
│  ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐ │
│  │ Dashboard │ │ PRAlerts │ │CodeQuality│ │AIAssistant│ │TeamActivity│ │
│  └───────────┘ └──────────┘ └───────────┘ └───────────┘ └────────────┘ │
│                              │                                           │
│                    ┌─────────┴─────────┐                                │
│                    │   backendClient   │  ← Centralized API Client      │
│                    └─────────┬─────────┘                                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ HTTPS + Bearer Token
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DevDash.API (.NET 8)                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  [CORS] → [Auth] → [RateLimiting] → [Controllers] → [Services]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │DevOpsService│  │GitHubService│  │  AIService  │  │TeamActivity │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Azure     │    │ GitHub   │    │Azure     │    │SonarQube │
    │DevOps   │    │   API    │    │OpenAI    │    │   API    │
    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

### Service Layer Pattern

**Why Service Layer?**

| Approach | Pros | Cons |
|----------|------|------|
| Fat Controllers | Quick to write | Untestable, duplicated logic |
| **Service Layer** | Testable, reusable, clean | Slight indirection |

```csharp
// DevOpsController - Thin
[HttpGet("builds")]
public async Task<IActionResult> GetBuilds()
{
    var builds = await _devOpsService.GetBuildsAsync();
    return Ok(builds);
}

// DevOpsService - Business Logic
public async Task<List<Build>> GetBuildsAsync()
{
    var cached = await _cache.GetAsync<List<Build>>("builds");
    if (cached != null) return cached;

    var builds = await FetchFromAzureDevOps();
    await _cache.SetAsync("builds", builds, TimeSpan.FromMinutes(5));
    return builds;
}
```

---

## 2. Code Flow & Data Pipeline

### Request Lifecycle

```
1. User Action (click, load)
       │
       ▼
2. React Component (useEffect)
       │
       ▼
3. backendClient.js (adds auth header)
       │
       ▼
4. Backend Middleware Pipeline
   [CORS] → [Auth] → [RateLimit] → [Controller]
       │
       ▼
5. Service Layer
   - Check cache
   - Load secrets (PAT)
   - Call external API
   - Transform response
   - Cache result
       │
       ▼
6. Response → Component State → UI Update
```

---

### API Client Architecture

**Why Centralized backendClient.js?**

```javascript
// WITHOUT centralized client (Bad)
// PipelineStatus.jsx
const API_URL = 'http://...';
axios.get(`${API_URL}/builds`, { headers: { Authorization: token } });

// PRAlerts.jsx - Duplicated!
const API_URL = 'http://...';
axios.get(`${API_URL}/prs`, { headers: { Authorization: token } });
```

```javascript
// WITH centralized client (Good)
// backendClient.js
const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('devdash_auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('devdash_auth_token');
            window.location.reload(); // Force re-login
        }
        return Promise.reject(error);
    }
);

// Components just call:
devOpsAPI.getBuilds(); // Clean!
```

---

### Team Activity Notifications Flow

```
TeamActivityNotifications.jsx
    │
    ├── On Mount: fetchActivities()
    ├── Every 30s: setInterval(fetchActivities)
    │
    └── fetchActivities()
            │
            ├── GET /api/devops/team/activities?since={24h_ago}
            │
            └── For each activity:
                    │
                    ├── Skip if seen (seenActivitiesRef)
                    ├── Skip if dismissed (localStorage)
                    ├── Skip if older than NOTIFICATION_WINDOW_HOURS
                    │
                    └── addToast() → ToastProvider → ToastItem
                            │
                            └── User dismisses → toast.onDismiss()
                                    → Save to localStorage
                                    → removeToast()
```

---

## 3. Design Decisions & Rationale

### Decision 1: Dual Authentication

| Mode | Use Case | Security |
|------|----------|----------|
| **PAT Token** | Local dev, quick setup | Tokens on server only |
| **Entra ID** | Production, enterprise | SSO, audit logs, MFA |

**Why Both?**
- Developers need friction-free local setup
- Enterprise requires SSO and audit trails
- Feature flag switches between modes

```javascript
// featureFlags.js
export const isPATTokenMode = () => {
    return import.meta.env.VITE_USE_PAT_TOKEN === 'true';
};
```

---

### Decision 2: Backend-First Token Management

**Security Requirement**: PAT tokens NEVER exposed to browser

```
❌ Bad: Store PAT in .env → Browser can read → XSS vulnerable

✅ Good: Store PAT in secrets.config.json (server-side)
         → Browser only sees JWT token
         → PAT never leaves server
```

**File Structure:**
```
DevDash.API/
├── appsettings.json           # URLs, settings (committed)
├── config/
│   ├── secrets.config.json    # PAT tokens (gitignored)
│   └── secrets.config.template.json # Template (committed)
```

---

### Decision 3: CSS Visibility vs Conditional Rendering

**Problem**: Switching Dev/Test dashboards causes re-mount and API refetch

```javascript
// ❌ Conditional rendering - causes remount
{isTestMode ? <TestDashboard /> : <Dashboard />}
```

```javascript
// ✅ CSS visibility - both stay mounted
<div className={`panel ${!isTestMode ? 'active' : 'hidden'}`}>
    <Dashboard />
</div>
<div className={`panel ${isTestMode ? 'active' : 'hidden'}`}>
    <TestDashboard />
</div>
```

```css
.panel.hidden {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    pointer-events: none;
}
```

**Result**: Instant switch, no API refetch, smoother UX

---

### Decision 4: Rate Limiting by Auth Type

```csharp
// RateLimitingMiddleware.cs
var isPATAuth = authType.Equals("PAT", StringComparison.OrdinalIgnoreCase);

if (isPATAuth) {
    await _next(context);  // Skip rate limiting for devs
    return;
}

// Apply rate limiting for Entra ID users (production)
```

**Rationale:**
- Developers shouldn't hit rate limits during debugging
- Production users share resources, need fair usage
- Different environments, different rules

---

### Decision 5: useRef Guards for API Calls

**Problem**: React StrictMode double-invokes effects in development

```javascript
// ❌ Without guard - API called twice
useEffect(() => {
    fetchData(); // Called twice in StrictMode!
}, []);
```

```javascript
// ✅ With useRef guard
const hasFetched = useRef(false);

useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData(); // Called only once
}, []);
```

---

## 4. Lighthouse: Why Built but Not Enabled

### What Was Built

- LighthouseController with full CRUD operations
- LighthouseService for running audits
- Frontend component (LighthouseMetrics.jsx)
- CSS styling complete
- API endpoints ready

### Why Not Enabled

| Challenge | Impact |
|-----------|--------|
| **Infrastructure** | Lighthouse CLI requires Chrome/Puppeteer on server |
| **CI/CD Integration** | Need to run in pipeline, not on-demand |
| **Storage** | Results are large JSON, need dedicated storage |
| **Timing** | Audits take 30-60s, too slow for dashboard |

### Current State

```json
// appsettings.json
{
  "Features": {
    "EnableLighthouse": false  // Disabled but ready
  }
}
```

### Recommended Path Forward

1. Run Lighthouse in CI pipeline (Azure DevOps task)
2. Store results in Azure Blob Storage
3. Dashboard just reads historical results
4. Show trends, not on-demand audits

---

## 5. Challenges Faced & Solutions

### Challenge 1: Azure DevOps API Complexity

**Problem**: Build URLs nested in `_links.web.href`

```json
// Azure DevOps API Response
{
  "id": 123,
  "_links": {
    "web": {
      "href": "https://dev.azure.com/..."
    }
  }
}
```

**Solution**: Custom JSON property mapping

```csharp
public class PipelineBuild
{
    [JsonPropertyName("_links")]
    public BuildLinks? Links { get; set; }

    public string? WebUrl => Links?.Web?.Href;
}
```

---

### Challenge 2: User Identity Resolution

**Problem**: PAT token doesn't identify user, Entra ID does

**Solution**: Dual resolution strategy

```csharp
public async Task<AzDoUser?> GetAuthenticatedUserAsync()
{
    if (_featureFlags.UsePATToken)
    {
        // PAT Mode: Call Azure DevOps API
        return await GetUserFromConnectionDataAsync()
               ?? await GetUserFromProfileApiAsync();
    }
    else
    {
        // Entra ID Mode: Extract from JWT claims
        return GetUserFromEntraIdClaims();
    }
}
```

---

### Challenge 3: Team Resolution for Sprint Filtering

**Problem**: WIQL `@CurrentIteration` requires team context

**Solution**: Dynamic team resolution

```csharp
public async Task<string?> GetUserTeamNameAsync(AzDoUser user)
{
    var teams = await GetAllTeamsAsync();

    foreach (var team in teams)
    {
        var members = await GetTeamMembersAsync(team.Id);
        if (members.Any(m => MatchesUser(m, user)))
        {
            return team.Name;
        }
    }
    return null;
}
```

---

### Challenge 4: Toast ID Collision

**Problem**: Multiple toasts created in same millisecond got same ID

```javascript
// ❌ IDs collide
const id = Date.now().toString(); // Same ms = same ID!
```

**Solution**: Counter + timestamp

```javascript
let toastIdCounter = 0;

const addToast = (toast) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    // ...
};
```

---

### Challenge 5: Notification Persistence

**Problem**: Dismissed toasts came back on reload

**Root Cause**: `toast.onDismiss()` callback never invoked

```javascript
// ❌ Before - onDismiss not called
const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300); // Only removes from UI
};
```

```javascript
// ✅ After - calls both callbacks
const handleDismiss = () => {
    setIsExiting(true);
    toast.onDismiss?.();          // Save to localStorage
    setTimeout(onDismiss, 300);   // Remove from UI
};
```

---

## 6. Why This Flow for Azure Dashboard?

### Why Not Direct API Calls from Frontend?

| Approach | Pros | Cons |
|----------|------|------|
| **Direct API** | Fewer hops | PAT exposed, CORS issues, no caching |
| **Backend Proxy** | Secure, cacheable, transformable | One extra hop |

**Security**: PAT tokens must stay server-side
**Caching**: Backend can cache across users
**Transformation**: Clean data for frontend

---

### Why Polling Instead of WebSocket?

| Approach | Complexity | Real-time | Resource Usage |
|----------|------------|-----------|----------------|
| **Polling** | Low | ~30s delay | Higher API calls |
| **WebSocket/SignalR** | High | Instant | Persistent connections |

**Current**: Polling (simple, sufficient for v1.0)
**Future**: SignalR for instant updates (roadmap)

---

### Why Combined PR Sources?

Azure DevOps + GitHub = Single unified view

```csharp
// DevOpsController.GetAllPullRequests()
var azdoTask = _devOpsService.GetPullRequestsAsync();
var githubTask = _gitHubService.GetPullRequestsAsync();

await Task.WhenAll(azdoTask, githubTask);

var allPRs = azdoTask.Result
    .Concat(githubTask.Result)
    .OrderByDescending(p => p.CreatedAt)
    .ToList();
```

**Why**: Teams use both platforms, need single dashboard

---

## 7. Key Metrics & Performance

| Metric | Value | Optimization |
|--------|-------|--------------|
| Page Load | ~2s | React.memo, CSS visibility |
| API Response | ~500ms | Redis cache, parallel calls |
| Bundle Size | ~150KB | Vite tree-shaking |
| Notification Delay | 30s max | Polling interval |

---

## Summary: Design Principles

1. **Security First**: Tokens never in browser
2. **Centralized API**: Single point of change
3. **Graceful Degradation**: Partial data > error page
4. **Performance**: Cache, memo, CSS visibility
5. **Dual Auth**: Flexibility for dev and prod
6. **Service Layer**: Testable, reusable logic

---

## Q&A

Common Questions:

1. **Why .NET backend with React frontend?**
   - Team expertise in C#/.NET
   - Azure DevOps SDK available in .NET
   - Strong typing, great Azure integration

2. **Why not micro-frontends?**
   - Overkill for single team
   - Added complexity without benefit
   - Monorepo simpler for this scale

3. **Why Redis over in-memory cache?**
   - Future horizontal scaling
   - Shared cache across instances
   - Currently optional, in-memory fallback exists
