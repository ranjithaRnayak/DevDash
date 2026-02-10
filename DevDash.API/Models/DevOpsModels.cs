namespace DevDash.API.Models;

/// <summary>
/// Pipeline build information
/// </summary>
public class PipelineBuild
{
    public string Id { get; set; } = string.Empty;
    public string PipelineName { get; set; } = string.Empty;
    public string PipelineId { get; set; } = string.Empty;
    public int BuildNumber { get; set; }
    public BuildStatus Status { get; set; }
    public BuildResult? Result { get; set; }
    public string? SourceBranch { get; set; }
    public string? SourceVersion { get; set; }
    public string? RequestedBy { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? FinishTime { get; set; }
    public TimeSpan? Duration => FinishTime.HasValue && StartTime.HasValue
        ? FinishTime.Value - StartTime.Value
        : null;
    public string? Url { get; set; }
    public List<BuildStage> Stages { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public enum BuildStatus
{
    NotStarted,
    InProgress,
    Completed,
    Cancelling,
    Postponed,
    NotSet
}

public enum BuildResult
{
    Succeeded,
    PartiallySucceeded,
    Failed,
    Canceled,
    None
}

/// <summary>
/// Pipeline stage/job information
/// </summary>
public class BuildStage
{
    public string Name { get; set; } = string.Empty;
    public BuildResult? Result { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? FinishTime { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Pull Request information
/// </summary>
public class PullRequest
{
    public string Id { get; set; } = string.Empty;
    public int Number { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public PRStatus Status { get; set; }
    public string SourceBranch { get; set; } = string.Empty;
    public string TargetBranch { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorEmail { get; set; }
    public string? AuthorAvatarUrl { get; set; }
    public PRAuthor? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? MergedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? Url { get; set; }
    public string? WebUrl { get; set; }
    public string? Repository { get; set; }
    public List<PRReviewer> Reviewers { get; set; } = new();
    public List<PRComment> Comments { get; set; } = new();
    public PRSource Source { get; set; }
    public bool IsDraft { get; set; }
    public bool HasConflicts { get; set; }
    public int AdditionsCount { get; set; }
    public int DeletionsCount { get; set; }
    public int ChangedFilesCount { get; set; }
}

/// <summary>
/// PR author information
/// </summary>
public class PRAuthor
{
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? UniqueName { get; set; }
    public string? AvatarUrl { get; set; }
}

public enum PRStatus
{
    Open,
    Closed,
    Merged,
    Draft
}

public enum PRSource
{
    AzureDevOps,
    GitHub
}

/// <summary>
/// PR reviewer information
/// </summary>
public class PRReviewer
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? UniqueName { get; set; }
    public string? AvatarUrl { get; set; }
    public ReviewVote Vote { get; set; }
    public bool IsRequired { get; set; }
}

public enum ReviewVote
{
    Approved = 10,
    ApprovedWithSuggestions = 5,
    NoVote = 0,
    WaitingForAuthor = -5,
    Rejected = -10
}

/// <summary>
/// PR comment information
/// </summary>
public class PRComment
{
    public string Id { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? AuthorAvatarUrl { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public CommentType Type { get; set; }
    public string? FilePath { get; set; }
    public int? LineNumber { get; set; }
    public bool IsResolved { get; set; }
}

public enum CommentType
{
    General,
    CodeReview,
    System
}

/// <summary>
/// Dashboard summary data
/// </summary>
public class DashboardSummary
{
    public int TotalPipelines { get; set; }
    public int SuccessfulBuilds { get; set; }
    public int FailedBuilds { get; set; }
    public int InProgressBuilds { get; set; }
    public double SuccessRate { get; set; }
    public int OpenPRs { get; set; }
    public int PRsNeedingReview { get; set; }
    public int PRsWithConflicts { get; set; }
    public List<PipelineBuild> RecentBuilds { get; set; } = new();
    public List<PullRequest> RecentPRs { get; set; } = new();
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// PR Alerts configuration from appsettings
/// </summary>
public class PRAlertsConfig
{
    public int OverdueHours { get; set; } = 48;
    public int StalePRDays { get; set; } = 7;
    public int RequiredApprovers { get; set; } = 2;
    public OverdueEmailConfig? OverdueEmail { get; set; }
    public List<string> DefaultReviewers { get; set; } = new();
    public List<TeamMember> TeamMembers { get; set; } = new();
}

public class OverdueEmailConfig
{
    public List<string> To { get; set; } = new();
    public List<string> Cc { get; set; } = new();
    public string Subject { get; set; } = "Overdue PR Alert - Action Required";
}

/// <summary>
/// Team member information
/// </summary>
public class TeamMember
{
    public string Id { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? UniqueName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Source { get; set; } = string.Empty; // "AzureDevOps" or "GitHub"
}
