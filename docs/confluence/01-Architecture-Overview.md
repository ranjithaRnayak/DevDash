# DevDash - Architecture Overview

## Executive Summary

DevDash is a unified developer dashboard that consolidates metrics from Azure DevOps, GitHub, SonarQube, and other development tools into a single, real-time view. It supports dual authentication modes (Microsoft Entra ID and PAT tokens) and provides AI-powered assistance for development workflows.

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DevDash Frontend                               │
│                        (React + Vite + TypeScript)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Dashboard  │  │   PRAlerts  │  │ CodeQuality │  │ AIAssistant │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
│                              │                                           │
│                    ┌─────────┴─────────┐                                │
│                    │   backendClient   │                                │
│                    │  (Centralized API)│                                │
│                    └─────────┬─────────┘                                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DevDash.API (.NET 8)                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Middleware Pipeline                         │   │
│  │  [CORS] → [Auth] → [RateLimiting] → [Controllers] → [Services]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │DevOpsService│  │SonarService │  │  AIService  │  │ PerfService │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │Azure     │    │SonarQube │    │Azure     │    │Azure     │
    │DevOps API│    │   API    │    │OpenAI    │    │DevOps    │
    └──────────┘    └──────────┘    └──────────┘    └──────────┘
    ┌──────────┐
    │GitHub API│
    └──────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework with Hooks |
| Vite | Build tool and dev server |
| Axios | HTTP client |
| CSS3 | Styling with CSS variables |

### Backend
| Technology | Purpose |
|------------|---------|
| .NET 8 | Web API framework |
| ASP.NET Core | RESTful API |
| Redis | Distributed caching (optional) |
| Elasticsearch | Issue search (optional) |

### External Services
| Service | Purpose |
|---------|---------|
| Azure DevOps | Pipelines, PRs, Work Items |
| GitHub | Repositories, PRs |
| SonarQube | Code quality metrics |
| Azure OpenAI / GitHub Copilot | AI assistance |

---

## Authentication Modes

### 1. Microsoft Entra ID (Enterprise)
- OAuth 2.0 / OpenID Connect
- Single Sign-On (SSO)
- Rate limiting enabled
- Full audit logging

### 2. PAT Token Mode (Development)
- Personal Access Tokens for each service
- No login required
- Rate limiting disabled
- Quick local development setup

---

## Key Design Principles

1. **Separation of Concerns**: Frontend handles UI, backend handles all external API calls
2. **Centralized API Client**: Single `backendClient.js` for all API communication
3. **Token Security**: All PAT tokens stored server-side in `secrets.config.json`
4. **Graceful Degradation**: Services fallback to mock data when unavailable
5. **Performance**: React.memo, useRef guards, CSS visibility for dashboard switching

---

## Deployment Environments

| Environment | Purpose | Authentication |
|-------------|---------|----------------|
| Development | Local dev | PAT tokens |
| Test | Integration testing | PAT or Entra ID |
| Production | Live system | Entra ID only |

---

## Related Documents

- [Design Considerations](./02-Design-Considerations.md)
- [Architecture Flow & Data Pipeline](./03-Architecture-Flow.md)
- [PAT Token Setup](./04-PAT-Token-Setup.md)
- [Future Roadmap](./05-Future-Roadmap.md)
- [Code Flow](./06-Code-Flow.md)
