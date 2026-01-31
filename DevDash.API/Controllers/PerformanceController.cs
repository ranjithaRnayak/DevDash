using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DevDash.API.Services;

namespace DevDash.API.Controllers;

/// <summary>
/// Performance Dashboard API - User-specific DevOps data
/// All sensitive API calls are handled server-side to protect tokens
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PerformanceController : ControllerBase
{
    private readonly IPerformanceService _performanceService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<PerformanceController> _logger;

    public PerformanceController(
        IPerformanceService performanceService,
        ICacheService cacheService,
        ILogger<PerformanceController> logger)
    {
        _performanceService = performanceService;
        _cacheService = cacheService;
        _logger = logger;
    }

    /// <summary>
    /// Get the authenticated Azure DevOps user info
    /// </summary>
    [HttpGet("me")]
    public async Task<ActionResult<AzDoUserInfo>> GetCurrentUser()
    {
        try
        {
            var user = await _performanceService.GetAuthenticatedAzDoUserAsync();
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get authenticated user");
            return StatusCode(500, new { error = "Failed to get user information" });
        }
    }

    /// <summary>
    /// Get complete performance dashboard data (all sections combined)
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<PerformanceDashboardResponse>> GetDashboard()
    {
        try
        {
            // Fetch all data in parallel
            var draftPRsTask = GetAllDraftPRsAsync();
            var commitsTask = GetAllCommitsAsync();
            var storyPointsTask = _performanceService.GetMyStoryPointsAsync();
            var userTask = _performanceService.GetAuthenticatedAzDoUserAsync();

            await Task.WhenAll(draftPRsTask, commitsTask, storyPointsTask, userTask);

            var response = new PerformanceDashboardResponse
            {
                User = userTask.Result,
                DraftPRs = draftPRsTask.Result,
                RecentCommits = commitsTask.Result,
                StoryPoints = storyPointsTask.Result
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load performance dashboard");
            return StatusCode(500, new { error = "Failed to load dashboard data" });
        }
    }

    /// <summary>
    /// Get draft PRs created by the authenticated user (Azure DevOps + GitHub)
    /// Matches the "Mine" view in Azure DevOps
    /// </summary>
    [HttpGet("draft-prs")]
    public async Task<ActionResult<List<DraftPullRequest>>> GetDraftPRs()
    {
        try
        {
            var drafts = await GetAllDraftPRsAsync();
            return Ok(drafts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch draft PRs");
            return StatusCode(500, new { error = "Failed to fetch draft PRs" });
        }
    }

    /// <summary>
    /// Get recent commits by the authenticated user (Azure DevOps + GitHub)
    /// </summary>
    [HttpGet("commits")]
    public async Task<ActionResult<List<RecentCommit>>> GetRecentCommits([FromQuery] int days = 7)
    {
        try
        {
            var commits = await GetAllCommitsAsync(days);
            return Ok(commits);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch recent commits");
            return StatusCode(500, new { error = "Failed to fetch commits" });
        }
    }

    /// <summary>
    /// Get story points for PBIs/User Stories not started in current sprint
    /// Only includes Product Backlog Items and User Stories (excludes Tasks)
    /// Excludes Done and Closed states
    /// </summary>
    [HttpGet("story-points")]
    public async Task<ActionResult<StoryPointsSummary>> GetStoryPoints()
    {
        try
        {
            var storyPoints = await _performanceService.GetMyStoryPointsAsync();
            return Ok(storyPoints);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch story points");
            return StatusCode(500, new { error = "Failed to fetch story points" });
        }
    }

    /// <summary>
    /// Schedule a code review Teams meeting via Microsoft Graph
    /// Pre-fills meeting with PR details and reviewers
    /// </summary>
    [HttpPost("schedule-review")]
    public async Task<ActionResult<TeamsMeetingResult>> ScheduleCodeReview([FromBody] CodeReviewMeetingRequest request)
    {
        try
        {
            if (request.PrId <= 0)
            {
                return BadRequest(new { error = "PR ID is required" });
            }

            var result = await _performanceService.CreateCodeReviewMeetingAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule code review meeting");
            return StatusCode(500, new { error = "Failed to schedule meeting" });
        }
    }

    /// <summary>
    /// Get a specific draft PR with reviewer details for scheduling
    /// </summary>
    [HttpGet("draft-prs/{source}/{prId}")]
    public async Task<ActionResult<DraftPullRequest>> GetDraftPR(string source, int prId)
    {
        try
        {
            var drafts = await GetAllDraftPRsAsync();
            var pr = drafts.FirstOrDefault(d =>
                d.Id == prId &&
                string.Equals(d.Source, source, StringComparison.OrdinalIgnoreCase));

            if (pr == null)
            {
                return NotFound(new { error = "Draft PR not found" });
            }

            return Ok(pr);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch draft PR {PrId}", prId);
            return StatusCode(500, new { error = "Failed to fetch PR details" });
        }
    }

    #region Private Helper Methods

    private async Task<List<DraftPullRequest>> GetAllDraftPRsAsync()
    {
        // Fetch from both Azure DevOps and GitHub in parallel
        var azDoTask = _performanceService.GetMyDraftPRsAsync();
        var gitHubTask = _performanceService.GetGitHubDraftPRsAsync();

        await Task.WhenAll(azDoTask, gitHubTask);

        var allDrafts = azDoTask.Result
            .Concat(gitHubTask.Result)
            .OrderByDescending(d => d.CreatedAt)
            .ToList();

        return allDrafts;
    }

    private async Task<List<RecentCommit>> GetAllCommitsAsync(int days = 7)
    {
        // Fetch from both Azure DevOps and GitHub in parallel
        var azDoTask = _performanceService.GetMyRecentCommitsAsync(days);
        var gitHubTask = _performanceService.GetGitHubCommitsAsync(days);

        await Task.WhenAll(azDoTask, gitHubTask);

        var allCommits = azDoTask.Result
            .Concat(gitHubTask.Result)
            .OrderByDescending(c => c.Date)
            .Take(20)
            .ToList();

        return allCommits;
    }

    #endregion
}

/// <summary>
/// Combined response for performance dashboard
/// </summary>
public class PerformanceDashboardResponse
{
    public AzDoUserInfo? User { get; set; }
    public List<DraftPullRequest> DraftPRs { get; set; } = new();
    public List<RecentCommit> RecentCommits { get; set; } = new();
    public StoryPointsSummary StoryPoints { get; set; } = new();
}
