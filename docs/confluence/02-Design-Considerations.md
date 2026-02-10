# DevDash - Design Considerations

## Overview

This document outlines the key design decisions made during DevDash development and the reasoning behind each choice.

---

## 1. Dual Authentication Strategy

### Decision
Support both Microsoft Entra ID and PAT token authentication modes.

### Rationale
- **Enterprise Users**: Require SSO, audit trails, and centralized identity management
- **Developers**: Need quick local setup without corporate login friction
- **Flexibility**: Teams can choose based on their security requirements

### Implementation
```javascript
// featureFlags.js
export const isPATTokenMode = () => {
    return import.meta.env.VITE_AUTH_MODE === 'PAT' ||
           localStorage.getItem('auth_mode') === 'PAT';
};
```

---

## 2. Backend-First Token Management

### Decision
Store all PAT tokens on the backend, never expose them to the frontend.

### Rationale
- **Security**: Tokens in browser are vulnerable to XSS attacks
- **Rotation**: Easier to rotate tokens without frontend deployments
- **Audit**: All API calls go through backend for logging

### Implementation
```
appsettings.json    → Non-sensitive configuration
secrets.config.json → PAT tokens (gitignored)
```

---

## 3. Centralized API Client

### Decision
Use a single `backendClient.js` for all API communication.

### Rationale
- **Consistency**: Uniform error handling and auth headers
- **Maintainability**: Single point of change for API updates
- **Interceptors**: Centralized 401 handling and token refresh

### Implementation
```javascript
// backendClient.js
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

// All components use:
import { devOpsAPI, sonarqubeAPI } from '../api/backendClient';
```

---

## 4. Environment-Based Dashboard Separation

### Decision
Separate Dev and Test dashboards with different configurations.

### Rationale
- **Different Repos/Pipelines**: Dev and Test often have different targets
- **Visual Distinction**: Color-coded backgrounds prevent confusion
- **Independent Metrics**: Separate tracking for each environment

### Implementation
```javascript
// App.jsx - Both dashboards stay mounted, CSS toggles visibility
<div className={`dashboard-panel ${!isTestMode ? 'active' : 'hidden'}`}>
    <Dashboard />
</div>
<div className={`dashboard-panel ${isTestMode ? 'active' : 'hidden'}`}>
    <TestDashboard />
</div>
```

---

## 5. Rate Limiting by Authentication Type

### Decision
Apply rate limiting only for Entra ID users, skip for PAT mode.

### Rationale
- **Development Experience**: Developers shouldn't hit rate limits locally
- **Production Protection**: Prevent abuse in shared environments
- **Fair Usage**: Enterprise users share resources

### Implementation
```csharp
// RateLimitingMiddleware.cs
var isPATAuth = authType.Equals("PAT", StringComparison.OrdinalIgnoreCase)
                || context.Request.Headers.ContainsKey("X-PAT-Token");

if (isPATAuth) {
    await _next(context);  // Skip rate limiting
    return;
}
```

---

## 6. React Performance Optimizations

### Decision
Use React.memo, useRef guards, and CSS visibility for performance.

### Rationale
- **Prevent Re-renders**: Components shouldn't re-render on parent state changes
- **Prevent Duplicate API Calls**: useRef ensures fetch runs only once
- **Smooth Transitions**: CSS visibility prevents unmount/remount flicker

### Implementation
```javascript
// Dashboard components
const Dashboard = memo(function Dashboard() { ... });

// API-calling components
const hasFetched = useRef(false);
useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchData();
}, []);
```

---

## 7. Graceful Service Degradation

### Decision
Application continues working when external services are unavailable.

### Rationale
- **Resilience**: One service failure shouldn't crash the dashboard
- **Development**: Not all services may be configured locally
- **User Experience**: Show partial data rather than error pages

### Implementation
```csharp
// Service fallback pattern
try {
    return await _externalService.GetDataAsync();
} catch (Exception) {
    return GetMockData();  // Return demo data
}
```

---

## 8. Configuration Separation

### Decision
Separate settings (appsettings.json) from secrets (secrets.config.json).

### Rationale
- **Version Control**: Settings can be committed, secrets cannot
- **Environment Parity**: Same structure across environments
- **Security**: Clear separation of sensitive data

### File Structure
```
DevDash.API/
├── appsettings.json           # Committed - URLs, feature flags
├── appsettings.Development.json
├── secrets.config.json        # Gitignored - PAT tokens
└── secrets.config.template.json # Committed - template
```

---

## 9. AI Provider Abstraction

### Decision
Abstract AI providers behind a common interface.

### Rationale
- **Flexibility**: Switch between Azure OpenAI and GitHub Copilot
- **Cost Management**: Use different providers based on requirements
- **Fallback**: If one provider fails, use another

### Configuration
```json
{
    "FeatureFlags": {
        "UseAzureOpenAI": true,
        "UseCopilot": false
    }
}
```

---

## 10. Responsive Design Approach

### Decision
Mobile-first responsive design with breakpoints.

### Rationale
- **Accessibility**: Dashboard usable on various devices
- **On-Call**: Developers may check status from mobile
- **Future**: Support for dedicated mobile app

### Implementation
```css
@media (max-width: 768px) {
    .container {
        grid-template-columns: 1fr;
    }
}
```

---

## Trade-offs & Alternatives Considered

| Decision | Alternative | Why Not Chosen |
|----------|-------------|----------------|
| Single SPA | Micro-frontends | Complexity overhead for small team |
| Axios | Fetch API | Interceptors and error handling |
| CSS Visibility | Lazy Loading | Both dashboards need data ready |
| .NET Backend | Node.js | Team expertise, Azure integration |
| Redis Cache | In-Memory | Scalability for multiple instances |

---

## Related Documents

- [Architecture Overview](./01-Architecture-Overview.md)
- [Architecture Flow & Data Pipeline](./03-Architecture-Flow.md)
