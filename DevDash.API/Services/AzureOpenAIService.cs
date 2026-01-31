using Azure;
using Azure.AI.OpenAI;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Azure OpenAI implementation of AI service
/// </summary>
public class AzureOpenAIService : IAIService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AzureOpenAIService> _logger;
    private OpenAIClient? _client;

    public string ProviderName => "AzureOpenAI";

    public AzureOpenAIService(IConfiguration configuration, ILogger<AzureOpenAIService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        InitializeClient();
    }

    private void InitializeClient()
    {
        var endpoint = _configuration["AzureOpenAI:Endpoint"];
        var apiKey = _configuration["AzureOpenAI:ApiKey"];

        if (!string.IsNullOrEmpty(endpoint) && !string.IsNullOrEmpty(apiKey))
        {
            _client = new OpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
        }
    }

    public bool IsAvailable()
    {
        return _client != null && _configuration.GetValue<bool>("FeatureFlags:UseAzureOpenAI");
    }

    public async Task<AIQueryResponse> QueryAsync(AIQueryRequest request, CancellationToken cancellationToken = default)
    {
        if (_client == null)
        {
            throw new InvalidOperationException("Azure OpenAI client is not initialized");
        }

        var deploymentName = _configuration["AzureOpenAI:DeploymentName"] ?? "gpt-4";
        var systemPrompt = GetSystemPrompt(request.QueryType);

        var chatOptions = new ChatCompletionsOptions
        {
            DeploymentName = deploymentName,
            Messages =
            {
                new ChatRequestSystemMessage(systemPrompt),
                new ChatRequestUserMessage(BuildUserPrompt(request))
            },
            MaxTokens = 1000,
            Temperature = 0.7f
        };

        try
        {
            var response = await _client.GetChatCompletionsAsync(chatOptions, cancellationToken);
            var completion = response.Value;

            return new AIQueryResponse
            {
                Query = request.Query,
                Response = completion.Choices[0].Message.Content,
                Source = AIResponseSource.AzureOpenAI,
                ConfidenceScore = 0.9,
                TokensUsed = completion.Usage.TotalTokens,
                Timestamp = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Azure OpenAI query failed");
            throw;
        }
    }

    public async Task<List<SuggestedResolution>> GetResolutionsAsync(string issueDescription, CancellationToken cancellationToken = default)
    {
        var request = new AIQueryRequest
        {
            Query = issueDescription,
            QueryType = AIQueryType.ResolutionSuggestion
        };

        var response = await QueryAsync(request, cancellationToken);

        return new List<SuggestedResolution>
        {
            new SuggestedResolution
            {
                Title = "AI Suggested Resolution",
                Description = response.Response,
                RelevanceScore = response.ConfidenceScore
            }
        };
    }

    public async Task<string> ExplainErrorAsync(string errorLog, CancellationToken cancellationToken = default)
    {
        var request = new AIQueryRequest
        {
            Query = $"Explain this error and suggest fixes:\n\n{errorLog}",
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
            AIQueryType.PipelineFailure => @"You are a DevOps expert assistant specializing in CI/CD pipeline troubleshooting.
                Analyze pipeline errors and provide clear, actionable solutions.
                Focus on Azure DevOps, GitHub Actions, and common build tools.
                Format your responses with clear steps and code examples when applicable.",

            AIQueryType.PRReview => @"You are a code review assistant.
                Provide constructive feedback on code changes, identify potential issues,
                and suggest improvements following best practices.",

            AIQueryType.CodeExplanation => @"You are a helpful code explanation assistant.
                Explain code clearly and concisely, highlighting important patterns and potential issues.",

            AIQueryType.ResolutionSuggestion => @"You are a technical support assistant.
                Analyze the issue description and provide step-by-step resolution suggestions.
                Prioritize solutions by likelihood of success.",

            AIQueryType.BestPractices => @"You are a software engineering best practices advisor.
                Provide guidance on coding standards, architecture patterns, and DevOps practices.",

            _ => @"You are DevDash AI Assistant, helping developers with pipeline issues,
                code reviews, and DevOps best practices. Be concise and actionable."
        };
    }

    private static string BuildUserPrompt(AIQueryRequest request)
    {
        var prompt = request.Query;

        if (!string.IsNullOrEmpty(request.Context))
        {
            prompt = $"Context: {request.Context}\n\nQuestion: {prompt}";
        }

        if (!string.IsNullOrEmpty(request.ErrorLog))
        {
            prompt += $"\n\nError Log:\n```\n{request.ErrorLog}\n```";
        }

        return prompt;
    }
}
