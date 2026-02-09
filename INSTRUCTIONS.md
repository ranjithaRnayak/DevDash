# DevDash Setup Instructions

## Prerequisites

- .NET 8 SDK
- Node.js 18+
- npm

---

## Quick Start

```bash
# Windows
startup.bat

# Linux/Mac
npm run dev
```

---

## PAT Token Generation

### Azure DevOps PAT

1. Go to https://dev.azure.com/{YOUR_ORG}
2. Click on **User Settings** (gear icon) → **Personal Access Tokens**
3. Click **+ New Token**
4. Configure:
   - **Name**: DevDash
   - **Organization**: Select your org
   - **Expiration**: Choose duration
   - **Scopes**: Select these permissions:
     - `Build` → Read
     - `Code` → Read
     - `Pull Request Threads` → Read
     - `Work Items` → Read
5. Click **Create**
6. **Copy the token immediately** (you won't see it again)
7. Add to `DevDash.API/config/secrets.config.json`:
   ```json
   "AzureDevOps": {
     "PAT": "your-token-here"
   }
   ```

---

### GitHub PAT

1. Go to https://github.com/settings/tokens (or your GitHub Enterprise URL)
2. Click **Generate new token** → **Generate new token (classic)**
3. Configure:
   - **Note**: DevDash
   - **Expiration**: Choose duration
   - **Scopes**: Select these permissions:
     - `repo` (Full control of private repositories)
     - `read:user` (Read user profile data)
     - `read:org` (Read org membership)
4. Click **Generate token**
5. **Copy the token immediately** (starts with `ghp_`)
6. Add to `DevDash.API/config/secrets.config.json`:
   ```json
   "GitHub": {
     "PAT": "ghp_your-token-here"
   }
   ```

---

### SonarQube Token

1. Go to your SonarQube instance → **My Account** → **Security**
2. Under **Generate Tokens**:
   - **Name**: DevDash
   - **Type**: User Token
   - **Expires in**: Choose duration
3. Click **Generate**
4. **Copy the token immediately**
5. Add to `DevDash.API/config/secrets.config.json`:
   ```json
   "SonarQube": {
     "Token": "your-token-here"
   }
   ```

---

### Azure OpenAI Key

1. Go to https://portal.azure.com
2. Navigate to your **Azure OpenAI** resource
3. Go to **Keys and Endpoint**
4. Copy **KEY 1** or **KEY 2**
5. Add to `DevDash.API/config/secrets.config.json`:
   ```json
   "AzureOpenAI": {
     "ApiKey": "your-key-here"
   }
   ```

---

### GitHub Copilot API Key

1. Go to https://github.com/settings/copilot
2. Navigate to **API Access** or use GitHub CLI:
   ```bash
   gh auth token
   ```
3. Add to `DevDash.API/config/secrets.config.json`:
   ```json
   "Copilot": {
     "ApiKey": "your-token-here"
   }
   ```

---

## Configuration Files

### 1. Backend Settings: `DevDash.API/appsettings.json`

Update these values:
```json
{
  "AzureDevOps": {
    "OrganizationUrl": "https://dev.azure.com/YOUR_ORG",
    "Project": "YOUR_PROJECT",
    "Pipelines": {
      "Dev": { "Repos": "Repo1,Repo2" },
      "Test": { "Repos": "Repo1,Repo2" }
    }
  },
  "GitHub": {
    "ApiUrl": "https://api.github.com",
    "Owner": "YOUR_ORG",
    "Repos": {
      "Dev": "repo1,repo2",
      "Test": "repo1,repo2"
    }
  },
  "SonarQube": {
    "Url": "https://sonarqube.yourcompany.com",
    "Projects": "project-key-1,project-key-2"
  },
  "PRAlerts": {
    "Approvers": [
      { "Name": "John Doe", "Email": "john@company.com" }
    ],
    "NotificationEmails": ["team@company.com"]
  }
}
```

### 2. Backend Secrets: `DevDash.API/config/secrets.config.json`

```bash
cd DevDash.API/config
cp secrets.config.json.template secrets.config.json
```

Fill in your tokens:
```json
{
  "AzureDevOps": { "PAT": "your-azure-devops-pat" },
  "GitHub": { "PAT": "ghp_your-github-pat" },
  "SonarQube": { "Token": "your-sonarqube-token" },
  "AzureOpenAI": { "ApiKey": "your-azure-openai-key" },
  "Copilot": { "ApiKey": "your-copilot-key" }
}
```

### 3. Frontend: `.env`

```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Running the Application

### Option 1: Using startup.bat (Windows)
```cmd
startup.bat
```

### Option 2: Using npm (All platforms)
```bash
npm install
npm run dev
```

### Option 3: Manual
```bash
# Terminal 1 - Backend
cd DevDash.API
dotnet run

# Terminal 2 - Frontend
npm run frontend
```

---

## Troubleshooting

### "Redis connection failed"
- Redis is optional. The app falls back to in-memory cache automatically.

### "401 Unauthorized" from Azure DevOps
- Check your PAT token is valid and not expired
- Verify the PAT has correct scopes (Build Read, Code Read)

### "401 Unauthorized" from GitHub
- Check your PAT token starts with `ghp_`
- Verify the PAT has `repo` and `read:user` scopes

### "No AI response"
- Check `FeatureFlags.UseCopilot` in appsettings.json
- If `true`: Add Copilot API key
- If `false`: Add Azure OpenAI API key

---

## Feature Flags

In `appsettings.json`:

| Flag | Description |
|------|-------------|
| `UseCopilot: true` | Use GitHub Copilot for AI |
| `UseCopilot: false` | Use Azure OpenAI for AI |
| `UsePATToken: true` | Enable PAT authentication mode |

---

## Security Notes

- Never commit `secrets.config.json` to git (it's gitignored)
- Rotate PAT tokens regularly
- Use minimum required scopes for each token
- Consider using Azure Key Vault for production
