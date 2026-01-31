using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevDash.API.Services;

/// <summary>
/// Interface for Performance Dashboard operations
/// </summary>
public interface IPerformanceService
{
    Task<AzDoUserInfo> GetAuthenticatedAzDoUserAsync();
    Task<List<DraftPullRequest>> GetMyDraftPRsAsync();
    Task<List<RecentCommit>> GetMyRecentCommitsAsync(int days = 7);
    Task<StoryPointsSummary> GetMyStoryPointsAsync();
    Task<List<DraftPullRequest>> GetGitHubDraftPRsAsync();
    Task<List<RecentCommit>> GetGitHubCommitsAsync(int days = 7);
    Task<TeamsMeetingResult> CreateCodeReviewMeetingAsync(CodeReviewMeetingRequest request);
}

/// <summary>
/// Performance Dashboard service - handles all user-specific DevOps data
/// </summary>
public class PerformanceService : IPerformanceService
{
    private readonly HttpClient _azDoClient;
    private readonly HttpClient _gitHubClient;
    private readonly HttpClient _graphClient;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<PerformanceService> _logger;

    // Cached authenticated user info
    private AzDoUserInfo? _cachedUser;

    public PerformanceService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<PerformanceService> logger)
    {
        _azDoClient = httpClientFactory.CreateClient("AzureDevOps");
        _gitHubClient = httpClientFactory.CreateClient("GitHub");
        _graphClient = httpClientFactory.CreateClient("MicrosoftGraph");
        _configuration = configuration;
        _cacheService = cacheService;
        _logger = logger;

        ConfigureClients();
    }

    private void ConfigureClients()
    {
        // Azure DevOps configuration
        var azDoOrgUrl = _configuration["AzureDevOps:OrganizationUrl"];
        var azDoPat = _configuration["AzureDevOps:PAT"];

        if (!string.IsNullOrEmpty(azDoOrgUrl))
        {
            _azDoClient.BaseAddress = new Uri(azDoOrgUrl.TrimEnd('/') + "/");
        }

        if (!string.IsNullOrEmpty(azDoPat))
        {
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($":{azDoPat}"));
            _azDoClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        }

        // GitHub configuration
        var gitHubApiUrl = _configuration["GitHub:ApiUrl"] ?? "https://api.github.com";
        var gitHubPat = _configuration["GitHub:PAT"];

        _gitHubClient.BaseAddress = new Uri(gitHubApiUrl.TrimEnd('/') + "/");
        _gitHubClient.DefaultRequestHeaders.Add("User-Agent", "DevDash");

        if (!string.IsNullOrEmpty(gitHubPat))
        {
            _gitHubClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", gitHubPat);
        }

        // Microsoft Graph configuration
        _graphClient.BaseAddress = new Uri("https://graph.microsoft.com/v1.0/");
    }

    /// <summary>
    /// Get the authenticated Azure DevOps user by calling /_apis/connectionData
    /// </summary>
    public async Task<AzDoUserInfo> GetAuthenticatedAzDoUserAsync()
    {
        // Check cache first
        var cacheKey = "azdo:authenticated-user";
        var cached = await _cacheService.GetAsync<AzDoUserInfo>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var response = await _azDoClient.GetAsync("_apis/connectionData?api-version=7.0");
            response.EnsureSuccessStatusCode();

            var data = await response.Content.ReadFromJsonAsync<ConnectionDataResponse>();

            if (data?.AuthenticatedUser == null)
            {
                throw new InvalidOperationException("Could not resolve authenticated user from Azure DevOps");
            }

            var userInfo = new AzDoUserInfo
            {
                Id = data.AuthenticatedUser.Id,
                DisplayName = data.AuthenticatedUser.ProviderDisplayName ?? data.AuthenticatedUser.DisplayName,
                Email = data.AuthenticatedUser.Properties?.Account?.FirstOrDefault() ?? "",
                UniqueName = data.AuthenticatedUser.UniqueName ?? ""
            };

            // Cache for 30 minutes
            await _cacheService.SetAsync(cacheKey, userInfo, TimeSpan.FromMinutes(30));
            _cachedUser = userInfo;

            return userInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get authenticated Azure DevOps user");
            throw;
        }
    }

    /// <summary>
    /// Get draft PRs created by the authenticated user (matches Azure DevOps "Mine" view)
    /// </summary>
    public async Task<List<DraftPullRequest>> GetMyDraftPRsAsync()
    {
        var drafts = new List<DraftPullRequest>();

        try
        {
            // First resolve the authenticated user
            var user = await GetAuthenticatedAzDoUserAsync();
            var project = _configuration["AzureDevOps:Project"];
            var repos = _configuration["AzureDevOps:Repos"]?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();

            // If no specific repos configured, get all repos in the project
            if (repos.Length == 0)
            {
                repos = await GetProjectRepositoriesAsync(project);
            }

            foreach (var repo in repos)
            {
                try
                {
                    // Use searchCriteria.creatorId with the authenticated user's ID
                    // This matches the "Mine" view in Azure DevOps (?_a=mine)
                    var url = $"{project}/_apis/git/repositories/{repo.Trim()}/pullrequests?" +
                              $"searchCriteria.status=active&" +
                              $"searchCriteria.creatorId={user.Id}&" +
                              $"$top=50&api-version=7.0";

                    var response = await _azDoClient.GetAsync(url);

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Failed to fetch PRs for repo {Repo}: {Status}", repo, response.StatusCode);
                        continue;
                    }

                    var result = await response.Content.ReadFromJsonAsync<AzDoPRListResponse>();

                    // Filter for draft PRs only
                    var userDrafts = result?.Value?
                        .Where(pr => pr.IsDraft == true)
                        .Select(pr => new DraftPullRequest
                        {
                            Id = pr.PullRequestId,
                            Title = pr.Title ?? "",
                            RepoName = pr.Repository?.Name ?? repo.Trim(),
                            RepoId = pr.Repository?.Id ?? "",
                            Url = BuildAzDoPRUrl(project, pr.Repository?.Name ?? repo.Trim(), pr.PullRequestId),
                            CreatedAt = pr.CreationDate,
                            TargetBranch = pr.TargetRefName?.Replace("refs/heads/", "") ?? "",
                            SourceBranch = pr.SourceRefName?.Replace("refs/heads/", "") ?? "",
                            Source = "Azure",
                            Reviewers = pr.Reviewers?.Select(r => new PRReviewerInfo
                            {
                                Id = r.Id ?? "",
                                DisplayName = r.DisplayName ?? "",
                                Vote = r.Vote,
                                IsRequired = r.IsRequired
                            }).ToList() ?? new List<PRReviewerInfo>()
                        })
                        .ToList() ?? new List<DraftPullRequest>();

                    drafts.AddRange(userDrafts);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error fetching PRs from repo {Repo}", repo);
                }
            }

            // Sort by creation date (newest first)
            drafts = drafts.OrderByDescending(d => d.CreatedAt).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch draft PRs");
        }

        return drafts;
    }

    /// <summary>
    /// Get recent commits by the authenticated user
    /// </summary>
    public async Task<List<RecentCommit>> GetMyRecentCommitsAsync(int days = 7)
    {
        var commits = new List<RecentCommit>();

        try
        {
            var user = await GetAuthenticatedAzDoUserAsync();
            var project = _configuration["AzureDevOps:Project"];
            var repos = _configuration["AzureDevOps:Repos"]?.Split(',', StringSplitOptions.RemoveEmptyEntries) ?? Array.Empty<string>();

            if (repos.Length == 0)
            {
                repos = await GetProjectRepositoriesAsync(project);
            }

            var fromDate = DateTime.UtcNow.AddDays(-days).ToString("o");

            foreach (var repo in repos)
            {
                try
                {
                    // Use author parameter with the user's email or unique name
                    var authorFilter = !string.IsNullOrEmpty(user.Email) ? user.Email : user.UniqueName;
                    var url = $"{project}/_apis/git/repositories/{repo.Trim()}/commits?" +
                              $"searchCriteria.author={Uri.EscapeDataString(authorFilter)}&" +
                              $"searchCriteria.fromDate={Uri.EscapeDataString(fromDate)}&" +
                              $"$top=15&api-version=7.0";

                    var response = await _azDoClient.GetAsync(url);

                    if (!response.IsSuccessStatusCode)
                    {
                        continue;
                    }

                    var result = await response.Content.ReadFromJsonAsync<AzDoCommitListResponse>();

                    var repoCommits = result?.Value?
                        .Select(c => new RecentCommit
                        {
                            Id = c.CommitId?.Substring(0, 7) ?? "",
                            FullId = c.CommitId ?? "",
                            Message = c.Comment?.Split('\n').FirstOrDefault() ?? "No message",
                            RepoName = repo.Trim(),
                            Url = BuildAzDoCommitUrl(project, repo.Trim(), c.CommitId ?? ""),
                            Date = c.Committer?.Date ?? c.Author?.Date ?? DateTime.UtcNow,
                            Source = "Azure",
                            AuthorName = c.Author?.Name ?? user.DisplayName
                        })
                        .ToList() ?? new List<RecentCommit>();

                    commits.AddRange(repoCommits);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error fetching commits from repo {Repo}", repo);
                }
            }

            // Sort by date and take top 15
            commits = commits.OrderByDescending(c => c.Date).Take(15).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch recent commits");
        }

        return commits;
    }

    /// <summary>
    /// Get story points for PBIs/User Stories not started in current sprint
    /// Excludes Tasks and only includes items in New/To Do/Approved states
    /// </summary>
    public async Task<StoryPointsSummary> GetMyStoryPointsAsync()
    {
        try
        {
            var user = await GetAuthenticatedAzDoUserAsync();
            var project = _configuration["AzureDevOps:Project"];

            // WIQL query for PBIs/User Stories only (exclude Tasks)
            // Filter for items assigned to current user, in current sprint, not started
            var wiqlQuery = new
            {
                query = $@"
                    SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Scheduling.StoryPoints], [System.WorkItemType]
                    FROM WorkItems
                    WHERE [System.TeamProject] = '{project}'
                    AND [System.AssignedTo] = '{user.Email}'
                    AND [System.WorkItemType] IN ('Product Backlog Item', 'User Story')
                    AND [System.IterationPath] UNDER @CurrentIteration
                    AND [System.State] NOT IN ('Done', 'Closed', 'Removed')
                    AND [System.State] IN ('New', 'To Do', 'Approved', 'Committed')
                    ORDER BY [Microsoft.VSTS.Scheduling.StoryPoints] DESC"
            };

            var wiqlResponse = await _azDoClient.PostAsJsonAsync(
                $"{project}/_apis/wit/wiql?api-version=7.0",
                wiqlQuery);

            if (!wiqlResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("WIQL query failed: {Status}", wiqlResponse.StatusCode);
                return new StoryPointsSummary();
            }

            var wiqlResult = await wiqlResponse.Content.ReadFromJsonAsync<WiqlResponse>();
            var workItemIds = wiqlResult?.WorkItems?.Select(wi => wi.Id).ToList() ?? new List<int>();

            if (workItemIds.Count == 0)
            {
                return new StoryPointsSummary { NotStarted = 0, Total = 0, Items = new List<WorkItemInfo>() };
            }

            // Fetch work item details (batch of up to 200)
            var idsToFetch = string.Join(",", workItemIds.Take(200));
            var detailsResponse = await _azDoClient.GetAsync(
                $"{project}/_apis/wit/workitems?ids={idsToFetch}&fields=System.Id,System.Title,System.State,Microsoft.VSTS.Scheduling.StoryPoints,System.WorkItemType&api-version=7.0");

            if (!detailsResponse.IsSuccessStatusCode)
            {
                return new StoryPointsSummary();
            }

            var detailsResult = await detailsResponse.Content.ReadFromJsonAsync<WorkItemsResponse>();

            var items = detailsResult?.Value?
                .Select(wi => new WorkItemInfo
                {
                    Id = wi.Id,
                    Title = wi.Fields?.Title ?? "",
                    State = wi.Fields?.State ?? "",
                    StoryPoints = wi.Fields?.StoryPoints ?? 0,
                    Type = wi.Fields?.WorkItemType ?? "",
                    Url = BuildAzDoWorkItemUrl(project, wi.Id)
                })
                .ToList() ?? new List<WorkItemInfo>();

            // Sum story points (treat null as 0)
            var totalPoints = items.Sum(i => i.StoryPoints);

            return new StoryPointsSummary
            {
                NotStarted = totalPoints,
                Total = items.Count,
                Items = items.Take(10).ToList() // Return top 10 for display
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch story points");
            return new StoryPointsSummary();
        }
    }

    /// <summary>
    /// Get draft PRs from GitHub for the authenticated user
    /// </summary>
    public async Task<List<DraftPullRequest>> GetGitHubDraftPRsAsync()
    {
        var drafts = new List<DraftPullRequest>();

        try
        {
            var owner = _configuration["GitHub:Owner"];
            var repo = _configuration["GitHub:Repo"];

            if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
            {
                return drafts;
            }

            // First get the authenticated GitHub user
            var userResponse = await _gitHubClient.GetAsync("user");
            if (!userResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get GitHub user");
                return drafts;
            }

            var ghUser = await userResponse.Content.ReadFromJsonAsync<GitHubUserResponse>();
            var username = ghUser?.Login;

            if (string.IsNullOrEmpty(username))
            {
                return drafts;
            }

            // Get open PRs
            var prsResponse = await _gitHubClient.GetAsync($"repos/{owner}/{repo}/pulls?state=open&per_page=100");
            if (!prsResponse.IsSuccessStatusCode)
            {
                return drafts;
            }

            var prs = await prsResponse.Content.ReadFromJsonAsync<List<GitHubPRResponse>>();

            // Filter for drafts created by the authenticated user
            drafts = prs?
                .Where(pr => pr.Draft == true && string.Equals(pr.User?.Login, username, StringComparison.OrdinalIgnoreCase))
                .Select(pr => new DraftPullRequest
                {
                    Id = pr.Number,
                    Title = pr.Title ?? "",
                    RepoName = repo,
                    RepoId = "",
                    Url = pr.HtmlUrl ?? "",
                    CreatedAt = pr.CreatedAt,
                    TargetBranch = pr.Base?.Ref ?? "",
                    SourceBranch = pr.Head?.Ref ?? "",
                    Source = "GitHub",
                    Reviewers = pr.RequestedReviewers?.Select(r => new PRReviewerInfo
                    {
                        Id = r.Id?.ToString() ?? "",
                        DisplayName = r.Login ?? "",
                        Vote = 0,
                        IsRequired = false
                    }).ToList() ?? new List<PRReviewerInfo>()
                })
                .ToList() ?? new List<DraftPullRequest>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub draft PRs");
        }

        return drafts;
    }

    /// <summary>
    /// Get recent commits from GitHub for the authenticated user
    /// </summary>
    public async Task<List<RecentCommit>> GetGitHubCommitsAsync(int days = 7)
    {
        var commits = new List<RecentCommit>();

        try
        {
            var owner = _configuration["GitHub:Owner"];
            var repo = _configuration["GitHub:Repo"];

            if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo))
            {
                return commits;
            }

            // Get authenticated user
            var userResponse = await _gitHubClient.GetAsync("user");
            if (!userResponse.IsSuccessStatusCode)
            {
                return commits;
            }

            var ghUser = await userResponse.Content.ReadFromJsonAsync<GitHubUserResponse>();
            var username = ghUser?.Login;

            if (string.IsNullOrEmpty(username))
            {
                return commits;
            }

            var since = DateTime.UtcNow.AddDays(-days).ToString("o");
            var commitsResponse = await _gitHubClient.GetAsync(
                $"repos/{owner}/{repo}/commits?author={username}&since={Uri.EscapeDataString(since)}&per_page=15");

            if (!commitsResponse.IsSuccessStatusCode)
            {
                return commits;
            }

            var ghCommits = await commitsResponse.Content.ReadFromJsonAsync<List<GitHubCommitResponse>>();

            commits = ghCommits?
                .Select(c => new RecentCommit
                {
                    Id = c.Sha?.Substring(0, 7) ?? "",
                    FullId = c.Sha ?? "",
                    Message = c.Commit?.Message?.Split('\n').FirstOrDefault() ?? "No message",
                    RepoName = repo,
                    Url = c.HtmlUrl ?? "",
                    Date = c.Commit?.Committer?.Date ?? c.Commit?.Author?.Date ?? DateTime.UtcNow,
                    Source = "GitHub",
                    AuthorName = c.Commit?.Author?.Name ?? username
                })
                .ToList() ?? new List<RecentCommit>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch GitHub commits");
        }

        return commits;
    }

    /// <summary>
    /// Create a Teams meeting for code review using Microsoft Graph
    /// </summary>
    public async Task<TeamsMeetingResult> CreateCodeReviewMeetingAsync(CodeReviewMeetingRequest request)
    {
        try
        {
            // Get the access token from the Graph configuration
            // In production, this should use managed identity or OAuth flow
            var graphToken = _configuration["MicrosoftGraph:AccessToken"];

            if (string.IsNullOrEmpty(graphToken))
            {
                // Return a deep link URL for client-side meeting creation
                return CreateTeamsMeetingDeepLink(request);
            }

            _graphClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", graphToken);

            // Build attendee list from reviewers
            var attendees = request.Reviewers?
                .Where(r => !string.IsNullOrEmpty(r.Email))
                .Select(r => new
                {
                    emailAddress = new { address = r.Email, name = r.DisplayName },
                    type = "required"
                })
                .ToList() ?? new List<object>();

            // Build meeting body with PR link
            var meetingBody = $@"
Code Review Meeting for PR #{request.PrId}

**Pull Request:** {request.PrTitle}
**Repository:** {request.RepoName}
**Link:** {request.PrUrl}

**Reviewers:**
{string.Join("\n", request.Reviewers?.Select(r => $"- {r.DisplayName}") ?? Array.Empty<string>())}

---
Scheduled via DevDash";

            var meetingRequest = new
            {
                subject = $"Code Review – PR #{request.PrId}",
                body = new { contentType = "text", content = meetingBody },
                start = new { dateTime = request.StartTime?.ToString("o") ?? DateTime.UtcNow.AddHours(1).ToString("o"), timeZone = "UTC" },
                end = new { dateTime = request.EndTime?.ToString("o") ?? DateTime.UtcNow.AddHours(2).ToString("o"), timeZone = "UTC" },
                attendees = attendees,
                isOnlineMeeting = true,
                onlineMeetingProvider = "teamsForBusiness"
            };

            var response = await _graphClient.PostAsJsonAsync("me/events", meetingRequest);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Graph API error: {Error}", error);
                return CreateTeamsMeetingDeepLink(request);
            }

            var result = await response.Content.ReadFromJsonAsync<GraphEventResponse>();

            return new TeamsMeetingResult
            {
                Success = true,
                MeetingUrl = result?.OnlineMeeting?.JoinUrl ?? "",
                EventId = result?.Id ?? "",
                WebLink = result?.WebLink ?? ""
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create Teams meeting via Graph API");
            return CreateTeamsMeetingDeepLink(request);
        }
    }

    #region Helper Methods

    private async Task<string[]> GetProjectRepositoriesAsync(string? project)
    {
        try
        {
            var response = await _azDoClient.GetAsync($"{project}/_apis/git/repositories?api-version=7.0");
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<AzDoReposResponse>();
                return result?.Value?.Select(r => r.Name ?? "").Where(n => !string.IsNullOrEmpty(n)).ToArray() ?? Array.Empty<string>();
            }
        }
        catch { }
        return Array.Empty<string>();
    }

    private string BuildAzDoPRUrl(string? project, string repo, int prId)
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
        return $"{orgUrl}/{project}/_git/{repo}/pullrequest/{prId}";
    }

    private string BuildAzDoCommitUrl(string? project, string repo, string commitId)
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
        return $"{orgUrl}/{project}/_git/{repo}/commit/{commitId}";
    }

    private string BuildAzDoWorkItemUrl(string? project, int workItemId)
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
        return $"{orgUrl}/{project}/_workitems/edit/{workItemId}";
    }

    private TeamsMeetingResult CreateTeamsMeetingDeepLink(CodeReviewMeetingRequest request)
    {
        var subject = Uri.EscapeDataString($"Code Review – PR #{request.PrId}");
        var body = Uri.EscapeDataString($"Code review for: {request.PrTitle}\nPR Link: {request.PrUrl}");
        var attendees = string.Join(",", request.Reviewers?.Select(r => r.Email).Where(e => !string.IsNullOrEmpty(e)) ?? Array.Empty<string>());

        // Teams deep link for creating a new meeting
        var teamsUrl = $"https://teams.microsoft.com/l/meeting/new?subject={subject}&content={body}";

        if (!string.IsNullOrEmpty(attendees))
        {
            teamsUrl += $"&attendees={Uri.EscapeDataString(attendees)}";
        }

        return new TeamsMeetingResult
        {
            Success = true,
            MeetingUrl = teamsUrl,
            IsDeepLink = true
        };
    }

    #endregion

    #region Response Models

    private class ConnectionDataResponse
    {
        public AuthenticatedUserInfo? AuthenticatedUser { get; set; }
    }

    private class AuthenticatedUserInfo
    {
        public string Id { get; set; } = "";
        public string? DisplayName { get; set; }
        public string? ProviderDisplayName { get; set; }
        public string? UniqueName { get; set; }
        public AuthUserProperties? Properties { get; set; }
    }

    private class AuthUserProperties
    {
        public List<string>? Account { get; set; }
    }

    private class AzDoPRListResponse
    {
        public List<AzDoPRItem>? Value { get; set; }
    }

    private class AzDoPRItem
    {
        public int PullRequestId { get; set; }
        public string? Title { get; set; }
        public bool? IsDraft { get; set; }
        public string? Status { get; set; }
        public string? SourceRefName { get; set; }
        public string? TargetRefName { get; set; }
        public DateTime CreationDate { get; set; }
        public AzDoRepoInfo? Repository { get; set; }
        public List<AzDoReviewerInfo>? Reviewers { get; set; }
    }

    private class AzDoRepoInfo
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoReviewerInfo
    {
        public string? Id { get; set; }
        public string? DisplayName { get; set; }
        public string? UniqueName { get; set; }
        public int Vote { get; set; }
        public bool IsRequired { get; set; }
    }

    private class AzDoCommitListResponse
    {
        public List<AzDoCommitItem>? Value { get; set; }
    }

    private class AzDoCommitItem
    {
        public string? CommitId { get; set; }
        public string? Comment { get; set; }
        public AzDoCommitPerson? Author { get; set; }
        public AzDoCommitPerson? Committer { get; set; }
    }

    private class AzDoCommitPerson
    {
        public string? Name { get; set; }
        public string? Email { get; set; }
        public DateTime Date { get; set; }
    }

    private class AzDoReposResponse
    {
        public List<AzDoRepoItem>? Value { get; set; }
    }

    private class AzDoRepoItem
    {
        public string? Id { get; set; }
        public string? Name { get; set; }
    }

    private class WiqlResponse
    {
        public List<WiqlWorkItem>? WorkItems { get; set; }
    }

    private class WiqlWorkItem
    {
        public int Id { get; set; }
    }

    private class WorkItemsResponse
    {
        public List<WorkItemDetail>? Value { get; set; }
    }

    private class WorkItemDetail
    {
        public int Id { get; set; }
        public WorkItemFields? Fields { get; set; }
    }

    private class WorkItemFields
    {
        [JsonPropertyName("System.Title")]
        public string? Title { get; set; }

        [JsonPropertyName("System.State")]
        public string? State { get; set; }

        [JsonPropertyName("Microsoft.VSTS.Scheduling.StoryPoints")]
        public double StoryPoints { get; set; }

        [JsonPropertyName("System.WorkItemType")]
        public string? WorkItemType { get; set; }
    }

    private class GitHubUserResponse
    {
        public string? Login { get; set; }
        public int? Id { get; set; }
        public string? Email { get; set; }
    }

    private class GitHubPRResponse
    {
        public int Number { get; set; }
        public string? Title { get; set; }
        public bool Draft { get; set; }
        public string? State { get; set; }
        public string? HtmlUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public GitHubRefInfo? Head { get; set; }
        public GitHubRefInfo? Base { get; set; }
        public GitHubUserResponse? User { get; set; }

        [JsonPropertyName("requested_reviewers")]
        public List<GitHubUserResponse>? RequestedReviewers { get; set; }
    }

    private class GitHubRefInfo
    {
        public string? Ref { get; set; }
    }

    private class GitHubCommitResponse
    {
        public string? Sha { get; set; }
        public string? HtmlUrl { get; set; }
        public GitHubCommitDetail? Commit { get; set; }
    }

    private class GitHubCommitDetail
    {
        public string? Message { get; set; }
        public GitHubCommitPerson? Author { get; set; }
        public GitHubCommitPerson? Committer { get; set; }
    }

    private class GitHubCommitPerson
    {
        public string? Name { get; set; }
        public string? Email { get; set; }
        public DateTime Date { get; set; }
    }

    private class GraphEventResponse
    {
        public string? Id { get; set; }
        public string? WebLink { get; set; }
        public GraphOnlineMeeting? OnlineMeeting { get; set; }
    }

    private class GraphOnlineMeeting
    {
        public string? JoinUrl { get; set; }
    }

    #endregion
}

