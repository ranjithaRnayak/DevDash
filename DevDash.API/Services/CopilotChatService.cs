using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevDash.API.Services;

/// <summary>
/// Service for GitHub Copilot Chat integration
/// Provides AI-powered assistance for DevOps troubleshooting
/// </summary>
public interface ICopilotChatService
{
    Task<CopilotChatResponse> SendMessageAsync(CopilotChatRequest request, string? userToken = null);
    Task<CopilotContext> BuildContextAsync(string userId, string? dashboardId = null);
}

public class CopilotChatService : ICopilotChatService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly IConfigurationService _configService;
    private readonly ILogger<CopilotChatService> _logger;
    private readonly IDevOpsService? _devOpsService;
    private readonly ICacheService? _cacheService;

    public CopilotChatService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IConfigurationService configService,
        ILogger<CopilotChatService> logger,
        IDevOpsService? devOpsService = null,
        ICacheService? cacheService = null)
    {
        _httpClient = httpClientFactory.CreateClient("GitHub");
        _configuration = configuration;
        _configService = configService;
        _logger = logger;
        _devOpsService = devOpsService;
        _cacheService = cacheService;
    }

    public async Task<CopilotChatResponse> SendMessageAsync(CopilotChatRequest request, string? userToken = null)
    {
        try
        {
            // Get GitHub token - prefer user OAuth token, fallback to configured token
            var token = userToken ?? _configService.GetSecret("Services:GitHub:PAT");

            if (string.IsNullOrEmpty(token))
            {
                return new CopilotChatResponse
                {
                    Success = false,
                    Error = "GitHub authentication required for Copilot Chat"
                };
            }

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);

            // Build system prompt with context
            var systemPrompt = BuildSystemPrompt(request.Context);

            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            // Add conversation history if provided
            if (request.ConversationHistory?.Count > 0)
            {
                messages.AddRange(request.ConversationHistory.Select(m =>
                    new { role = m.Role, content = m.Content }));
            }

            // Add current message
            messages.Add(new { role = "user", content = request.Message });

            var requestBody = new
            {
                model = _configService.Config.Services.Copilot.Model,
                messages = messages,
                stream = false
            };

            var endpoint = _configuration["Copilot:Endpoint"] ?? "https://api.github.com/copilot/chat/completions";

            var httpContent = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            var response = await _httpClient.PostAsync(endpoint, httpContent);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Copilot API error: {Status} - {Content}",
                    response.StatusCode, responseContent);

                return new CopilotChatResponse
                {
                    Success = false,
                    Error = $"Copilot API error: {response.StatusCode}"
                };
            }

            var result = JsonSerializer.Deserialize<CopilotApiResponse>(responseContent,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return new CopilotChatResponse
            {
                Success = true,
                Message = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response",
                Usage = result?.Usage
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to Copilot");
            return new CopilotChatResponse
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public async Task<CopilotContext> BuildContextAsync(string userId, string? dashboardId = null)
    {
        var context = new CopilotContext
        {
            DashboardId = dashboardId ?? "dev",
            UserId = userId,
            Timestamp = DateTime.UtcNow
        };

        try
        {
            // Get dashboard configuration
            var dashboardConfig = _configService.GetDashboardConfig(dashboardId ?? "dev");
            context.DashboardName = dashboardConfig.Name;
            context.ConfiguredPipelines = dashboardConfig.Pipelines;
            context.ConfiguredRepos = dashboardConfig.Repos;

            // Fetch recent failures (cached)
            if (_devOpsService != null)
            {
                var cacheKey = $"copilot_context_{userId}_{dashboardId}";

                if (_cacheService != null)
                {
                    var cached = await _cacheService.GetAsync<CopilotContext>(cacheKey);
                    if (cached != null && (DateTime.UtcNow - cached.Timestamp).TotalMinutes < 5)
                    {
                        return cached;
                    }
                }

                // Get recent pipeline failures
                context.RecentFailures = await GetRecentFailuresAsync(dashboardConfig.Pipelines);

                // Get open PRs
                context.OpenPRs = await GetOpenPRsAsync();

                // Get build trends
                context.BuildTrends = await GetBuildTrendsAsync(dashboardConfig.Pipelines);

                // Cache the context
                if (_cacheService != null)
                {
                    await _cacheService.SetAsync(cacheKey, context, TimeSpan.FromMinutes(5));
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error building Copilot context for user {UserId}", userId);
        }

        return context;
    }

    private string BuildSystemPrompt(CopilotContext? context)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are a DevOps assistant for the DevDash dashboard.");
        sb.AppendLine("You help developers understand and troubleshoot:");
        sb.AppendLine("- Pipeline failures and build issues");
        sb.AppendLine("- Pull request reviews and code quality");
        sb.AppendLine("- Azure DevOps and GitHub integration");
        sb.AppendLine("- Performance metrics and trends");
        sb.AppendLine();

        if (context != null)
        {
            sb.AppendLine($"Current Dashboard: {context.DashboardName ?? context.DashboardId}");

            if (context.RecentFailures?.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine("Recent Pipeline Failures:");
                foreach (var failure in context.RecentFailures.Take(5))
                {
                    sb.AppendLine($"- {failure.PipelineName}: {failure.ErrorSummary} ({failure.FailedAt:g})");
                }
            }

            if (context.OpenPRs?.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine($"Open Pull Requests: {context.OpenPRs.Count}");
                foreach (var pr in context.OpenPRs.Take(3))
                {
                    sb.AppendLine($"- PR #{pr.Id}: {pr.Title}");
                }
            }

            if (context.BuildTrends != null)
            {
                sb.AppendLine();
                sb.AppendLine($"Build Success Rate (7 days): {context.BuildTrends.SuccessRate:P0}");
                sb.AppendLine($"Total Builds: {context.BuildTrends.TotalBuilds}");
            }
        }

        sb.AppendLine();
        sb.AppendLine("Provide concise, actionable advice. Reference specific pipelines or PRs when relevant.");

        return sb.ToString();
    }

    private Task<List<PipelineFailure>> GetRecentFailuresAsync(List<string> pipelines)
    {
        return Task.FromResult(new List<PipelineFailure>());
    }

    private Task<List<OpenPR>> GetOpenPRsAsync()
    {
        return Task.FromResult(new List<OpenPR>());
    }

    private Task<BuildTrends?> GetBuildTrendsAsync(List<string> pipelines)
    {
        return Task.FromResult<BuildTrends?>(null);
    }
}

#region Request/Response Models

public class CopilotChatRequest
{
    public string Message { get; set; } = string.Empty;
    public CopilotContext? Context { get; set; }
    public List<ChatMessage>? ConversationHistory { get; set; }
}

public class ChatMessage
{
    public string Role { get; set; } = "user";
    public string Content { get; set; } = string.Empty;
}

public class CopilotChatResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
    public UsageInfo? Usage { get; set; }
}

public class CopilotApiResponse
{
    public List<Choice>? Choices { get; set; }
    public UsageInfo? Usage { get; set; }
}

public class Choice
{
    public ChatMessage? Message { get; set; }
}

public class UsageInfo
{
    [JsonPropertyName("prompt_tokens")]
    public int PromptTokens { get; set; }

    [JsonPropertyName("completion_tokens")]
    public int CompletionTokens { get; set; }

    [JsonPropertyName("total_tokens")]
    public int TotalTokens { get; set; }
}

public class CopilotContext
{
    public string DashboardId { get; set; } = "dev";
    public string? DashboardName { get; set; }
    public string? UserId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public List<string> ConfiguredPipelines { get; set; } = new();
    public List<string> ConfiguredRepos { get; set; } = new();
    public List<PipelineFailure>? RecentFailures { get; set; }
    public List<OpenPR>? OpenPRs { get; set; }
    public BuildTrends? BuildTrends { get; set; }
}

public class PipelineFailure
{
    public string PipelineName { get; set; } = string.Empty;
    public string ErrorSummary { get; set; } = string.Empty;
    public DateTime FailedAt { get; set; }
    public string? BuildUrl { get; set; }
}

public class OpenPR
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
}

public class BuildTrends
{
    public double SuccessRate { get; set; }
    public int TotalBuilds { get; set; }
    public int SuccessfulBuilds { get; set; }
    public int FailedBuilds { get; set; }
}

#endregion
