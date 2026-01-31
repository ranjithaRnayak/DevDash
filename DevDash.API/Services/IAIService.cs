using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Interface for AI service implementations
/// </summary>
public interface IAIService
{
    string ProviderName { get; }
    Task<AIQueryResponse> QueryAsync(AIQueryRequest request, CancellationToken cancellationToken = default);
    Task<List<SuggestedResolution>> GetResolutionsAsync(string issueDescription, CancellationToken cancellationToken = default);
    Task<string> ExplainErrorAsync(string errorLog, CancellationToken cancellationToken = default);
    bool IsAvailable();
}

/// <summary>
/// Routes AI requests to the appropriate provider based on feature flags
/// </summary>
public class AIServiceRouter
{
    private readonly IEnumerable<IAIService> _aiServices;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<AIServiceRouter> _logger;

    public AIServiceRouter(
        IEnumerable<IAIService> aiServices,
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<AIServiceRouter> logger)
    {
        _aiServices = aiServices;
        _configuration = configuration;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<AIQueryResponse> ProcessQueryAsync(AIQueryRequest request, CancellationToken cancellationToken = default)
    {
        // Check cache first
        var cacheKey = $"ai:query:{ComputeHash(request.Query)}";
        var cachedResponse = await _cacheService.GetAsync<AIQueryResponse>(cacheKey);
        if (cachedResponse != null)
        {
            cachedResponse.Source = AIResponseSource.CachedResponse;
            return cachedResponse;
        }

        // Determine which AI service to use based on feature flags
        var useAzureOpenAI = _configuration.GetValue<bool>("FeatureFlags:UseAzureOpenAI");
        var useCopilot = _configuration.GetValue<bool>("FeatureFlags:UseCopilot");

        IAIService? selectedService = null;

        if (useAzureOpenAI)
        {
            selectedService = _aiServices.FirstOrDefault(s => s.ProviderName == "AzureOpenAI" && s.IsAvailable());
        }

        if (selectedService == null && useCopilot)
        {
            selectedService = _aiServices.FirstOrDefault(s => s.ProviderName == "Copilot" && s.IsAvailable());
        }

        if (selectedService == null)
        {
            _logger.LogWarning("No AI service available, returning knowledge base response");
            return await GetKnowledgeBaseResponseAsync(request);
        }

        try
        {
            var response = await selectedService.QueryAsync(request, cancellationToken);

            // Cache the response for 1 hour
            await _cacheService.SetAsync(cacheKey, response, TimeSpan.FromHours(1));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI service {Provider} failed, falling back to knowledge base", selectedService.ProviderName);
            return await GetKnowledgeBaseResponseAsync(request);
        }
    }

    private async Task<AIQueryResponse> GetKnowledgeBaseResponseAsync(AIQueryRequest request)
    {
        // Return response from pre-defined knowledge base
        var response = new AIQueryResponse
        {
            Query = request.Query,
            Source = AIResponseSource.KnowledgeBase,
            ConfidenceScore = 0.7,
            Response = "Based on our knowledge base, here are some suggestions for your query."
        };

        // Search for related issues in knowledge base
        var relatedIssues = CommonIssues.PipelineIssues
            .Concat(CommonIssues.PRIssues)
            .Where(i => i.Keywords.Any(k => request.Query.Contains(k, StringComparison.OrdinalIgnoreCase)))
            .Take(3)
            .Select(i => new RelatedIssue
            {
                IssueId = i.Id,
                Title = i.Title,
                SimilarityScore = 0.8,
                ResolutionCount = 1
            })
            .ToList();

        response.RelatedIssues = relatedIssues;

        return response;
    }

    private static string ComputeHash(string input)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(input.ToLowerInvariant().Trim());
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash)[..16];
    }
}
