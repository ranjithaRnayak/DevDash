using System.Net.Http.Json;
using DevDash.API.Models;

namespace DevDash.API.Services;

public interface ITeamActivityService
{
    Task<TeamActivityResponse> GetTeamActivitiesAsync(DateTime? since = null);
}

public class TeamActivityService : ITeamActivityService
{
    private readonly IPerformanceService _performanceService;
    private readonly IDevOpsService _devOpsService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<TeamActivityService> _logger;

    public TeamActivityService(
        IPerformanceService performanceService,
        IDevOpsService devOpsService,
        ICacheService cacheService,
        ILogger<TeamActivityService> logger)
    {
        _performanceService = performanceService;
        _devOpsService = devOpsService;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<TeamActivityResponse> GetTeamActivitiesAsync(DateTime? since = null)
    {
        var sinceTime = since ?? DateTime.UtcNow.AddHours(-24);
        var response = new TeamActivityResponse { Since = sinceTime };

        try
        {
            var teamInfo = await _performanceService.GetMyTeamAsync();
            if (string.IsNullOrEmpty(teamInfo.TeamId) || teamInfo.Members.Count == 0)
            {
                return response;
            }

            var teamMemberIds = teamInfo.Members.Select(m => m.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var teamMemberEmails = teamInfo.Members
                .Where(m => !string.IsNullOrEmpty(m.Email))
                .Select(m => m.Email.ToLowerInvariant())
                .ToHashSet();

            var currentUser = teamInfo.Members.FirstOrDefault(m => m.IsCurrentUser);
            var currentUserId = currentUser?.Id;

            var prTask = GetTeamPRActivitiesAsync(teamMemberIds, teamMemberEmails, currentUserId, sinceTime);
            var buildTask = GetTeamBuildActivitiesAsync(teamMemberIds, teamMemberEmails, currentUserId, sinceTime);

            await Task.WhenAll(prTask, buildTask);

            response.Activities.AddRange(await prTask);
            response.Activities.AddRange(await buildTask);

            response.Activities = response.Activities
                .OrderByDescending(a => a.Timestamp)
                .ToList();

            response.TeamName = teamInfo.TeamName;
            response.GeneratedAt = DateTime.UtcNow;

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch team activities");
            return response;
        }
    }

    private async Task<List<TeamActivity>> GetTeamPRActivitiesAsync(
        HashSet<string> teamMemberIds,
        HashSet<string> teamMemberEmails,
        string? currentUserId,
        DateTime sinceTime)
    {
        var activities = new List<TeamActivity>();

        try
        {
            var pullRequests = await _devOpsService.GetPullRequestsAsync(null);

            foreach (var pr in pullRequests)
            {
                if (pr.CreatedAt < sinceTime) continue;

                var authorId = pr.CreatedBy?.UniqueName ?? pr.AuthorEmail ?? "";
                var isTeamMember = teamMemberIds.Contains(authorId) ||
                                   teamMemberEmails.Contains(authorId.ToLowerInvariant()) ||
                                   teamMemberEmails.Contains(pr.AuthorEmail?.ToLowerInvariant() ?? "");

                if (!isTeamMember) continue;

                var isCurrentUser = string.Equals(authorId, currentUserId, StringComparison.OrdinalIgnoreCase);
                if (isCurrentUser) continue;

                var activityType = pr.IsDraft ? TeamActivityType.DraftPRCreated : TeamActivityType.PRCreated;

                activities.Add(new TeamActivity
                {
                    Id = $"pr-{pr.Id}",
                    Type = activityType,
                    Title = pr.Title,
                    Description = pr.IsDraft ? "Draft PR created" : "PR created",
                    Author = pr.Author,
                    AuthorAvatarUrl = pr.AuthorAvatarUrl,
                    Timestamp = pr.CreatedAt,
                    Url = pr.WebUrl ?? pr.Url,
                    Repository = pr.Repository
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch team PR activities");
        }

        return activities;
    }

    private async Task<List<TeamActivity>> GetTeamBuildActivitiesAsync(
        HashSet<string> teamMemberIds,
        HashSet<string> teamMemberEmails,
        string? currentUserId,
        DateTime sinceTime)
    {
        var activities = new List<TeamActivity>();

        try
        {
            var builds = await _devOpsService.GetRecentBuildsAsync(20, null);

            foreach (var build in builds)
            {
                if (build.FinishTime < sinceTime) continue;
                if (build.Result != BuildResult.Succeeded) continue;

                var requestedBy = build.RequestedBy ?? "";
                var isTeamMember = teamMemberEmails.Any(e =>
                    requestedBy.Contains(e, StringComparison.OrdinalIgnoreCase));

                if (!isTeamMember) continue;

                var isCurrentUser = requestedBy.Contains(currentUserId ?? "___", StringComparison.OrdinalIgnoreCase);
                if (isCurrentUser) continue;

                activities.Add(new TeamActivity
                {
                    Id = $"build-{build.Id}",
                    Type = TeamActivityType.PipelineSucceeded,
                    Title = build.PipelineName,
                    Description = $"Build #{build.BuildNumber} succeeded",
                    Author = build.RequestedBy ?? "Unknown",
                    Timestamp = build.FinishTime ?? DateTime.UtcNow,
                    Url = build.Url,
                    Repository = build.SourceBranch?.Replace("refs/heads/", "")
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch team build activities");
        }

        return activities;
    }
}
