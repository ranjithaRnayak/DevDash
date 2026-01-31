using DevDash.API.Models;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.QueryDsl;

namespace DevDash.API.Services;

/// <summary>
/// Interface for issue search operations
/// </summary>
public interface IIssueSearchService
{
    Task<List<Issue>> SearchIssuesAsync(string query, int limit = 10);
    Task<List<Resolution>> SearchResolutionsAsync(string issueId, int limit = 5);
    Task<List<Issue>> GetSimilarIssuesAsync(string errorPattern, int limit = 5);
    Task IndexIssueAsync(Issue issue);
    Task IndexResolutionAsync(Resolution resolution);
    Task<Issue?> GetIssueByIdAsync(string id);
}

/// <summary>
/// Elasticsearch implementation of issue search service
/// </summary>
public class ElasticsearchIssueService : IIssueSearchService
{
    private readonly ElasticsearchClient? _client;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ElasticsearchIssueService> _logger;
    private readonly string _issuesIndex;
    private readonly string _resolutionsIndex;

    public ElasticsearchIssueService(
        IConfiguration configuration,
        ILogger<ElasticsearchIssueService> logger,
        ElasticsearchClient? client = null)
    {
        _configuration = configuration;
        _logger = logger;
        _client = client;
        _issuesIndex = configuration["Elasticsearch:IssuesIndex"] ?? "devdash-issues";
        _resolutionsIndex = configuration["Elasticsearch:ResolutionsIndex"] ?? "devdash-resolutions";
    }

    public async Task<List<Issue>> SearchIssuesAsync(string query, int limit = 10)
    {
        if (_client == null)
        {
            return SearchInMemoryIssues(query, limit);
        }

        try
        {
            var response = await _client.SearchAsync<Issue>(s => s
                .Index(_issuesIndex)
                .Size(limit)
                .Query(q => q
                    .Bool(b => b
                        .Should(
                            sh => sh.Match(m => m.Field(f => f.Title).Query(query).Boost(2)),
                            sh => sh.Match(m => m.Field(f => f.Description).Query(query)),
                            sh => sh.Match(m => m.Field(f => f.Keywords).Query(query).Boost(1.5)),
                            sh => sh.Match(m => m.Field(f => f.ErrorPatterns).Query(query).Boost(3))
                        )
                    )
                )
            );

            return response.Documents.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Elasticsearch search failed, falling back to in-memory");
            return SearchInMemoryIssues(query, limit);
        }
    }

    public async Task<List<Resolution>> SearchResolutionsAsync(string issueId, int limit = 5)
    {
        if (_client == null)
        {
            return GetInMemoryResolutions(issueId, limit);
        }

        try
        {
            var response = await _client.SearchAsync<Resolution>(s => s
                .Index(_resolutionsIndex)
                .Size(limit)
                .Query(q => q
                    .Term(t => t.Field(f => f.IssueId).Value(issueId))
                )
                .Sort(so => so
                    .Field(f => f.SuccessCount, new FieldSort { Order = SortOrder.Desc })
                )
            );

            return response.Documents.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Elasticsearch resolution search failed");
            return GetInMemoryResolutions(issueId, limit);
        }
    }

    public async Task<List<Issue>> GetSimilarIssuesAsync(string errorPattern, int limit = 5)
    {
        if (_client == null)
        {
            return SearchInMemoryIssues(errorPattern, limit);
        }

        try
        {
            var response = await _client.SearchAsync<Issue>(s => s
                .Index(_issuesIndex)
                .Size(limit)
                .Query(q => q
                    .MoreLikeThis(mlt => mlt
                        .Fields(new[] { "title", "description", "errorPatterns" })
                        .Like(l => l.Text(errorPattern))
                        .MinTermFreq(1)
                        .MinDocFreq(1)
                    )
                )
            );

            return response.Documents.ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Elasticsearch similar issues search failed");
            return SearchInMemoryIssues(errorPattern, limit);
        }
    }

    public async Task IndexIssueAsync(Issue issue)
    {
        if (_client == null)
        {
            _logger.LogWarning("Elasticsearch not configured, issue not indexed");
            return;
        }

        try
        {
            await _client.IndexAsync(issue, i => i.Index(_issuesIndex).Id(issue.Id));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to index issue {IssueId}", issue.Id);
        }
    }

    public async Task IndexResolutionAsync(Resolution resolution)
    {
        if (_client == null)
        {
            _logger.LogWarning("Elasticsearch not configured, resolution not indexed");
            return;
        }

        try
        {
            await _client.IndexAsync(resolution, i => i.Index(_resolutionsIndex).Id(resolution.Id));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to index resolution {ResolutionId}", resolution.Id);
        }
    }

    public async Task<Issue?> GetIssueByIdAsync(string id)
    {
        if (_client == null)
        {
            return CommonIssues.PipelineIssues
                .Concat(CommonIssues.PRIssues)
                .FirstOrDefault(i => i.Id == id);
        }

        try
        {
            var response = await _client.GetAsync<Issue>(id, g => g.Index(_issuesIndex));
            return response.Source;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get issue {IssueId}", id);
            return null;
        }
    }

    // Fallback methods using in-memory common issues
    private List<Issue> SearchInMemoryIssues(string query, int limit)
    {
        var queryLower = query.ToLowerInvariant();

        return CommonIssues.PipelineIssues
            .Concat(CommonIssues.PRIssues)
            .Where(i =>
                i.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                i.Description.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                i.Keywords.Any(k => k.Contains(queryLower, StringComparison.OrdinalIgnoreCase)) ||
                i.ErrorPatterns.Any(p => queryLower.Contains(p.ToLowerInvariant())))
            .Take(limit)
            .ToList();
    }

    private List<Resolution> GetInMemoryResolutions(string issueId, int limit)
    {
        // Return predefined resolutions for common issues
        var resolutions = new Dictionary<string, List<Resolution>>
        {
            ["pip-001"] = new()
            {
                new Resolution
                {
                    Id = "res-001",
                    IssueId = "pip-001",
                    Title = "Clear NuGet Cache",
                    Description = "Clear the NuGet cache and restore packages again",
                    Steps = new() { "Run: dotnet nuget locals all --clear", "Run: dotnet restore", "Retry the build" },
                    SuccessCount = 150
                },
                new Resolution
                {
                    Id = "res-002",
                    IssueId = "pip-001",
                    Title = "Check NuGet Sources",
                    Description = "Verify NuGet package sources are accessible",
                    Steps = new() { "Check nuget.config for correct sources", "Verify network connectivity", "Check authentication for private feeds" },
                    SuccessCount = 85
                }
            },
            ["pip-003"] = new()
            {
                new Resolution
                {
                    Id = "res-003",
                    IssueId = "pip-003",
                    Title = "Review Test Logs",
                    Description = "Analyze test failure messages",
                    Steps = new() { "Check the test output for specific failure messages", "Look for assertion failures", "Check for environment-specific issues" },
                    SuccessCount = 200
                }
            }
        };

        return resolutions.TryGetValue(issueId, out var result)
            ? result.Take(limit).ToList()
            : new List<Resolution>();
    }
}
