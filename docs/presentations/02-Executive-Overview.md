# DevDash - Executive Overview
## Developer Productivity Dashboard

---

## Agenda

1. What is DevDash?
2. Live Demo
3. Architecture Overview
4. Security & Auth Transition
5. Roadmap & Future
6. Handoff & Continuity
7. Q&A

---

# 1. What is DevDash?

---

## The Problem

### Developer Context Switching

```
┌─────────────────────────────────────────────────────────────┐
│  Developer's Daily Reality                                   │
│                                                             │
│  Azure DevOps  →  GitHub  →  SonarQube  →  Teams  →  Email │
│       ↓             ↓            ↓           ↓         ↓    │
│   Pipelines       PRs       Quality      Meetings   Alerts  │
│                                                             │
│  5+ tabs, 10+ logins, constant switching                   │
└─────────────────────────────────────────────────────────────┘
```

**Pain Points:**
- Multiple tools, multiple logins
- No unified view of team activity
- Missed PR reviews, stale PRs
- Pipeline failures discovered late
- No visibility into code quality trends

---

## The Solution: DevDash

### One Dashboard, All Your Dev Metrics

```
┌─────────────────────────────────────────────────────────────┐
│                      DevDash                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │  Pipeline   │  PR Alerts  │   Code      │    AI       │ │
│  │   Status    │  (All PRs)  │  Quality    │ Assistant   │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐ │
│  │   My PRs    │   My Work   │  Test Plan  │   Team      │ │
│  │  & Commits  │   Items     │  Progress   │  Activity   │ │
│  └─────────────┴─────────────┴─────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Who Is It For?

| Role | Value |
|------|-------|
| **Developers** | See my PRs, commits, and assigned work in one place |
| **Tech Leads** | Monitor pipeline health, PR age, code quality |
| **Managers** | Sprint progress, team velocity, quality trends |
| **QA** | Test plan progress, build status for testing |

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Pipeline Monitor** | Real-time build status with direct links |
| **PR Dashboard** | Combined Azure DevOps + GitHub PRs |
| **Code Quality** | SonarQube metrics at a glance |
| **AI Assistant** | Azure OpenAI / GitHub Copilot powered help |
| **Performance Card** | My drafts, commits, story points |
| **Test Plan Progress** | Pass rates across test suites |
| **Team Notifications** | Toast alerts for team PR/pipeline activity |
| **Dual Environment** | Switch between Dev and Test dashboards |

---

# 2. Live Demo

---

## Demo Flow

### 1. Dashboard Overview (2 min)
- Show Dev dashboard layout
- Point out each card's purpose
- Toggle to Test dashboard

### 2. Pipeline Status (2 min)
- Show recent builds
- Click to open in Azure DevOps
- Show failed build indicators

### 3. PR Alerts (2 min)
- Show open PRs from both sources
- Highlight overdue PRs (>48h)
- Show email reminder button

### 4. Team Activity Notifications (1 min)
- Show toast notification appearing
- Dismiss notification
- Show configurable window setting

### 5. AI Assistant (1 min)
- Ask a question about the codebase
- Show AI response

---

## Demo Environment Settings

```bash
# .env
VITE_NOTIFICATION_WINDOW_HOURS=8  # Show 8 hours of activity
```

**Tip for Demo:**
- Set to 24 or 48 to show more historical notifications
- Have some recent PRs and builds ready

---

# 3. Architecture Overview

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework with Hooks |
| Vite | Fast build tool and dev server |
| Axios | HTTP client with interceptors |
| CSS3 | Styling with CSS variables |

### Backend
| Technology | Purpose |
|------------|---------|
| .NET 8 | Web API framework |
| ASP.NET Core | RESTful API with middleware |
| Redis | Distributed caching (optional) |
| In-Memory Cache | Default caching |

### External Integrations
| Service | Purpose |
|---------|---------|
| Azure DevOps | Pipelines, PRs, Work Items, Test Plans |
| GitHub | Repositories, PRs |
| SonarQube | Code quality metrics |
| Azure OpenAI | AI assistant |
| GitHub Copilot | AI assistant (alternate) |

---

## High-Level Design (HLD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                       │
│                          (Browser/Mobile)                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                               │
│                      React SPA (Vite + Axios)                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Dashboard│ │PRAlerts │ │CodeQual.│ │   AI    │ │ Toast   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ REST API (Bearer Token)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                               │
│                         .NET 8 Web API                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Middleware: CORS → Auth → RateLimit → Controllers                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ DevOps  │ │ GitHub  │ │SonarQube│ │   AI    │ │TeamActiv│          │
│  │Controller││Controller││Controller││Controller││Controller│          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       │           │           │           │           │                 │
│       └───────────┴───────────┴───────────┴───────────┘                 │
│                               │                                         │
│                        SERVICE LAYER                                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ DevOps  │ │ GitHub  │ │SonarQube│ │   AI    │ │TeamActiv│          │
│  │ Service │ │ Service │ │ Service │ │ Service │ │ Service │          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
└───────┼───────────┼───────────┼───────────┼───────────┼─────────────────┘
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Azure   │ │ GitHub  │ │SonarQube│ │ Azure   │ │  Redis  │          │
│  │ DevOps  │ │   API   │ │   API   │ │ OpenAI  │ │ (Cache) │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Low-Level Design (LLD)

### Data Flow: Pipeline Status

```
User loads dashboard
       │
       ▼
