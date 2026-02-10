# DevDash - Architecture Flow & Data Pipeline

## Overview

This document describes the data flow through DevDash, from user interaction to external service calls and back.

---

## Request Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                                 │
│                                                                          │
│  1. User clicks "Pipeline Status" card                                   │
│                    │                                                     │
│                    ▼                                                     │
│  ┌─────────────────────────────────────┐                                │
│  │     PipelineStatus Component        │                                │
│  │     useEffect → devOpsAPI.getBuilds │                                │
│  └─────────────────┬───────────────────┘                                │
│                    │                                                     │
│                    ▼                                                     │
│  ┌─────────────────────────────────────┐                                │
│  │        backendClient.js             │                                │
│  │  - Adds Bearer token from storage   │                                │
│  │  - Sends to /api/devops/builds      │                                │
│  └─────────────────┬───────────────────┘                                │
└────────────────────┼─────────────────────────────────────────────────────┘
                     │ HTTPS POST
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           DEVDASH.API                                    │
│                                                                          │
│  2. Request hits middleware pipeline                                     │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   CORS   │→ │   Auth   │→ │ RateLimiting │→ │ DevOpsController │    │
│  └──────────┘  └──────────┘  └──────────────┘  └────────┬─────────┘    │
│                                                          │              │
│  3. Controller calls service layer                       ▼              │
│                                               ┌──────────────────┐      │
│                                               │  DevOpsService   │      │
│                                               │  - Gets PAT from │      │
│                                               │    secrets.json  │      │
│                                               └────────┬─────────┘      │
└────────────────────────────────────────────────────────┼────────────────┘
                                                         │
                     ┌───────────────────────────────────┼───────────────┐
                     │                                   │               │
                     ▼                                   ▼               ▼
              ┌──────────────┐                  ┌──────────────┐  ┌──────────┐
              │ Azure DevOps │                  │    GitHub    │  │  Redis   │
              │     API      │                  │     API      │  │  Cache   │
              └──────────────┘                  └──────────────┘  └──────────┘
```

---

## Data Pipeline Stages

### Stage 1: Frontend Request Initiation

```javascript
// PipelineStatus.jsx
useEffect(() => {
    if (hasFetched.current) return;  // Prevent duplicate calls
    hasFetched.current = true;

    const fetchBuilds = async () => {
        const response = await devOpsAPI.getBuilds(20);
        setBuilds(response.data || []);
    };
    fetchBuilds();
}, []);
```

**Key Points:**
- `useRef` guard prevents duplicate API calls
- Centralized API client handles auth headers
- Response data updates component state

---

### Stage 2: Backend API Client

```javascript
// backendClient.js
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('devdash_auth_token')
                  || sessionStorage.getItem('devdash_auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
```

**Key Points:**
- Automatically attaches auth token
- Handles 401 responses (auto-logout)
- Centralized error handling

---

### Stage 3: Middleware Pipeline

```
Request → CORS → Authentication → Rate Limiting → Controller → Response
```

```csharp
// Program.cs - Middleware order matters!
app.UseCors("AllowFrontend");      // 1. CORS headers first
app.UseAuthentication();            // 2. Validate tokens
app.UseAuthorization();             // 3. Check permissions
app.UseMiddleware<RateLimitingMiddleware>();  // 4. Rate limit check
app.MapControllers();               // 5. Route to controller
```

---

### Stage 4: Service Layer

```csharp
// DevOpsService.cs
public async Task<List<BuildDto>> GetBuildsAsync(int count)
{
    // 1. Check cache first
    var cached = await _cache.GetAsync<List<BuildDto>>("builds");
    if (cached != null) return cached;

    // 2. Get PAT from secrets
    var pat = _secrets.AzureDevOpsPAT;

    // 3. Call Azure DevOps API
    var builds = await _azureDevOpsClient.GetBuildsAsync(pat, count);

    // 4. Cache results
    await _cache.SetAsync("builds", builds, TimeSpan.FromMinutes(5));

    return builds;
}
```

---

### Stage 5: External API Calls

```csharp
// Azure DevOps API call
var request = new HttpRequestMessage(HttpMethod.Get,
    $"{_orgUrl}/{_project}/_apis/build/builds?$top={count}");
request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
    Convert.ToBase64String(Encoding.UTF8.GetBytes($":{pat}")));

var response = await _httpClient.SendAsync(request);
```

---

## Data Flow by Component

### Pipeline Status Card

```
User View → PipelineStatus.jsx → devOpsAPI.getBuilds()
    → DevOpsController.GetBuilds() → DevOpsService
    → Azure DevOps API → Transform → Response
```

### PR Alerts Card

```
User View → PRAlerts.jsx → devOpsAPI.getPullRequests()
    → DevOpsController.GetPullRequests() → DevOpsService
    → [Azure DevOps API + GitHub API] → Merge & Sort → Response
```

### Code Quality Card

```
User View → CodeQuality.jsx → sonarqubeAPI.getProjects()
    → SonarQubeController → SonarQubeService
    → SonarQube API → Transform metrics → Response
```

### AI Assistant Card

```
User Query → AIAssistant.jsx → aiAPI.query()
    → AIController → AIService
    → [Azure OpenAI OR GitHub Copilot] → Stream response → Display
```

---

## Caching Strategy

### Cache Layers

| Layer | Technology | TTL | Purpose |
|-------|------------|-----|---------|
| L1 | In-Memory | 1 min | Hot data |
| L2 | Redis | 5-15 min | Shared cache |
| L3 | Browser | Session | UI state |

### Cache Keys

```
builds:{environment}:{count}
prs:{environment}:{status}
sonar:{projectKey}
user:{userId}:permissions
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Error Occurs                              │
│                             │                                    │
│              ┌──────────────┴──────────────┐                    │
│              ▼                              ▼                    │
│     ┌────────────────┐            ┌────────────────┐            │
│     │ Network Error  │            │  API Error     │            │
│     │ (timeout, etc) │            │ (4xx, 5xx)     │            │
│     └───────┬────────┘            └───────┬────────┘            │
│             │                              │                     │
│             ▼                              ▼                     │
│     ┌────────────────┐            ┌────────────────┐            │
│     │ Retry with     │            │ 401 → Logout   │            │
│     │ exponential    │            │ 429 → Wait     │            │
│     │ backoff        │            │ 5xx → Fallback │            │
│     └───────┬────────┘            └───────┬────────┘            │
│             │                              │                     │
│             └──────────────┬───────────────┘                    │
│                            ▼                                     │
│                  ┌────────────────┐                             │
│                  │ Show User      │                             │
│                  │ Friendly Error │                             │
│                  │ or Mock Data   │                             │
│                  └────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Real-time Updates (Future)

```
┌────────────┐     WebSocket      ┌────────────┐
│  Frontend  │ ◄─────────────────►│  Backend   │
└────────────┘                    └─────┬──────┘
                                        │
                                        ▼
                               ┌────────────────┐
                               │ Azure SignalR  │
                               │    Service     │
                               └────────────────┘
```

---

## Related Documents

- [Architecture Overview](./01-Architecture-Overview.md)
- [Code Flow](./06-Code-Flow.md)