#region Public DTOs

public class AzDoUserInfo
{
    public string Id { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Email { get; set; } = "";
    public string UniqueName { get; set; } = "";
}

public class DraftPullRequest
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string RepoName { get; set; } = "";
    public string RepoId { get; set; } = "";
    public string Url { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public string TargetBranch { get; set; } = "";
    public string SourceBranch { get; set; } = "";
    public string Source { get; set; } = "";
    public List<PRReviewerInfo> Reviewers { get; set; } = new();
}

public class PRReviewerInfo
{
    public string Id { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public int Vote { get; set; }
    public bool IsRequired { get; set; }
}

public class RecentCommit
{
    public string Id { get; set; } = "";
    public string FullId { get; set; } = "";
    public string Message { get; set; } = "";
    public string RepoName { get; set; } = "";
    public string Url { get; set; } = "";
    public DateTime Date { get; set; }
    public string Source { get; set; } = "";
    public string AuthorName { get; set; } = "";
}

public class StoryPointsSummary
{
    public double NotStarted { get; set; }
    public int Total { get; set; }
    public List<WorkItemInfo> Items { get; set; } = new();
}

public class WorkItemInfo
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string State { get; set; } = "";
    public double StoryPoints { get; set; }
    public string Type { get; set; } = "";
    public string Url { get; set; } = "";
}

public class CodeReviewMeetingRequest
{
    public int PrId { get; set; }
    public string PrTitle { get; set; } = "";
    public string PrUrl { get; set; } = "";
    public string RepoName { get; set; } = "";
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public List<MeetingAttendee>? Reviewers { get; set; }
}

public class MeetingAttendee
{
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
}

public class TeamsMeetingResult
{
    public bool Success { get; set; }
    public string MeetingUrl { get; set; } = "";
    public string? EventId { get; set; }
    public string? WebLink { get; set; }
    public bool IsDeepLink { get; set; }
    public string? Error { get; set; }
}

#endregion
