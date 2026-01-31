namespace DevDash.API.Models;

/// <summary>
/// Represents a common issue pattern that can occur in pipelines or PRs
/// </summary>
public class Issue
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public IssueCategory Category { get; set; }
    public IssueSeverity Severity { get; set; }
    public List<string> Keywords { get; set; } = new();
    public List<string> ErrorPatterns { get; set; } = new();
    public List<string> RelatedResolutionIds { get; set; } = new();
    public int OccurrenceCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public enum IssueCategory
{
    PipelineFailure,
    BuildError,
    TestFailure,
    DeploymentIssue,
    PRComment,
    CodeReview,
    SecurityVulnerability,
    PerformanceIssue,
    ConfigurationError,
    DependencyIssue
}

public enum IssueSeverity
{
    Low,
    Medium,
    High,
    Critical
}

/// <summary>
/// Represents a resolution/solution for an issue
/// </summary>
public class Resolution
{
    public string Id { get; set; } = string.Empty;
    public string IssueId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Steps { get; set; } = new();
    public string? CodeSnippet { get; set; }
    public string? DocumentationUrl { get; set; }
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public double SuccessRate => SuccessCount + FailureCount > 0
        ? (double)SuccessCount / (SuccessCount + FailureCount) * 100
        : 0;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
}

/// <summary>
/// Common pipeline failure patterns with pre-defined resolutions
/// </summary>
public static class CommonIssues
{
    public static readonly List<Issue> PipelineIssues = new()
    {
        new Issue
        {
            Id = "pip-001",
            Title = "NuGet Package Restore Failed",
            Description = "Pipeline fails during package restore phase",
            Category = IssueCategory.PipelineFailure,
            Severity = IssueSeverity.High,
            Keywords = new() { "nuget", "restore", "package", "dependency" },
            ErrorPatterns = new() { "Unable to resolve", "Package not found", "401 Unauthorized" }
        },
        new Issue
        {
            Id = "pip-002",
            Title = "Build Timeout",
            Description = "Pipeline build step exceeds time limit",
            Category = IssueCategory.BuildError,
            Severity = IssueSeverity.Medium,
            Keywords = new() { "timeout", "exceeded", "time limit" },
            ErrorPatterns = new() { "Job exceeded maximum execution time", "Timeout expired" }
        },
        new Issue
        {
            Id = "pip-003",
            Title = "Unit Test Failures",
            Description = "One or more unit tests failed during pipeline execution",
            Category = IssueCategory.TestFailure,
            Severity = IssueSeverity.High,
            Keywords = new() { "test", "unit test", "assertion", "failed" },
            ErrorPatterns = new() { "Test failed", "Assert.Equal", "Expected", "Actual" }
        },
        new Issue
        {
            Id = "pip-004",
            Title = "Docker Build Failed",
            Description = "Container image build process failed",
            Category = IssueCategory.BuildError,
            Severity = IssueSeverity.High,
            Keywords = new() { "docker", "container", "image", "dockerfile" },
            ErrorPatterns = new() { "COPY failed", "RUN failed", "No such file" }
        },
        new Issue
        {
            Id = "pip-005",
            Title = "Agent Pool Unavailable",
            Description = "No agents available in the pool to run the pipeline",
            Category = IssueCategory.PipelineFailure,
            Severity = IssueSeverity.Critical,
            Keywords = new() { "agent", "pool", "unavailable", "offline" },
            ErrorPatterns = new() { "No agent found", "All agents are offline" }
        }
    };

    public static readonly List<Issue> PRIssues = new()
    {
        new Issue
        {
            Id = "pr-001",
            Title = "Merge Conflicts",
            Description = "PR has conflicts with the target branch",
            Category = IssueCategory.PRComment,
            Severity = IssueSeverity.Medium,
            Keywords = new() { "conflict", "merge", "rebase" },
            ErrorPatterns = new() { "CONFLICT", "Automatic merge failed" }
        },
        new Issue
        {
            Id = "pr-002",
            Title = "Code Review Required",
            Description = "PR needs additional reviewers or approvals",
            Category = IssueCategory.CodeReview,
            Severity = IssueSeverity.Low,
            Keywords = new() { "review", "approval", "reviewer" },
            ErrorPatterns = new() { "Waiting for review", "Needs approval" }
        },
        new Issue
        {
            Id = "pr-003",
            Title = "Security Scan Failed",
            Description = "Security vulnerability detected in the code changes",
            Category = IssueCategory.SecurityVulnerability,
            Severity = IssueSeverity.Critical,
            Keywords = new() { "security", "vulnerability", "CVE", "scan" },
            ErrorPatterns = new() { "Security vulnerability", "CVE-", "Critical severity" }
        }
    };
}
