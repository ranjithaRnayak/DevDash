using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.FeatureManagement;
using DevDash.API.Models;
using DevDash.API.Services;
using System.Security.Claims;

namespace DevDash.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AIAssistantController : ControllerBase
{
    private readonly AIServiceRouter _aiRouter;
    private readonly IIssueSearchService _issueSearchService;
    private readonly ICacheService _cacheService;
    private readonly IFeatureManager _featureManager;
    private readonly ILogger<AIAssistantController> _logger;

    public AIAssistantController(
        AIServiceRouter aiRouter,
        IIssueSearchService issueSearchService,
        ICacheService cacheService,
        IFeatureManager featureManager,
        ILogger<AIAssistantController> logger)
    {
        _aiRouter = aiRouter;
        _issueSearchService = issueSearchService;
        _cacheService = cacheService;
        _featureManager = featureManager;
        _logger = logger;
    }

    /// <summary>
    /// Send a query to the AI assistant
    /// </summary>
    [HttpPost("query")]
    public async Task<ActionResult<AIQueryResponse>> Query([FromBody] AIQueryRequest request, CancellationToken cancellationToken)
    {
        if (!await _featureManager.IsEnabledAsync("EnableAIAssistant"))
        {
            return BadRequest(new { error = "AI Assistant is currently disabled" });
        }

        if (string.IsNullOrWhiteSpace(request.Query))
        {
            return BadRequest(new { error = "Query cannot be empty" });
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
        _logger.LogInformation("AI query from user {UserId}: {Query}", userId, request.Query[..Math.Min(100, request.Query.Length)]);

        try
        {
            var response = await _aiRouter.ProcessQueryAsync(request, cancellationToken);

            // Enrich response with related issues from knowledge base
            var relatedIssues = await _issueSearchService.SearchIssuesAsync(request.Query, 3);
            response.RelatedIssues = relatedIssues.Select(i => new RelatedIssue
            {
                IssueId = i.Id,
                Title = i.Title,
                SimilarityScore = 0.8,
                ResolutionCount = i.RelatedResolutionIds.Count
            }).ToList();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI query failed for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to process AI query" });
        }
    }

    /// <summary>
    /// Get AI explanation for a pipeline error
    /// </summary>
    [HttpPost("explain-error")]
    public async Task<ActionResult<ErrorExplanation>> ExplainError([FromBody] ErrorExplanationRequest request, CancellationToken cancellationToken)
    {
        if (!await _featureManager.IsEnabledAsync("EnableAIAssistant"))
        {
            return BadRequest(new { error = "AI Assistant is currently disabled" });
        }

        if (string.IsNullOrWhiteSpace(request.ErrorLog))
        {
            return BadRequest(new { error = "Error log cannot be empty" });
        }

        try
        {
            var aiRequest = new AIQueryRequest
            {
                Query = "Analyze this error and provide a clear explanation with resolution steps",
                QueryType = AIQueryType.PipelineFailure,
                ErrorLog = request.ErrorLog,
                PipelineId = request.PipelineId
            };

            var response = await _aiRouter.ProcessQueryAsync(aiRequest, cancellationToken);

            // Find similar issues
            var similarIssues = await _issueSearchService.GetSimilarIssuesAsync(request.ErrorLog, 5);

            return Ok(new ErrorExplanation
            {
                Explanation = response.Response,
                SimilarIssues = similarIssues,
                SuggestedResolutions = response.SuggestedResolutions,
                Source = response.Source.ToString()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error explanation failed");
            return StatusCode(500, new { error = "Failed to explain error" });
        }
    }

    /// <summary>
    /// Search for known issues
    /// </summary>
    [HttpGet("issues/search")]
    public async Task<ActionResult<List<Issue>>> SearchIssues([FromQuery] string query, [FromQuery] int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new { error = "Search query cannot be empty" });
        }

        var issues = await _issueSearchService.SearchIssuesAsync(query, limit);
        return Ok(issues);
    }

    /// <summary>
    /// Get resolutions for a specific issue
    /// </summary>
    [HttpGet("issues/{issueId}/resolutions")]
    public async Task<ActionResult<List<Resolution>>> GetResolutions(string issueId)
    {
        var resolutions = await _issueSearchService.SearchResolutionsAsync(issueId);
        return Ok(resolutions);
    }

    /// <summary>
    /// Get common issues by category
    /// </summary>
    [HttpGet("issues/common")]
    public ActionResult<CommonIssuesResponse> GetCommonIssues([FromQuery] IssueCategory? category = null)
    {
        var pipelineIssues = CommonIssues.PipelineIssues;
        var prIssues = CommonIssues.PRIssues;

        if (category.HasValue)
        {
            pipelineIssues = pipelineIssues.Where(i => i.Category == category.Value).ToList();
            prIssues = prIssues.Where(i => i.Category == category.Value).ToList();
        }

        return Ok(new CommonIssuesResponse
        {
            PipelineIssues = pipelineIssues,
            PRIssues = prIssues
        });
    }

    /// <summary>
    /// Get chat history for the current user
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<List<ChatMessage>>> GetChatHistory([FromQuery] int limit = 50)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var history = await _cacheService.GetListAsync<ChatMessage>($"chat:history:{userId}");
        return Ok(history.TakeLast(limit).ToList());
    }

    /// <summary>
    /// Clear chat history for the current user
    /// </summary>
    [HttpDelete("history")]
    public async Task<ActionResult> ClearChatHistory()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        await _cacheService.RemoveAsync($"chat:history:{userId}");
        return Ok(new { success = true });
    }

    public class ErrorExplanationRequest
    {
        public string ErrorLog { get; set; } = string.Empty;
        public string? PipelineId { get; set; }
        public string? BuildId { get; set; }
    }

    public class ErrorExplanation
    {
        public string Explanation { get; set; } = string.Empty;
        public List<Issue> SimilarIssues { get; set; } = new();
        public List<SuggestedResolution> SuggestedResolutions { get; set; } = new();
        public string Source { get; set; } = string.Empty;
    }

    public class CommonIssuesResponse
    {
        public List<Issue> PipelineIssues { get; set; } = new();
        public List<Issue> PRIssues { get; set; } = new();
    }
}