PipelineStatus.jsx
       │
       ├── useEffect (on mount)
       │   └── Guard: if (hasFetched.current) return
       │
       └── devOpsAPI.getBuilds(20, environment)
               │
               ▼
       backendClient.js
               │
               ├── Attach Bearer token
               └── POST /api/devops/builds?count=20&environment=Dev
                       │
                       ▼
               DevOpsController.GetBuilds()
                       │
                       ▼
               DevOpsService.GetRecentBuildsAsync()
                       │
                       ├── Check Redis/Memory cache
                       │
                       ├── If miss: Call Azure DevOps API
                       │   └── Auth: PAT token from secrets.config.json
                       │
                       └── Transform response → Cache → Return
                               │
                               ▼
               Component receives data → setState → UI renders
```

---

### Data Flow: Team Activity Notifications

```
Page Load / Every 30 seconds
       │
       ▼
TeamActivityNotifications.jsx
       │
       ├── fetchActivities()
       │       │
       │       └── GET /api/devops/team/activities?since={24h_ago}
       │               │
       │               ▼
       │       TeamActivityService.GetTeamActivitiesAsync()
       │               │
       │               ├── Fetch PRs (Azure DevOps + GitHub)
       │               ├── Fetch Builds
       │               └── Filter by timestamp, exclude current user
       │
       └── For each activity:
               │
               ├── Skip if already seen (seenActivitiesRef)
               ├── Skip if dismissed (localStorage)
               ├── Check age vs NOTIFICATION_WINDOW_HOURS
               │
               └── addToast() → ToastProvider → ToastItem → UI
```

---

## Authentication Model

### Dual Authentication Support

```
┌─────────────────────────────────────────────────────────────┐
│                    Authentication Flow                       │
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │   PAT Token     │         │   Entra ID      │           │
│  │     Mode        │         │     Mode        │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           ▼                           ▼                     │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ No login needed │         │ SSO via Azure   │           │
│  │ PAT on server   │         │ JWT token       │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│              ┌─────────────────┐                           │
│              │  Backend API    │                           │
│              │  validates &    │                           │
│              │  proxies calls  │                           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

| Mode | Use Case | Security Level |
|------|----------|----------------|
| **PAT Token** | Local dev, demos | Medium (tokens server-side) |
| **Entra ID** | Production | High (SSO, MFA, audit logs) |

---

