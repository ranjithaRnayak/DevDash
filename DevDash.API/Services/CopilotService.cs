using System.Net.Http.Json;
using System.Text.Json;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Microsoft Copilot implementation of AI service
/// </summary>
public class CopilotService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CopilotService> _logger;

    public string ProviderName => "Copilot";

    public CopilotService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<CopilotService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        var apiKey = _configuration["Copilot:ApiKey"];
        if (!string.IsNullOrEmpty(apiKey))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        }

        var endpoint = _configuration["Copilot:Endpoint"];
        if (!string.IsNullOrEmpty(endpoint))
        {
            _httpClient.BaseAddress = new Uri(endpoint);
        }
    }

    public bool IsAvailable()
    {
        var apiKey = _configuration["Copilot:ApiKey"];
        return !string.IsNullOrEmpty(apiKey) && _configuration.GetValue<bool>("FeatureFlags:UseCopilot");
    }

    public async Task<AIQueryResponse> QueryAsync(AIQueryRequest request, CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            model = _configuration["Copilot:Model"] ?? "copilot-chat",
            messages = new[]
            {
                new { role = "system", content = GetSystemPrompt(request.QueryType) },
                new { role = "user", content = BuildUserPrompt(request) }
            },
            max_tokens = 1000,
            temperature = 0.7
        };

        try
        {
            var response = await _httpClient.PostAsJsonAsync("/v1/chat/completions", payload, cancellationToken);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<CopilotResponse>(cancellationToken: cancellationToken);

            return new AIQueryResponse
            {
                Query = request.Query,
                Response = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response generated",
                Source = AIResponseSource.MicrosoftCopilot,
                ConfidenceScore = 0.85,
                TokensUsed = result?.Usage?.TotalTokens ?? 0,
                Timestamp = DateTime.UtcNow
            };
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Copilot API request failed");
            throw;
        }
    }

    public async Task<List<SuggestedResolution>> GetResolutionsAsync(string issueDescription, CancellationToken cancellationToken = default)
    {
        var request = new AIQueryRequest
        {
            Query = $"Suggest step-by-step resolutions for this issue: {issueDescription}",
            QueryType = AIQueryType.ResolutionSuggestion
        };

        var response = await QueryAsync(request, cancellationToken);

        return new List<SuggestedResolution>
        {
            new SuggestedResolution
            {
                Title = "Copilot Suggested Resolution",
                Description = response.Response,
                RelevanceScore = response.ConfidenceScore
            }
        };
    }

    public async Task<string> ExplainErrorAsync(string errorLog, CancellationToken cancellationToken = default)
    {
        var request = new AIQueryRequest
        {
            Query = $"Analyze this error log and explain what went wrong:\n\n{errorLog}",
            QueryType = AIQueryType.PipelineFailure,
            ErrorLog = errorLog
        };

        var response = await QueryAsync(request, cancellationToken);
        return response.Response;
    }

    private static string GetSystemPrompt(AIQueryType queryType)
    {
        return queryType switch
        {
            AIQueryType.PipelineFailure => @"You are a CI/CD pipeline expert.
                Analyze build and deployment errors, identify root causes,
                and provide actionable solutions with code examples.",

            AIQueryType.PRReview => @"You are a senior code reviewer.
                Review code changes for quality, security, and best practices.
                Provide constructive feedback with specific suggestions.",

            AIQueryType.ResolutionSuggestion => @"You are a technical troubleshooter.
                Analyze issues and provide numbered step-by-step solutions.
                Include verification steps for each solution.",

            _ => @"You are DevDash Assistant, a helpful AI for developers.
                Provide clear, actionable guidance for DevOps and development questions."
        };
    }

    private static string BuildUserPrompt(AIQueryRequest request)
    {
        var prompt = request.Query;

        if (!string.IsNullOrEmpty(request.Context))
        {
            prompt = $"Context: {request.Context}\n\n{prompt}";
        }

        if (!string.IsNullOrEmpty(request.ErrorLog))
        {
            prompt += $"\n\nError details:\n{request.ErrorLog}";
        }

        return prompt;
    }

    // Response models for Copilot API
    private class CopilotResponse
    {
        public List<CopilotChoice>? Choices { get; set; }
        public CopilotUsage? Usage { get; set; }
    }

    private class CopilotChoice
    {
        public CopilotMessage? Message { get; set; }
    }

    private class CopilotMessage
    {
        public string? Content { get; set; }
    }

    private class CopilotUsage
    {
        public int TotalTokens { get; set; }
    }
}
