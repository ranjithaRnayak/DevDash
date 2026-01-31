using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DevDash.API.Models;
using DevDash.API.Services;

namespace DevDash.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DevOpsController : ControllerBase
{
    private readonly IDevOpsService _devOpsService;
    private readonly IGitHubService _gitHubService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<DevOpsController> _logger;

    public DevOpsController(
        IDevOpsService devOpsService,
        IGitHubService gitHubService,
        ICacheService cacheService,
        ILogger<DevOpsController> logger)
    {
        _devOpsService = devOpsService;
        _gitHubService = gitHubService;
        _cacheService = cacheService;
        _logger = logger;
    }

    /// <summary>
    /// Get dashboard summary with recent builds and PRs
    /// </summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardSummary>> GetDashboardSummary()
    {
        var cacheKey = "dashboard:summary";
        var cached = await _cacheService.GetAsync<DashboardSummary>(cacheKey);
        if (cached != null)
        {
            return Ok(cached);
        }

        try
        {
            var buildsTask = _devOpsService.GetRecentBuildsAsync(20);
            var azdoPRsTask = _devOpsService.GetPullRequestsAsync(PRStatus.Open);
            var githubPRsTask = _gitHubService.GetPullRequestsAsync("open");

            await Task.WhenAll(buildsTask, azdoPRsTask, githubPRsTask);

            var builds = buildsTask.Result;
            var allPRs = azdoPRsTask.Result.Concat(githubPRsTask.Result).ToList();

            var summary = new DashboardSummary
            {
                TotalPipelines = builds.Select(b => b.PipelineId).Distinct().Count(),
                SuccessfulBuilds = builds.Count(b => b.Result == BuildResult.Succeeded),
                FailedBuilds = builds.Count(b => b.Result == BuildResult.Failed),
                InProgressBuilds = builds.Count(b => b.Status == BuildStatus.InProgress),
                SuccessRate = builds.Count > 0
                    ? Math.Round((double)builds.Count(b => b.Result == BuildResult.Succeeded) / builds.Count * 100, 1)
                    : 0,
                OpenPRs = allPRs.Count(p => p.Status == PRStatus.Open),
                PRsNeedingReview = allPRs.Count(p => p.Reviewers.All(r => r.Vote == ReviewVote.NoVote)),
                PRsWithConflicts = allPRs.Count(p => p.HasConflicts),
                RecentBuilds = builds.Take(10).ToList(),
                RecentPRs = allPRs.OrderByDescending(p => p.CreatedAt).Take(10).ToList(),
                GeneratedAt = DateTime.UtcNow
            };

            await _cacheService.SetAsync(cacheKey, summary, TimeSpan.FromMinutes(2));
            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate dashboard summary");
            return StatusCode(500, new { error = "Failed to load dashboard data" });
        }
    }

    /// <summary>
    /// Get recent pipeline builds
    /// </summary>
    [HttpGet("builds")]
    public async Task<ActionResult<List<PipelineBuild>>> GetBuilds([FromQuery] int count = 10)
    {
        try
        {
            var builds = await _devOpsService.GetRecentBuildsAsync(count);
            return Ok(builds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch builds");
            return StatusCode(500, new { error = "Failed to fetch builds" });
        }
    }

    /// <summary>
    /// Get a specific build by ID
    /// </summary>
    [HttpGet("builds/{buildId}")]
    public async Task<ActionResult<PipelineBuild>> GetBuild(string buildId)
    {
        try
        {
            var build = await _devOpsService.GetBuildAsync(buildId);
            if (build == null)
            {
                return NotFound(new { error = "Build not found" });
            }
            return Ok(build);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch build {BuildId}", buildId);
            return StatusCode(500, new { error = "Failed to fetch build" });
        }
    }

    /// <summary>
    /// Get build logs
    /// </summary>
    [HttpGet("builds/{buildId}/logs")]
    public async Task<ActionResult<BuildLogsResponse>> GetBuildLogs(string buildId)
    {
        try
        {
            var logs = await _devOpsService.GetBuildLogsAsync(buildId);
            if (logs == null)
            {
                return NotFound(new { error = "Build logs not found" });
            }
            return Ok(new BuildLogsResponse { BuildId = buildId, Logs = logs });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch logs for build {BuildId}", buildId);
            return StatusCode(500, new { error = "Failed to fetch build logs" });
        }
    }

    /// <summary>
    /// Get pull requests from Azure DevOps
    /// </summary>
    [HttpGet("pullrequests/azdo")]
    public async Task<ActionResult<List<PullRequest>>> GetAzDoPullRequests([FromQuery] string? status = null)
    {
        try
        {
            PRStatus? prStatus = status?.ToLower() switch
            {
                "open" => PRStatus.Open,
                "closed" => PRStatus.Closed,
                "merged" => PRStatus.Merged,
                _ => null
            };

            var prs = await _devOpsService.GetPullRequestsAsync(prStatus);
            return Ok(prs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Azure DevOps PRs");
            return StatusCode(500, new { error = "Failed to fetch pull requests" });
        }
    }

    /// <summary>
    /// Get pull requests from GitHub
    /// </summary>
    [HttpGet("pullrequests/github")]
    public async Task<ActionResult<List<PullRequest>>> GetGitHubPullRequests([FromQuery] string state = "open")
    {
        try
        {
            var prs = await _gitHubService.GetPullRequestsAsync(state);
            return Ok(prs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub PRs");
            return StatusCode(500, new { error = "Failed to fetch pull requests" });
        }
    }

    /// <summary>
    /// Get all pull requests (combined from all sources)
    /// </summary>
    [HttpGet("pullrequests")]
    public async Task<ActionResult<List<PullRequest>>> GetAllPullRequests([FromQuery] string? status = null)
    {
        try
        {
            var azdoTask = _devOpsService.GetPullRequestsAsync(
                status == "open" ? PRStatus.Open : null);
            var githubTask = _gitHubService.GetPullRequestsAsync(status ?? "open");

            await Task.WhenAll(azdoTask, githubTask);

            var allPRs = azdoTask.Result
                .Concat(githubTask.Result)
                .OrderByDescending(p => p.CreatedAt)
                .ToList();

            return Ok(allPRs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch pull requests");
            return StatusCode(500, new { error = "Failed to fetch pull requests" });
        }
    }

    /// <summary>
    /// Get a specific GitHub PR with comments
    /// </summary>
    [HttpGet("pullrequests/github/{prNumber}")]
    public async Task<ActionResult<PullRequest>> GetGitHubPullRequest(int prNumber)
    {
        try
        {
            var pr = await _gitHubService.GetPullRequestAsync(prNumber);
            if (pr == null)
            {
                return NotFound(new { error = "Pull request not found" });
            }

            pr.Comments = await _gitHubService.GetPRCommentsAsync(prNumber);
            return Ok(pr);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub PR {PRNumber}", prNumber);
            return StatusCode(500, new { error = "Failed to fetch pull request" });
        }
    }

    public class BuildLogsResponse
    {
        public string BuildId { get; set; } = string.Empty;
        public string Logs { get; set; } = string.Empty;
    }
}
