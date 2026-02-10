# DevDash - PAT Token Creation & Authentication Setup

## Overview

This guide covers creating Personal Access Tokens (PAT) for all integrated services and configuring DevDash authentication.

---

## Quick Start

1. Create PAT tokens for each service (sections below)
2. Copy `secrets.config.template.json` to `secrets.config.json`
3. Add your tokens to `secrets.config.json`
4. Restart the backend

---

## Azure DevOps PAT Token

### Step-by-Step Creation

1. **Navigate to Azure DevOps**
   - Go to `https://dev.azure.com/{your-organization}`
   - Click on your profile icon (top right)
   - Select **Personal access tokens**

2. **Create New Token**
   - Click **+ New Token**
   - Fill in the form:
     - **Name**: `DevDash-{your-name}`
     - **Organization**: Select your organization
     - **Expiration**: Choose appropriate duration (max 1 year)
     - **Scopes**: Select the following:

   | Scope | Permission | Purpose |
   |-------|------------|---------|
   | Build | Read | View pipeline builds |
   | Code | Read | Access repositories |
   | Pull Requests | Read | View PR status |
   | Work Items | Read | View work items/stories |
   | Project | Read | Access project info |

3. **Save Token**
   - Click **Create**
   - **IMPORTANT**: Copy the token immediately (it won't be shown again)
   - Store securely in password manager

### Token Format
```
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## GitHub PAT Token

### Step-by-Step Creation

1. **Navigate to GitHub Settings**
   - Go to `https://github.com/settings/tokens`
   - Or: Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token**
   - Click **Generate new token (classic)**
   - Fill in the form:
     - **Note**: `DevDash-{your-name}`
     - **Expiration**: Choose appropriate duration
     - **Scopes**: Select the following:

   | Scope | Purpose |
   |-------|---------|
   | `repo` | Full repository access |
   | `read:org` | Read organization info |
   | `read:user` | Read user profile |
   | `read:project` | Read projects |

3. **Save Token**
   - Click **Generate token**
   - **IMPORTANT**: Copy immediately
   - Format: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Fine-Grained Tokens (Recommended)

For better security, use fine-grained tokens:
1. Go to **Fine-grained tokens** tab
2. Select specific repositories
3. Grant only required permissions:
   - Contents: Read
   - Pull requests: Read
   - Metadata: Read

---

## SonarQube Token

### Step-by-Step Creation

1. **Navigate to SonarQube**
   - Go to your SonarQube instance
   - Click on your profile (top right)
   - Select **My Account** → **Security**

2. **Generate Token**
   - In the **Tokens** section, enter token name: `DevDash`
   - Click **Generate**
   - Copy the token

### Token Format
```
squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Required Permissions
The token needs these permissions on your projects:
- Browse
- See Source Code
- Execute Analysis (if running scans)

---

## Azure OpenAI Token

### Step-by-Step Setup

1. **Create Azure OpenAI Resource**
   - Go to Azure Portal
   - Create new **Azure OpenAI** resource
   - Wait for approval (may take time)

2. **Get API Key**
   - Navigate to your Azure OpenAI resource
   - Go to **Keys and Endpoint**
   - Copy **Key 1** or **Key 2**

3. **Deploy a Model**
   - Go to **Model deployments**
   - Deploy `gpt-4` or `gpt-35-turbo`
   - Note the **Deployment name**

### Configuration
```json
{
  "AzureOpenAI": {
    "Endpoint": "https://YOUR-RESOURCE.openai.azure.com/",
    "ApiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "DeploymentName": "gpt-4"
  }
}
```

---

## GitHub Copilot Token

### For Copilot Business/Enterprise

1. **Get Organization Token**
   - Organization admin goes to Settings → Copilot
   - Generate API access token
   - Requires Copilot Business subscription

### Configuration
```json
{
  "Copilot": {
    "Token": "ghu_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "Endpoint": "https://api.github.com/copilot"
  }
}
```

---

## Configuration Files

### secrets.config.json (Gitignored)

```json
{
  "AzureDevOps": {
    "PAT": "your-azure-devops-pat-here"
  },
  "GitHub": {
    "PAT": "ghp_your-github-pat-here"
  },
  "SonarQube": {
    "Token": "squ_your-sonarqube-token-here"
  },
  "AzureOpenAI": {
    "ApiKey": "your-azure-openai-key-here"
  },
  "Copilot": {
    "Token": "ghu_your-copilot-token-here"
  }
}
```

### appsettings.json (Committed)

```json
{
  "AzureDevOps": {
    "OrganizationUrl": "https://dev.azure.com/YOUR_ORG",
    "Project": "YOUR_PROJECT"
  },
  "GitHub": {
    "Owner": "YOUR_ORG"
  },
  "SonarQube": {
    "Url": "https://sonarqube.yourcompany.com"
  },
  "FeatureFlags": {
    "UsePATToken": true
  }
}
```

---

## Microsoft Entra ID Setup

### Azure AD App Registration

1. **Create App Registration**
   - Go to Azure Portal → Azure Active Directory
   - App registrations → New registration
   - Name: `DevDash`
   - Redirect URI: `http://localhost:5173/callback`

2. **Configure Authentication**
   - Add platform: Single-page application
   - Add redirect URIs for all environments

3. **API Permissions**
   - Microsoft Graph → User.Read
   - Azure DevOps → user_impersonation

4. **Update Configuration**
```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "your-tenant-id",
    "ClientId": "your-client-id"
  }
}
```

---

## Token Rotation Best Practices

### Rotation Schedule

| Token Type | Recommended Rotation |
|------------|---------------------|
| Azure DevOps | Every 90 days |
| GitHub | Every 90 days |
| SonarQube | Every 180 days |
| Azure OpenAI | Every 90 days |

### Rotation Procedure

1. Create new token before old one expires
2. Update `secrets.config.json`
3. Restart backend
4. Verify functionality
5. Revoke old token

### Monitoring

- Set calendar reminders for expiration
- Monitor for 401 errors in logs
- Use Azure Key Vault for production (optional)

---

## Troubleshooting

### Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid/expired token | Regenerate token |
| 403 Forbidden | Insufficient permissions | Add required scopes |
| 404 Not Found | Wrong organization/project | Verify URLs |
| Rate Limited | Too many requests | Wait or check limits |

### Verification Commands

```bash
# Test Azure DevOps token
curl -u ":YOUR_PAT" "https://dev.azure.com/ORG/_apis/projects"

# Test GitHub token
curl -H "Authorization: token YOUR_PAT" "https://api.github.com/user"

# Test SonarQube token
curl -u "YOUR_TOKEN:" "https://sonarqube.example.com/api/projects/search"
```

---

## Security Considerations

1. **Never commit tokens** - Always use `secrets.config.json` (gitignored)
2. **Use minimum permissions** - Only grant required scopes
3. **Rotate regularly** - Follow rotation schedule
4. **Monitor usage** - Check for unauthorized access
5. **Use environment variables** - For CI/CD pipelines

---

## Related Documents

- [Architecture Overview](./01-Architecture-Overview.md)
- [Design Considerations](./02-Design-Considerations.md)
