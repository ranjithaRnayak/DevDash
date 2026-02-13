using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Interface for Azure DevOps operations
/// </summary>
public interface IDevOpsService
{
    Task<List<PipelineBuild>> GetRecentBuildsAsync(int count = 20, string? environment = null);
    Task<PipelineBuild?> GetBuildAsync(string buildId);
    Task<List<PullRequest>> GetPullRequestsAsync(PRStatus? status = null);
    Task<string?> GetBuildLogsAsync(string buildId);
    Task<List<TeamMember>> GetTeamMembersAsync();
}

/// <summary>
/// Interface for GitHub operations
/// </summary>
public interface IGitHubService
{
    Task<List<PullRequest>> GetPullRequestsAsync(string state = "open");
    Task<PullRequest?> GetPullRequestAsync(int prNumber);
    Task<List<PRComment>> GetPRCommentsAsync(int prNumber);
    Task<List<TeamMember>> GetOrganizationMembersAsync();
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

    public async Task<List<PipelineBuild>> GetRecentBuildsAsync(int count = 20, string? environment = null)
    {
        var cacheKey = $"azdo:builds:recent:{count}:{environment ?? "all"}";
        var cached = await _cacheService.GetAsync<List<PipelineBuild>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];

            var pipelineNames = new List<string>();
            if (!string.IsNullOrEmpty(environment))
            {
                var pipelinesConfig = _configuration[$"AzureDevOps:{environment}:Pipelines"];
                if (!string.IsNullOrEmpty(pipelinesConfig))
                {
                    pipelineNames = pipelinesConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                }
            }

            var fetchMultiplier = _configuration.GetValue<int>("AzureDevOps:FetchMultiplier", 5);
            var fetchCount = pipelineNames.Count > 0 ? count * fetchMultiplier : count;
            var url = $"{project}/_apis/build/builds?$top={fetchCount}&api-version=7.0";
            _logger.LogInformation("Builds API: BaseAddress={BaseAddress}, URL={Url}, Environment={Env}, Pipelines={Pipelines}",
                _httpClient.BaseAddress, url, environment, string.Join(",", pipelineNames));

            var response = await _httpClient.GetAsync(url);
            _logger.LogInformation("Builds API response: {StatusCode}", response.StatusCode);

            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<AzDoBuildsResponse>();
            _logger.LogInformation("Parsed builds: Value is null={IsNull}, Count={Count}",
                result?.Value == null, result?.Value?.Count ?? 0);

            var allBuilds = result?.Value?.Select(MapToPipelineBuild).ToList() ?? new List<PipelineBuild>();

            List<PipelineBuild> builds;
            if (pipelineNames.Count > 0)
            {
                // Don't apply .Take(count) after filtering - show all matching builds
                // since filtering already limits to configured pipelines
                builds = allBuilds
                    .Where(b => pipelineNames.Any(p =>
                        b.PipelineName?.Contains(p, StringComparison.OrdinalIgnoreCase) == true))
                    .ToList();
                _logger.LogInformation("Filtered to {FilteredCount} builds matching pipelines: {Pipelines}",
                    builds.Count, string.Join(",", pipelineNames));
            }
            else
            {
                builds = allBuilds.Take(count).ToList();
            }

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

    public async Task<List<TeamMember>> GetTeamMembersAsync()
    {
        var cacheKey = "azdo:team:members";
        var cached = await _cacheService.GetAsync<List<TeamMember>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];

            var teamsResponse = await _httpClient.GetAsync($"{project}/_apis/teams?api-version=7.0");
            if (!teamsResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Azure DevOps teams: {StatusCode}", teamsResponse.StatusCode);
                return new List<TeamMember>();
            }

            var teamsResult = await teamsResponse.Content.ReadFromJsonAsync<AzDoTeamsResponse>();
            var defaultTeam = teamsResult?.Value?.FirstOrDefault();

            if (defaultTeam == null)
            {
                _logger.LogWarning("No teams found in Azure DevOps project {Project}", project);
                return new List<TeamMember>();
            }