# 4. Security & Auth Transition

---

## Current: PAT Token Mode

### How It Works

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │ ──────► │   Backend   │ ──────► │  Azure/     │
│  (No PAT)   │         │  (Has PAT)  │         │  GitHub     │
└─────────────┘         └─────────────┘         └─────────────┘
```

**Security Measures:**
- PAT tokens NEVER sent to browser
- Stored in `secrets.config.json` (gitignored)
- Template file provided for setup

### Configuration

```bash
# DevDash.API/config/secrets.config.json (gitignored)
{
  "AzureDevOps": { "PAT": "xxxxxxxxxxxx" },
  "GitHub": { "PAT": "ghp_xxxxxxxxxxxx" },
  "SonarQube": { "Token": "xxxxxxxxxxxx" }
}
```

---

## Future: Entra ID Mode

### Migration Path

```
Phase 1 (Current)        Phase 2                 Phase 3
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ PAT tokens  │ ──────► │ Hybrid mode │ ──────► │ Entra ID    │
│ (dev/test)  │         │ (both work) │         │ only (prod) │
└─────────────┘         └─────────────┘         └─────────────┘
```

### Entra ID Benefits

| Feature | PAT | Entra ID |
|---------|-----|----------|
| SSO | ❌ | ✅ |
| MFA | ❌ | ✅ |
| Audit Logs | Limited | ✅ Full |
| Token Rotation | Manual | Automatic |
| User Identity | API call needed | JWT claims |

---

## Security Features Already Implemented

| Feature | Status |
|---------|--------|
| CORS Protection | ✅ Implemented |
| Rate Limiting | ✅ (Entra ID mode) |
| Token Storage | ✅ Server-side only |
| HTTPS | ✅ Required |
| 401 Auto-logout | ✅ Implemented |

---

# 5. Roadmap & Future

---

## Completed Features (v1.0)

- [x] Dual authentication (Entra ID + PAT)
- [x] Azure DevOps pipeline monitoring
- [x] GitHub + Azure DevOps PR tracking
- [x] SonarQube code quality integration
- [x] AI Assistant (Azure OpenAI / Copilot)
- [x] Performance metrics card
- [x] Dev/Test environment toggle
- [x] Team activity notifications
- [x] Test plan progress tracking

---

## Short-Term Roadmap (Q1-Q2)

### 1. Real-Time Updates (SignalR)
**Current**: Polling every 30 seconds
**Future**: Instant push notifications

```
Frontend ◄─── WebSocket ───► Backend ◄── Azure SignalR
```

### 2. Customizable Dashboard Layouts
- Drag-and-drop card arrangement
- Save layouts per user
- Default layouts per role

### 3. Enhanced AI Capabilities
- Code review suggestions
- Pipeline failure analysis
- Sprint planning assistance

---

## Medium-Term Roadmap (Q3-Q4)

### 4. Lighthouse Performance Metrics
**Status**: Built but not enabled

**Why Not Enabled:**
- Requires Chrome/Puppeteer on server
- 30-60s audit time too slow for dashboard
- Better suited for CI pipeline

**Recommended Path:**
- Run in Azure DevOps pipeline
- Store results in blob storage
- Dashboard shows historical trends

### 5. Slack/Teams Integration
- Pipeline failure alerts
- PR overdue notifications
- `/devdash status` command

### 6. Mobile Application (React Native)
- Push notifications
- Quick actions (approve PR)
- On-call monitoring

---

## Long-Term Vision

### 7. Electron Desktop App
**Status**: Not started

**Benefits:**
- System tray notifications
- Offline access to recent data
- Native OS integration

**Technical Approach:**
```
React App → Electron Wrapper → Native App
```

### 8. Codebase Deployment
**Status**: Local/manual deployment only

**Target:**
- Azure App Service (Backend)
- Azure Static Web Apps (Frontend)
- CI/CD pipeline in Azure DevOps

---

## Challenges & Learnings

| Challenge | Solution |
|-----------|----------|
| Azure DevOps API complexity | Custom JSON mapping for nested structures |
| User identity in PAT mode | Dual resolution (ConnectionData + Profile API) |
| Team resolution for sprints | Iterate teams, match user membership |
| Toast notification collisions | Counter-based unique ID generation |
| Dismissed state persistence | localStorage with 24h TTL |
| React StrictMode double-calls | useRef guards for API calls |

---

# 6. Handoff & Continuity

---

## Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| README.md | Root | Quick start, configuration |
| Architecture Overview | docs/confluence/01 | System design |
| Design Considerations | docs/confluence/02 | Why decisions were made |
| Architecture Flow | docs/confluence/03 | Data pipeline |
| PAT Token Setup | docs/confluence/04 | Configuration guide |
| Future Roadmap | docs/confluence/05 | Planned features |
| Code Flow | docs/confluence/06 | Component deep-dive |

---

## Configuration Files

| File | Location | Committed |
|------|----------|-----------|
| appsettings.json | DevDash.API/ | ✅ Yes |
| secrets.config.json | DevDash.API/config/ | ❌ No (gitignored) |
| secrets.config.template.json | DevDash.API/config/ | ✅ Yes |
| .env | Root | ❌ No (gitignored) |
| .env.example | Root | ✅ Yes |

---

## Service Accounts & Tokens

### Required for Operation

| Service | Token Type | Where Stored |
|---------|------------|--------------|
| Azure DevOps | PAT | secrets.config.json |
| GitHub | PAT | secrets.config.json |
| SonarQube | Token | secrets.config.json |
| Azure OpenAI | API Key | secrets.config.json |

### Token Permissions Required

**Azure DevOps PAT:**
- Build: Read
- Code: Read
- Work Items: Read
- Test Management: Read

**GitHub PAT:**
- repo: read
- user: read

---

## Key Contacts

| Role | Responsibility |
|------|----------------|
| **Original Developer** | Architecture decisions, code knowledge |
| **DevOps Team** | Pipeline integration, deployments |
| **Security Team** | Entra ID integration approval |
| **Infrastructure** | Azure resource provisioning |

---

## Pending Approvals

| Item | Status | Owner |
|------|--------|-------|
| Entra ID app registration | Pending | Security |
| Production Azure resources | Pending | Infrastructure |
| SonarQube enterprise access | Pending | DevOps |
| GitHub organization OAuth | Pending | Security |

---

## Getting Started (New Developer)

```bash
# 1. Clone repository
git clone <repo-url>
cd DevDash

