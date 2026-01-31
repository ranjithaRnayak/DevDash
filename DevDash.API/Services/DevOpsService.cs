using System.Net.Http.Json;
using System.Text.Json;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Interface for Azure DevOps operations
/// </summary>
public interface IDevOpsService
{
    Task<List<PipelineBuild>> GetRecentBuildsAsync(int count = 10);
    Task<PipelineBuild?> GetBuildAsync(string buildId);
    Task<List<PullRequest>> GetPullRequestsAsync(PRStatus? status = null);
    Task<string?> GetBuildLogsAsync(string buildId);
}

/// <summary>
/// Interface for GitHub operations
/// </summary>
public interface IGitHubService
{
    Task<List<PullRequest>> GetPullRequestsAsync(string state = "open");
    Task<PullRequest?> GetPullRequestAsync(int prNumber);
    Task<List<PRComment>> GetPRCommentsAsync(int prNumber);
}

/// <summary>
/// Azure DevOps API integration service
/// </summary>
public class AzureDevOpsService : IDevOpsService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<AzureDevOpsService> _logger;

    public AzureDevOpsService(
        HttpClient httpClient,
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<AzureDevOpsService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _cacheService = cacheService;
        _logger = logger;

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"];
        var pat = _configuration["AzureDevOps:PAT"];

        if (!string.IsNullOrEmpty(orgUrl))
        {
            _httpClient.BaseAddress = new Uri(orgUrl);
        }

        if (!string.IsNullOrEmpty(pat))
        {
            var credentials = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($":{pat}"));
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
        }
    }

    public async Task<List<PipelineBuild>> GetRecentBuildsAsync(int count = 10)
    {
        var cacheKey = $"azdo:builds:recent:{count}";
        var cached = await _cacheService.GetAsync<List<PipelineBuild>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var response = await _httpClient.GetAsync(
                $"{project}/_apis/build/builds?$top={count}&api-version=7.0");

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<AzDoBuildsResponse>();
            var builds = result?.Value?.Select(MapToPipelineBuild).ToList() ?? new List<PipelineBuild>();

            await _cacheService.SetAsync(cacheKey, builds, TimeSpan.FromMinutes(2));
            return builds;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Azure DevOps builds");
            return new List<PipelineBuild>();
        }
    }

    public async Task<PipelineBuild?> GetBuildAsync(string buildId)
    {
        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var response = await _httpClient.GetAsync(
                $"{project}/_apis/build/builds/{buildId}?api-version=7.0");

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var build = await response.Content.ReadFromJsonAsync<AzDoBuild>();
            return build != null ? MapToPipelineBuild(build) : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch build {BuildId}", buildId);
            return null;
        }
    }

    public async Task<List<PullRequest>> GetPullRequestsAsync(PRStatus? status = null)
    {
        var cacheKey = $"azdo:prs:{status?.ToString() ?? "all"}";
        var cached = await _cacheService.GetAsync<List<PullRequest>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var statusParam = status == PRStatus.Open ? "active" : status?.ToString().ToLower() ?? "all";

            var response = await _httpClient.GetAsync(
                $"{project}/_apis/git/pullrequests?searchCriteria.status={statusParam}&api-version=7.0");

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<AzDoPRsResponse>();
            var prs = result?.Value?.Select(MapToPullRequest).ToList() ?? new List<PullRequest>();

            await _cacheService.SetAsync(cacheKey, prs, TimeSpan.FromMinutes(2));
            return prs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Azure DevOps PRs");
            return new List<PullRequest>();
        }
    }

    public async Task<string?> GetBuildLogsAsync(string buildId)
    {
        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var response = await _httpClient.GetAsync(
                $"{project}/_apis/build/builds/{buildId}/logs?api-version=7.0");

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch build logs for {BuildId}", buildId);
            return null;
        }
    }

    private static PipelineBuild MapToPipelineBuild(AzDoBuild build)
    {
        return new PipelineBuild
        {
            Id = build.Id.ToString(),
            BuildNumber = build.BuildNumber,
            PipelineName = build.Definition?.Name ?? "Unknown",
            PipelineId = build.Definition?.Id.ToString() ?? "",
            Status = MapBuildStatus(build.Status),
            Result = MapBuildResult(build.Result),
            SourceBranch = build.SourceBranch,
            SourceVersion = build.SourceVersion,
            RequestedBy = build.RequestedBy?.DisplayName,
            StartTime = build.StartTime,
            FinishTime = build.FinishTime,
            Url = build.Links?.Web?.Href
        };
    }

    private static PullRequest MapToPullRequest(AzDoPR pr)
    {
        return new PullRequest
        {
            Id = pr.PullRequestId.ToString(),
            Number = pr.PullRequestId,
            Title = pr.Title,
            Description = pr.Description ?? "",
            Status = MapPRStatus(pr.Status),
            SourceBranch = pr.SourceRefName?.Replace("refs/heads/", "") ?? "",
            TargetBranch = pr.TargetRefName?.Replace("refs/heads/", "") ?? "",
            Author = pr.CreatedBy?.DisplayName ?? "Unknown",
            CreatedAt = pr.CreationDate,
            Source = PRSource.AzureDevOps,
            Url = pr.Url
        };
    }

    private static BuildStatus MapBuildStatus(string? status) => status?.ToLower() switch
    {
        "inprogress" => BuildStatus.InProgress,
        "completed" => BuildStatus.Completed,
        "cancelling" => BuildStatus.Cancelling,
        "postponed" => BuildStatus.Postponed,
        "notstarted" => BuildStatus.NotStarted,
        _ => BuildStatus.NotSet
    };

    private static BuildResult? MapBuildResult(string? result) => result?.ToLower() switch
    {
        "succeeded" => BuildResult.Succeeded,
        "partiallysucceeded" => BuildResult.PartiallySucceeded,
        "failed" => BuildResult.Failed,
        "canceled" => BuildResult.Canceled,
        _ => null
    };

    private static PRStatus MapPRStatus(string? status) => status?.ToLower() switch
    {
        "active" => PRStatus.Open,
        "completed" => PRStatus.Merged,
        "abandoned" => PRStatus.Closed,
        _ => PRStatus.Open
    };

    // Azure DevOps API response models
    private class AzDoBuildsResponse { public List<AzDoBuild>? Value { get; set; } }
    private class AzDoPRsResponse { public List<AzDoPR>? Value { get; set; } }

    private class AzDoBuild
    {
        public int Id { get; set; }
        public int BuildNumber { get; set; }
        public string? Status { get; set; }
        public string? Result { get; set; }
        public string? SourceBranch { get; set; }
        public string? SourceVersion { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? FinishTime { get; set; }
        public AzDoDefinition? Definition { get; set; }
        public AzDoIdentity? RequestedBy { get; set; }
        public AzDoLinks? Links { get; set; }
    }

    private class AzDoDefinition { public int Id { get; set; } public string? Name { get; set; } }
    private class AzDoIdentity { public string? DisplayName { get; set; } }
    private class AzDoLinks { public AzDoLink? Web { get; set; } }
    private class AzDoLink { public string? Href { get; set; } }

    private class AzDoPR
    {
        public int PullRequestId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public string? SourceRefName { get; set; }
        public string? TargetRefName { get; set; }
        public DateTime CreationDate { get; set; }
        public AzDoIdentity? CreatedBy { get; set; }
        public string? Url { get; set; }
    }
}