            var membersResponse = await _httpClient.GetAsync(
                $"{project}/_apis/projects/{project}/teams/{defaultTeam.Id}/members?api-version=7.0");

            if (!membersResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch team members: {StatusCode}", membersResponse.StatusCode);
                return new List<TeamMember>();
            }

            var membersResult = await membersResponse.Content.ReadFromJsonAsync<AzDoTeamMembersResponse>();

            var members = membersResult?.Value?
                .Where(m => IsValidUserEmail(m.Identity?.UniqueName))
                .Select(m => new TeamMember
                {
                    Id = m.Identity?.Id ?? "",
                    DisplayName = m.Identity?.DisplayName ?? "",
                    Email = m.Identity?.UniqueName,
                    UniqueName = m.Identity?.UniqueName,
                    AvatarUrl = m.Identity?.ImageUrl,
                    Source = "AzureDevOps"
                }).ToList() ?? new List<TeamMember>();

            await _cacheService.SetAsync(cacheKey, members, TimeSpan.FromMinutes(30));
            return members;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch Azure DevOps team members");
            return new List<TeamMember>();
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

    private PullRequest MapToPullRequest(AzDoPR pr)
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
        var projectName = pr.Repository?.Project?.Name ?? _configuration["AzureDevOps:Project"];
        var repoName = pr.Repository?.Name ?? "";

        var webUrl = !string.IsNullOrEmpty(orgUrl) && !string.IsNullOrEmpty(projectName) && !string.IsNullOrEmpty(repoName)
            ? $"{orgUrl}/{projectName}/_git/{repoName}/pullrequest/{pr.PullRequestId}"
            : null;

        var reviewers = pr.Reviewers?
            .Where(r => IsValidUserEmail(r.UniqueName))
            .Select(r => new PRReviewer
            {
                Id = r.Id ?? "",
                DisplayName = r.DisplayName ?? "",
                Email = r.UniqueName,
                UniqueName = r.UniqueName,
                AvatarUrl = r.ImageUrl,
                Vote = MapReviewVote(r.Vote),
                IsRequired = r.IsRequired
            }).ToList() ?? new List<PRReviewer>();