# 2. Setup secrets
cd DevDash.API/config
cp secrets.config.template.json secrets.config.json
# Edit secrets.config.json with your PATs

# 3. Setup frontend env
cd ../..
cp .env.example .env
# Edit .env if needed

# 4. Run application
npm install
npm run dev

# 5. Access dashboard
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

---

# 7. Q&A

---

## Anticipated Questions

### Technical

**Q: Why .NET backend instead of Node.js?**
A: Team expertise, Azure DevOps SDK, strong typing, great Azure integration

**Q: Why polling instead of WebSocket?**
A: Simpler for v1.0, SignalR planned for future

**Q: Why both Azure DevOps and GitHub?**
A: Teams use both, need unified view

### Security

**Q: Are PAT tokens secure?**
A: Yes, stored server-side only, never sent to browser

**Q: What about Entra ID?**
A: Implemented, requires app registration approval

### Business

**Q: What's the ROI?**
A: Reduced context switching, faster PR reviews, earlier failure detection

**Q: Who maintains this?**
A: Documentation and handoff materials provided

---

## Thank You

### Resources

- **Repository**: [DevDash GitHub/Azure DevOps URL]
- **Documentation**: `/docs/confluence/`
- **Demo Environment**: http://localhost:5173

### Contact

[Your contact information]