/// <summary>
/// GitHub API integration service
/// </summary>
public class GitHubService : IGitHubService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<GitHubService> _logger;

    public GitHubService(
        HttpClient httpClient,
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<GitHubService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _cacheService = cacheService;
        _logger = logger;

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        _httpClient.BaseAddress = new Uri(_configuration["GitHub:ApiUrl"] ?? "https://api.github.com");

        var token = _configuration["GitHub:PAT"];
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<List<PullRequest>> GetPullRequestsAsync(string state = "open")
    {
        var cacheKey = $"github:prs:{state}";
        var cached = await _cacheService.GetAsync<List<PullRequest>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var owner = _configuration["GitHub:Owner"];
            var repo = _configuration["GitHub:Repo"];

            var response = await _httpClient.GetAsync($"/repos/{owner}/{repo}/pulls?state={state}");
            response.EnsureSuccessStatusCode();

            var ghPRs = await response.Content.ReadFromJsonAsync<List<GitHubPR>>();
            var prs = ghPRs?.Select(MapToPullRequest).ToList() ?? new List<PullRequest>();

            await _cacheService.SetAsync(cacheKey, prs, TimeSpan.FromMinutes(2));
            return prs;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub PRs");
            return new List<PullRequest>();
        }
    }

    public async Task<PullRequest?> GetPullRequestAsync(int prNumber)
    {
        try
        {
            var owner = _configuration["GitHub:Owner"];
            var repo = _configuration["GitHub:Repo"];

            var response = await _httpClient.GetAsync($"/repos/{owner}/{repo}/pulls/{prNumber}");
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var ghPR = await response.Content.ReadFromJsonAsync<GitHubPR>();
            return ghPR != null ? MapToPullRequest(ghPR) : null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub PR {PRNumber}", prNumber);
            return null;
        }
    }

    public async Task<List<PRComment>> GetPRCommentsAsync(int prNumber)
    {
        try
        {
            var owner = _configuration["GitHub:Owner"];
            var repo = _configuration["GitHub:Repo"];

            var response = await _httpClient.GetAsync($"/repos/{owner}/{repo}/pulls/{prNumber}/comments");
            response.EnsureSuccessStatusCode();

            var ghComments = await response.Content.ReadFromJsonAsync<List<GitHubComment>>();
            return ghComments?.Select(MapToComment).ToList() ?? new List<PRComment>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch comments for PR {PRNumber}", prNumber);
            return new List<PRComment>();
        }
    }

    private static PullRequest MapToPullRequest(GitHubPR pr)
    {
        return new PullRequest
        {
            Id = pr.Id.ToString(),
            Number = pr.Number,
            Title = pr.Title ?? "",
            Description = pr.Body ?? "",
            Status = MapPRState(pr.State, pr.MergedAt),
            SourceBranch = pr.Head?.Ref ?? "",
            TargetBranch = pr.Base?.Ref ?? "",
            Author = pr.User?.Login ?? "Unknown",
            AuthorAvatarUrl = pr.User?.AvatarUrl,
            CreatedAt = pr.CreatedAt,
            UpdatedAt = pr.UpdatedAt,
            MergedAt = pr.MergedAt,
            ClosedAt = pr.ClosedAt,
            Url = pr.HtmlUrl,
            Source = PRSource.GitHub,
            AdditionsCount = pr.Additions,
            DeletionsCount = pr.Deletions,
            ChangedFilesCount = pr.ChangedFiles
        };
    }

    private static PRComment MapToComment(GitHubComment comment)
    {
        return new PRComment
        {
            Id = comment.Id.ToString(),
            Author = comment.User?.Login ?? "Unknown",
            AuthorAvatarUrl = comment.User?.AvatarUrl,
            Content = comment.Body ?? "",
            CreatedAt = comment.CreatedAt,
            Type = CommentType.CodeReview,
            FilePath = comment.Path,
            LineNumber = comment.Line
        };
    }

    private static PRStatus MapPRState(string? state, DateTime? mergedAt)
    {
        if (mergedAt.HasValue) return PRStatus.Merged;
        return state?.ToLower() switch
        {
            "open" => PRStatus.Open,
            "closed" => PRStatus.Closed,
            _ => PRStatus.Open
        };
    }

    // GitHub API response models
    private class GitHubPR
    {
        public long Id { get; set; }
        public int Number { get; set; }
        public string? Title { get; set; }
        public string? Body { get; set; }
        public string? State { get; set; }
        public GitHubRef? Head { get; set; }
        public GitHubRef? Base { get; set; }
        public GitHubUser? User { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? MergedAt { get; set; }
        public DateTime? ClosedAt { get; set; }
        public string? HtmlUrl { get; set; }
        public int Additions { get; set; }
        public int Deletions { get; set; }
        public int ChangedFiles { get; set; }
    }

    private class GitHubRef { public string? Ref { get; set; } }
    private class GitHubUser { public string? Login { get; set; } public string? AvatarUrl { get; set; } }

    private class GitHubComment
    {
        public long Id { get; set; }
        public string? Body { get; set; }
        public GitHubUser? User { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? Path { get; set; }
        public int? Line { get; set; }
    }
}