        return new PullRequest
        {
            Id = pr.PullRequestId.ToString(),
            Number = pr.PullRequestId,
            Title = pr.Title ?? "",
            Description = pr.Description ?? "",
            Status = pr.IsDraft ? PRStatus.Draft : MapPRStatus(pr.Status),
            SourceBranch = pr.SourceRefName?.Replace("refs/heads/", "") ?? "",
            TargetBranch = pr.TargetRefName?.Replace("refs/heads/", "") ?? "",
            Author = pr.CreatedBy?.DisplayName ?? "Unknown",
            AuthorEmail = pr.CreatedBy?.UniqueName,
            AuthorAvatarUrl = pr.CreatedBy?.ImageUrl,
            CreatedBy = new PRAuthor
            {
                DisplayName = pr.CreatedBy?.DisplayName,
                Email = pr.CreatedBy?.UniqueName,
                UniqueName = pr.CreatedBy?.UniqueName,
                AvatarUrl = pr.CreatedBy?.ImageUrl
            },
            CreatedAt = pr.CreationDate,
            Source = PRSource.AzureDevOps,
            IsDraft = pr.IsDraft,
            Url = webUrl ?? pr.Url,
            WebUrl = webUrl,
            Repository = repoName,
            Reviewers = reviewers
        };
    }

    private static ReviewVote MapReviewVote(int vote) => vote switch
    {
        10 => ReviewVote.Approved,
        5 => ReviewVote.ApprovedWithSuggestions,
        -5 => ReviewVote.WaitingForAuthor,
        -10 => ReviewVote.Rejected,
        _ => ReviewVote.NoVote
    };

    /// <summary>
    /// Checks if a UniqueName is a valid user email address (not a group identifier)
    /// </summary>
    private static bool IsValidUserEmail(string? uniqueName)
    {
        if (string.IsNullOrWhiteSpace(uniqueName))
            return false;

        var trimmed = uniqueName.Trim();

        if (!trimmed.Contains('@'))
            return false;

        if (trimmed.Contains("///Classification") ||
            trimmed.Contains("TeamProject") ||
            trimmed.Contains("VSTFS:") ||
            trimmed.Contains("[VSTFS:") ||
            trimmed.StartsWith("///") ||
            trimmed.StartsWith("["))
            return false;

        return true;
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

    #region Response Models

    private class AzDoBuildsResponse { public List<AzDoBuild>? Value { get; set; } }
    private class AzDoPRsResponse { public List<AzDoPR>? Value { get; set; } }
    private class AzDoTeamsResponse { public List<AzDoTeam>? Value { get; set; } }
    private class AzDoTeamMembersResponse { public List<AzDoTeamMember>? Value { get; set; } }

    private class AzDoTeam
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoTeamMember
    {
        public AzDoIdentity? Identity { get; set; }
    }

    private class AzDoBuild
    {
        public int Id { get; set; }
        public string? BuildNumber { get; set; }
        public string? Status { get; set; }
        public string? Result { get; set; }
        public string? SourceBranch { get; set; }
        public string? SourceVersion { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? FinishTime { get; set; }
        public AzDoDefinition? Definition { get; set; }
        public AzDoIdentity? RequestedBy { get; set; }

        [JsonPropertyName("_links")]
        public AzDoLinks? Links { get; set; }
    }

    private class AzDoDefinition { public int Id { get; set; } public string? Name { get; set; } }

    private class AzDoIdentity
    {
        public string? DisplayName { get; set; }
        public string? UniqueName { get; set; }
        public string? ImageUrl { get; set; }
        public string? Id { get; set; }
    }

    private class AzDoLinks
    {
        [JsonPropertyName("web")]
        public AzDoLink? Web { get; set; }
    }

    private class AzDoLink
    {
        [JsonPropertyName("href")]
        public string? Href { get; set; }
    }

    private class AzDoReviewer
    {
        public string? Id { get; set; }
        public string? DisplayName { get; set; }
        public string? UniqueName { get; set; }
        public string? ImageUrl { get; set; }
        public int Vote { get; set; }
        public bool IsRequired { get; set; }
    }

    private class AzDoPR
    {
        public int PullRequestId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Status { get; set; }
        public bool IsDraft { get; set; }
        public string? SourceRefName { get; set; }
        public string? TargetRefName { get; set; }
        public DateTime CreationDate { get; set; }
        public AzDoIdentity? CreatedBy { get; set; }
        public string? Url { get; set; }
        public AzDoPRRepository? Repository { get; set; }
        public List<AzDoReviewer>? Reviewers { get; set; }
    }

    private class AzDoPRRepository
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
        public AzDoPRProject? Project { get; set; }
    }

    private class AzDoPRProject
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }

    #endregion
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

            var repoConfig = _configuration["GitHub:Repo"]
                ?? _configuration["GitHub:Dev:Repos"]
                ?? _configuration["GitHub:Test:Repos"]
                ?? "";

            var repos = repoConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (string.IsNullOrEmpty(owner) || repos.Length == 0)
            {
                _logger.LogWarning("GitHub Owner or Repos not configured. Owner: {Owner}, Repos: {Repos}", owner, repoConfig);
                return new List<PullRequest>();
            }

            var allPRs = new List<PullRequest>();

            var tasks = repos.Select(async repo =>
            {
                try
                {
                    var response = await _httpClient.GetAsync($"repos/{owner}/{repo}/pulls?state={state}");
                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to fetch PRs from {Owner}/{Repo}: {StatusCode}", owner, repo, response.StatusCode);
                        return new List<PullRequest>();
                    }

                    var ghPRs = await response.Content.ReadFromJsonAsync<List<GitHubPR>>();
                    return ghPRs?.Select(pr => MapToPullRequest(pr, owner, repo)).ToList() ?? new List<PullRequest>();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to fetch PRs from {Owner}/{Repo}", owner, repo);
                    return new List<PullRequest>();
                }
            });

            var results = await Task.WhenAll(tasks);
            allPRs = results.SelectMany(prs => prs).ToList();

            await _cacheService.SetAsync(cacheKey, allPRs, TimeSpan.FromMinutes(2));
            return allPRs;
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

            var repoConfig = _configuration["GitHub:Repo"]
                ?? _configuration["GitHub:Dev:Repos"]
                ?? _configuration["GitHub:Test:Repos"]
                ?? "";

            var repos = repoConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var repo in repos)
            {
                var response = await _httpClient.GetAsync($"repos/{owner}/{repo}/pulls/{prNumber}");
                if (response.IsSuccessStatusCode)
                {
                    var ghPR = await response.Content.ReadFromJsonAsync<GitHubPR>();
                    return ghPR != null ? MapToPullRequest(ghPR, owner, repo) : null;
                }
            }

            return null;
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

            var repoConfig = _configuration["GitHub:Repo"]
                ?? _configuration["GitHub:Dev:Repos"]
                ?? _configuration["GitHub:Test:Repos"]
                ?? "";

            var repos = repoConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var repo in repos)
            {
                var response = await _httpClient.GetAsync($"repos/{owner}/{repo}/pulls/{prNumber}/comments");
                if (response.IsSuccessStatusCode)
                {
                    var ghComments = await response.Content.ReadFromJsonAsync<List<GitHubComment>>();
                    return ghComments?.Select(MapToComment).ToList() ?? new List<PRComment>();
                }
            }

            return new List<PRComment>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch comments for PR {PRNumber}", prNumber);
            return new List<PRComment>();
        }
    }

    public async Task<List<TeamMember>> GetOrganizationMembersAsync()
    {
        var cacheKey = "github:org:members";
        var cached = await _cacheService.GetAsync<List<TeamMember>>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var owner = _configuration["GitHub:Owner"];
            if (string.IsNullOrEmpty(owner))
            {
                _logger.LogWarning("GitHub Owner not configured");
                return new List<TeamMember>();
            }

            var response = await _httpClient.GetAsync($"orgs/{owner}/members");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Could not fetch org members (may need org:read scope), trying repo collaborators");
                return await GetRepoCollaboratorsAsync(owner);
            }

            var members = await response.Content.ReadFromJsonAsync<List<GitHubUser>>();
            var teamMembers = members?.Select(m => new TeamMember
            {
                Id = m.Id?.ToString() ?? "",
                DisplayName = m.Login ?? "",
                Email = m.Email,
                UniqueName = m.Login,
                AvatarUrl = m.AvatarUrl,
                Source = "GitHub"
            }).ToList() ?? new List<TeamMember>();

            await _cacheService.SetAsync(cacheKey, teamMembers, TimeSpan.FromMinutes(30));
            return teamMembers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub organization members");
            return new List<TeamMember>();
        }
    }

    private async Task<List<TeamMember>> GetRepoCollaboratorsAsync(string owner)
    {
        try
        {
            var repoConfig = _configuration["GitHub:Repo"]
                ?? _configuration["GitHub:Dev:Repos"]
                ?? _configuration["GitHub:Test:Repos"]
                ?? "";

            var repos = repoConfig.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            var allCollaborators = new Dictionary<string, TeamMember>();

            foreach (var repo in repos.Take(3))
            {
                var response = await _httpClient.GetAsync($"repos/{owner}/{repo}/collaborators");
                if (response.IsSuccessStatusCode)
                {
                    var collaborators = await response.Content.ReadFromJsonAsync<List<GitHubUser>>();
                    if (collaborators != null)
                    {
                        foreach (var c in collaborators)
                        {
                            if (c.Login != null && !allCollaborators.ContainsKey(c.Login))
                            {
                                allCollaborators[c.Login] = new TeamMember
                                {
                                    Id = c.Id?.ToString() ?? "",
                                    DisplayName = c.Login,
                                    Email = c.Email,
                                    UniqueName = c.Login,
                                    AvatarUrl = c.AvatarUrl,
                                    Source = "GitHub"
                                };
                            }
                        }
                    }
                }
            }

            return allCollaborators.Values.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch repo collaborators");
            return new List<TeamMember>();
        }
    }

    private PullRequest MapToPullRequest(GitHubPR pr, string? owner = null, string? repo = null)
    {
        owner ??= _configuration["GitHub:Owner"];
        repo ??= _configuration["GitHub:Repo"];

        var authorEmail = pr.User?.Email;

        var reviewers = pr.RequestedReviewers?.Select(r => new PRReviewer
        {
            Id = r.Id?.ToString() ?? "",
            DisplayName = r.Login ?? "",
            Email = r.Email,
            UniqueName = r.Login,
            AvatarUrl = r.AvatarUrl,
            Vote = ReviewVote.NoVote,
            IsRequired = false
        }).ToList() ?? new List<PRReviewer>();

        return new PullRequest
        {
            Id = pr.Id.ToString(),
            Number = pr.Number,
            Title = pr.Title ?? "",
            Description = pr.Body ?? "",
            Status = pr.Draft ? PRStatus.Draft : MapPRState(pr.State, pr.MergedAt),
            SourceBranch = pr.Head?.Ref ?? "",
            TargetBranch = pr.Base?.Ref ?? "",
            Author = pr.User?.Login ?? "Unknown",
            AuthorEmail = authorEmail,
            AuthorAvatarUrl = pr.User?.AvatarUrl,
            CreatedBy = new PRAuthor
            {
                DisplayName = pr.User?.Login,
                Email = authorEmail,
                UniqueName = pr.User?.Login,
                AvatarUrl = pr.User?.AvatarUrl
            },
            CreatedAt = pr.CreatedAt,
            UpdatedAt = pr.UpdatedAt,
            MergedAt = pr.MergedAt,
            ClosedAt = pr.ClosedAt,
            Url = pr.HtmlUrl,
            WebUrl = pr.HtmlUrl,
            Repository = $"{owner}/{repo}",
            Source = PRSource.GitHub,
            IsDraft = pr.Draft,
            AdditionsCount = pr.Additions,
            DeletionsCount = pr.Deletions,
            ChangedFilesCount = pr.ChangedFiles,
            Reviewers = reviewers
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

    #region Response Models

    private class GitHubPR
    {
        public long Id { get; set; }
        public int Number { get; set; }
        public string? Title { get; set; }
        public string? Body { get; set; }
        public string? State { get; set; }
        public bool Draft { get; set; }
        public GitHubRef? Head { get; set; }
        public GitHubRef? Base { get; set; }
        public GitHubUser? User { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }

        [JsonPropertyName("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [JsonPropertyName("merged_at")]
        public DateTime? MergedAt { get; set; }

        [JsonPropertyName("closed_at")]
        public DateTime? ClosedAt { get; set; }

        [JsonPropertyName("html_url")]
        public string? HtmlUrl { get; set; }

        public int Additions { get; set; }
        public int Deletions { get; set; }

        [JsonPropertyName("changed_files")]
        public int ChangedFiles { get; set; }

        [JsonPropertyName("requested_reviewers")]
        public List<GitHubUser>? RequestedReviewers { get; set; }
    }

    private class GitHubRef { public string? Ref { get; set; } }

    private class GitHubUser
    {
        public string? Login { get; set; }

        [JsonPropertyName("avatar_url")]
        public string? AvatarUrl { get; set; }

        public string? Email { get; set; }
        public long? Id { get; set; }
    }

    private class GitHubComment
    {
        public long Id { get; set; }
        public string? Body { get; set; }
        public GitHubUser? User { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }
        public string? Path { get; set; }
        public int? Line { get; set; }
    }

    #endregion
}
