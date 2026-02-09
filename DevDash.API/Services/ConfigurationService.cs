using System.Text.Json;

namespace DevDash.API.Services;

/// <summary>
/// Centralized configuration service that loads appsettings.json and secrets.config.json
/// Provides strongly-typed access to all configuration settings
/// </summary>
public interface IConfigurationService
{
    AppConfiguration Config { get; }
    string GetSecret(string path);
    DashboardConfig GetDashboardConfig(string dashboardId);
}

public class ConfigurationService : IConfigurationService
{
    private readonly AppConfiguration _config;
    private readonly JsonDocument? _secrets;
    private readonly ILogger<ConfigurationService> _logger;

    public ConfigurationService(IConfiguration configuration, ILogger<ConfigurationService> logger)
    {
        _logger = logger;
        _config = new AppConfiguration();

        // Load from IConfiguration (which includes appsettings.json via builder)
        configuration.Bind(_config);

        // Load secrets file if it exists
        var secretsPath = Path.Combine(AppContext.BaseDirectory, "config", "secrets.config.json");
        if (File.Exists(secretsPath))
        {
            try
            {
                var secretsJson = File.ReadAllText(secretsPath);
                _secrets = JsonDocument.Parse(secretsJson);
                _logger.LogInformation("Loaded secrets from {Path}", secretsPath);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load secrets file from {Path}", secretsPath);
            }
        }
        else
        {
            _logger.LogInformation("No secrets file found at {Path}, using environment variables", secretsPath);
        }
    }

    public AppConfiguration Config => _config;

    public string GetSecret(string path)
    {
        // Try secrets file first
        if (_secrets != null)
        {
            try
            {
                var parts = path.Split(':');
                JsonElement current = _secrets.RootElement;

                foreach (var part in parts)
                {
                    if (current.TryGetProperty(part, out var next))
                    {
                        current = next;
                    }
                    else
                    {
                        break;
                    }
                }

                if (current.ValueKind == JsonValueKind.String)
                {
                    return current.GetString() ?? string.Empty;
                }
            }
            catch
            {
                // Fall through to environment variable
            }
        }

        // Fall back to environment variable
        var envKey = path.Replace(":", "_").ToUpperInvariant();
        return Environment.GetEnvironmentVariable(envKey) ?? string.Empty;
    }

    public DashboardConfig GetDashboardConfig(string dashboardId)
    {
        if (_config.Dashboards.TryGetValue(dashboardId, out var dashboard))
        {
            return dashboard;
        }

        return _config.Dashboards.GetValueOrDefault("dev") ?? new DashboardConfig();
    }
}

#region Configuration Models

public class AppConfiguration
{
    public AuthenticationConfig Authentication { get; set; } = new();
    public ServicesConfig Services { get; set; } = new();
    public Dictionary<string, DashboardConfig> Dashboards { get; set; } = new();
    public FeaturesConfig Features { get; set; } = new();
    public RateLimitingConfig RateLimiting { get; set; } = new();
    public CorsConfig Cors { get; set; } = new();
    public ConnectionStringsConfig ConnectionStrings { get; set; } = new();
    public KeyVaultConfig KeyVault { get; set; } = new();
    public LoggingConfig Logging { get; set; } = new();
}

public class AuthenticationConfig
{
    public EntraIdConfig EntraId { get; set; } = new();
    public GitHubAuthConfig GitHub { get; set; } = new();
}

public class EntraIdConfig
{
    public string ClientId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string Instance { get; set; } = "https://login.microsoftonline.com/";
    public string Audience { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new();
}

public class GitHubAuthConfig
{
    public string ClientId { get; set; } = string.Empty;
    public string ApiUrl { get; set; } = string.Empty;
    public string AuthorizeUrl { get; set; } = string.Empty;
    public string TokenUrl { get; set; } = string.Empty;
    public string OrgName { get; set; } = string.Empty;
}

public class ServicesConfig
{
    public AzureDevOpsConfig AzureDevOps { get; set; } = new();
    public SonarQubeConfig SonarQube { get; set; } = new();
    public AzureOpenAIConfig AzureOpenAI { get; set; } = new();
    public CopilotConfig Copilot { get; set; } = new();
    public MicrosoftGraphConfig MicrosoftGraph { get; set; } = new();
    public ElasticsearchConfig Elasticsearch { get; set; } = new();
}

public class AzureDevOpsConfig
{
    public string OrganizationUrl { get; set; } = string.Empty;
    public string Organization { get; set; } = string.Empty;
    public string Project { get; set; } = string.Empty;
    public string Repos { get; set; } = string.Empty;
}

public class SonarQubeConfig
{
    public string Url { get; set; } = string.Empty;
    public string Projects { get; set; } = string.Empty;
}

public class AzureOpenAIConfig
{
    public string Endpoint { get; set; } = string.Empty;
    public string DeploymentName { get; set; } = "gpt-4";
    public string ApiVersion { get; set; } = "2024-02-15-preview";
}

public class CopilotConfig
{
    public bool Enabled { get; set; }
    public string Endpoint { get; set; } = "/api/copilot/chat";
    public string Model { get; set; } = "copilot-chat";
}

public class MicrosoftGraphConfig
{
    public string Scopes { get; set; } = string.Empty;
}

public class ElasticsearchConfig
{
    public string Uri { get; set; } = string.Empty;
    public string IssuesIndex { get; set; } = "devdash-issues";
    public string ResolutionsIndex { get; set; } = "devdash-resolutions";
}

public class DashboardConfig
{
    public string Name { get; set; } = string.Empty;
    public List<string> Pipelines { get; set; } = new();
    public List<string> Repos { get; set; } = new();
}

public class FeaturesConfig
{
    public bool EnableEntraId { get; set; } = true;
    public bool EnableGitHub { get; set; } = true;
    public bool EnableCopilot { get; set; }
    public bool EnableAzureOpenAI { get; set; } = true;
    public bool EnableAIAssistant { get; set; } = true;
    public bool EnablePipelineAlerts { get; set; } = true;
    public bool EnablePRAlerts { get; set; } = true;
    public bool EnableLighthouse { get; set; }
    public bool UsePATToken { get; set; } = true;
}

public class RateLimitingConfig
{
    public int AIRequestsPerMinute { get; set; } = 10;
    public int DevOpsRequestsPerMinute { get; set; } = 30;
}

public class CorsConfig
{
    public List<string> AllowedOrigins { get; set; } = new() { "http://localhost:5173" };
}

public class ConnectionStringsConfig
{
    public string SqlServer { get; set; } = string.Empty;
    public string Redis { get; set; } = string.Empty;
}

public class KeyVaultConfig
{
    public string Uri { get; set; } = string.Empty;
}

public class LoggingConfig
{
    public Dictionary<string, string> LogLevel { get; set; } = new();
}

#endregion
