using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Interface for Azure DevOps Test Plan operations
/// </summary>
public interface ITestPlanService
{
    Task<TestPlanProgress> GetTestPlanProgressAsync(bool bypassCache = false);
    Task<List<AvailableTestPlan>> GetAvailableTestPlansAsync();
    TestPlanDebugInfo GetDebugInfo();
}

/// <summary>
/// Represents an available test plan from Azure DevOps
/// </summary>
public class AvailableTestPlan
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Debug information for TestPlanService configuration
/// </summary>
public class TestPlanDebugInfo
{
    public string? OrganizationUrl { get; set; }
    public string? AnalyticsUrl { get; set; }
    public string? Project { get; set; }
    public bool HasPAT { get; set; }
    public int ConfiguredPlanCount { get; set; }
    public List<string> ConfiguredPlanNames { get; set; } = new();
    public bool HttpClientConfigured { get; set; }
    public string? HttpClientBaseAddress { get; set; }
}

/// <summary>
/// Azure DevOps Test Plan API integration service using Analytics OData API
/// </summary>
public class TestPlanService : ITestPlanService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<TestPlanService> _logger;
    private string? _analyticsBaseUrl;
    private string? _organization;

    public TestPlanService(
        HttpClient httpClient,
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<TestPlanService> logger)
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
        var project = _configuration["AzureDevOps:Project"];
        var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();

        // Extract organization name from URL
        if (!string.IsNullOrEmpty(orgUrl))
        {
            if (orgUrl.Contains("visualstudio.com"))
            {
                var uri = new Uri(orgUrl);
                _organization = uri.Host.Split('.')[0];
            }
            else if (orgUrl.Contains("dev.azure.com"))
            {
                var uri = new Uri(orgUrl);
                _organization = uri.AbsolutePath.Trim('/').Split('/')[0];
            }
            else
            {
                _organization = orgUrl.TrimEnd('/').Split('/').Last();
            }

            _analyticsBaseUrl = $"https://analytics.dev.azure.com/{_organization}";
        }

        _logger.LogInformation("TestPlanService initialized - Analytics: {AnalyticsUrl}, Project: {Project}, Plans configured: {PlanCount}",
            _analyticsBaseUrl ?? "NOT SET",
            project ?? "NOT SET",
            plansConfig.Count);

        if (string.IsNullOrEmpty(orgUrl))
        {
            _logger.LogWarning("AzureDevOps:OrganizationUrl is not configured");
            return;
        }

        _httpClient.BaseAddress = new Uri(orgUrl.TrimEnd('/') + "/");

        if (!string.IsNullOrEmpty(pat))
        {
            var credentials = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($":{pat}"));
            _httpClient.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", credentials);
        }
    }

    public TestPlanDebugInfo GetDebugInfo()
    {
        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"];
        var project = _configuration["AzureDevOps:Project"];
        var pat = _configuration["AzureDevOps:PAT"];
        var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();

        return new TestPlanDebugInfo
        {
            OrganizationUrl = orgUrl,
            AnalyticsUrl = _analyticsBaseUrl,
            Project = project,
            HasPAT = !string.IsNullOrEmpty(pat),
            ConfiguredPlanCount = plansConfig.Count,
            ConfiguredPlanNames = plansConfig.Select(p => p.Name).ToList(),
            HttpClientConfigured = _httpClient.BaseAddress != null,
            HttpClientBaseAddress = _httpClient.BaseAddress?.ToString()
        };
    }

    public async Task<TestPlanProgress> GetTestPlanProgressAsync(bool bypassCache = false)
    {
        var cacheDuration = _configuration.GetValue<int>("TestPlans:CacheDurationMinutes", 5);
        var cacheKey = "testplans:progress";

        if (!bypassCache)
        {
            var cached = await _cacheService.GetAsync<TestPlanProgress>(cacheKey);
            if (cached != null)
            {
                return cached;
            }
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
            var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();

            if (plansConfig.Count == 0)
            {
                _logger.LogWarning("No test plans configured");
                return new TestPlanProgress();
            }

            var progress = new TestPlanProgress();
            var allPlans = await GetAllTestPlansAsync(project!);

            foreach (var planConfig in plansConfig)
            {
                var matchingPlan = allPlans.FirstOrDefault(p =>
                    p.Name?.Contains(planConfig.Name, StringComparison.OrdinalIgnoreCase) == true ||
                    planConfig.Name.Contains(p.Name ?? "", StringComparison.OrdinalIgnoreCase));

                if (matchingPlan == null)
                {
                    _logger.LogWarning("Test plan '{PlanName}' not found", planConfig.Name);
                    continue;
                }

                var planSummary = await GetTestPlanProgressFromAnalyticsAsync(
                    project!,
                    matchingPlan.Id,
                    matchingPlan.Name ?? planConfig.Name,
                    planConfig.Suites,
                    orgUrl!);

                if (planSummary != null)
                {
                    progress.Plans.Add(planSummary);
                }
            }

            // Calculate totals
            progress.TotalTestCases = progress.Plans.Sum(p => p.TotalTests);
            progress.PassedCount = progress.Plans.Sum(p => p.PassedCount);
            progress.FailedCount = progress.Plans.Sum(p => p.FailedCount);
            progress.BlockedCount = progress.Plans.Sum(p => p.BlockedCount);
            progress.NotRunCount = progress.Plans.Sum(p => p.NotRunCount);
            progress.OverallPassRate = progress.TotalTestCases > 0
                ? Math.Round((double)progress.PassedCount / progress.TotalTestCases * 100, 1)
                : 0;
            progress.GeneratedAt = DateTime.UtcNow;

            _logger.LogInformation("Test plan progress: {PlanCount} plans, {TotalTests} tests, {PassRate}% pass rate",
                progress.Plans.Count, progress.TotalTestCases, progress.OverallPassRate);

            await _cacheService.SetAsync(cacheKey, progress, TimeSpan.FromMinutes(cacheDuration));
            return progress;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test plan progress");
            return new TestPlanProgress();
        }
    }

    private async Task<TestPlanSummary?> GetTestPlanProgressFromAnalyticsAsync(
        string project,
        int planId,
        string planName,
        List<string>? suiteFilters,
        string orgUrl)
    {
        // Analytics API doesn't support Passed/Failed/etc fields when filtering by TestPlanId
        // in this Azure DevOps project, so use REST API directly
        return await GetTestPlanProgressFromRestApiAsync(project, planId, planName, suiteFilters, orgUrl);
    }

    private async Task<TestPlanSummary?> GetTestPlanProgressFromRestApiAsync(
        string project,
        int planId,
        string planName,
        List<string>? suiteFilters,
        string orgUrl)
    {
        try
        {
            var planSummary = new TestPlanSummary
            {
                Id = planId,
                Name = planName,
                Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}"
            };

            // Get ALL test points for the entire plan (includes all child suites)
            var allTestPoints = await GetAllTestPointsForPlanAsync(project, planId);

            // Calculate plan totals
            planSummary.TotalTests = allTestPoints.Count;
            planSummary.PassedCount = allTestPoints.Count(tp => tp.Results?.Outcome?.Equals("passed", StringComparison.OrdinalIgnoreCase) == true);
            planSummary.FailedCount = allTestPoints.Count(tp => tp.Results?.Outcome?.Equals("failed", StringComparison.OrdinalIgnoreCase) == true);
            planSummary.BlockedCount = allTestPoints.Count(tp => tp.Results?.Outcome?.Equals("blocked", StringComparison.OrdinalIgnoreCase) == true);
            planSummary.NotRunCount = planSummary.TotalTests - planSummary.PassedCount - planSummary.FailedCount - planSummary.BlockedCount;

            // Calculate pass rate as Passed / Executed (Azure DevOps style)
            var executedCount = planSummary.PassedCount + planSummary.FailedCount + planSummary.BlockedCount;
            planSummary.PassRate = executedCount > 0
                ? Math.Round((double)planSummary.PassedCount / executedCount * 100, 1)
                : 0;

            // Group test points by suite for breakdown
            var suiteGroups = allTestPoints
                .Where(tp => tp.TestSuite != null)
                .GroupBy(tp => new { tp.TestSuite!.Id, tp.TestSuite.Name })
                .ToList();

            foreach (var group in suiteGroups)
            {
                var suiteName = group.Key.Name ?? $"Suite {group.Key.Id}";

                var passed = group.Count(tp => tp.Results?.Outcome?.Equals("passed", StringComparison.OrdinalIgnoreCase) == true);
                var failed = group.Count(tp => tp.Results?.Outcome?.Equals("failed", StringComparison.OrdinalIgnoreCase) == true);
                var blocked = group.Count(tp => tp.Results?.Outcome?.Equals("blocked", StringComparison.OrdinalIgnoreCase) == true);
                var executed = passed + failed + blocked;

                var suiteSummary = new TestSuiteSummary
                {
                    Id = group.Key.Id,
                    PlanId = planId,
                    Name = suiteName,
                    Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}&suiteId={group.Key.Id}",
                    TotalTests = group.Count(),
                    PassedCount = passed,
                    FailedCount = failed,
                    BlockedCount = blocked,
                    NotRunCount = group.Count() - executed,
                    PassRate = executed > 0 ? Math.Round((double)passed / executed * 100, 1) : 0
                };

                if (suiteSummary.TotalTests > 0)
                {
                    planSummary.Suites.Add(suiteSummary);
                }
            }

            return planSummary;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get test plan progress from REST API for plan {PlanId}", planId);
            return null;
        }
    }

    private async Task<List<AzDoTestPoint>> GetAllTestPointsForPlanAsync(string project, int planId)
    {
        var allPoints = new List<AzDoTestPoint>();

        try
        {
            // First, get all suites for this plan
            var suites = await GetAllSuitesForPlanAsync(project, planId);
            _logger.LogInformation("Found {SuiteCount} suites for plan {PlanId}", suites.Count, planId);

            // Get test points from each suite
            foreach (var suite in suites)
            {
                var suitePoints = await GetTestPointsForSuiteAsync(project, planId, suite.Id, suite.Name);
                allPoints.AddRange(suitePoints);
            }

            _logger.LogInformation("Total test points for plan {PlanId}: {PointCount}", planId, allPoints.Count);
            return allPoints;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch all test points for plan {PlanId}", planId);
            return allPoints;
        }
    }

    private async Task<List<AzDoTestSuiteInfo>> GetAllSuitesForPlanAsync(string project, int planId)
    {
        var allSuites = new List<AzDoTestSuiteInfo>();
        string? continuationToken = null;

        try
        {
            do
            {
                var url = $"{project}/_apis/testplan/Plans/{planId}/suites?api-version=7.0&asTreeView=false";
                if (!string.IsNullOrEmpty(continuationToken))
                {
                    url += $"&continuationToken={continuationToken}";
                }

                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Failed to get suites for plan {PlanId}: {StatusCode} - {Error}",
                        planId, response.StatusCode, errorContent);
                    break;
                }

                var result = await response.Content.ReadFromJsonAsync<AzDoTestSuitesInfoResponse>();
                var suites = result?.Value ?? new List<AzDoTestSuiteInfo>();
                allSuites.AddRange(suites);

                continuationToken = null;
                if (response.Headers.TryGetValues("x-ms-continuationtoken", out var tokens))
                {
                    continuationToken = tokens.FirstOrDefault();
                }

            } while (!string.IsNullOrEmpty(continuationToken));

            return allSuites;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch suites for plan {PlanId}", planId);
            return allSuites;
        }
    }

    private async Task<List<AzDoTestPoint>> GetTestPointsForSuiteAsync(string project, int planId, int suiteId, string? suiteName)
    {
        var allPoints = new List<AzDoTestPoint>();
        string? continuationToken = null;

        try
        {
            do
            {
                var url = $"{project}/_apis/testplan/Plans/{planId}/Suites/{suiteId}/TestPoint?api-version=7.0";
                if (!string.IsNullOrEmpty(continuationToken))
                {
                    url += $"&continuationToken={continuationToken}";
                }

                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    // Some suites may not have test points, that's OK
                    break;
                }

                var result = await response.Content.ReadFromJsonAsync<AzDoTestPointsResponse>();
                var points = result?.Value ?? new List<AzDoTestPoint>();

                // Set suite info on each point for grouping later
                foreach (var point in points)
                {
                    point.TestSuite = new AzDoTestSuiteRef { Id = suiteId, Name = suiteName };
                }

                allPoints.AddRange(points);

                continuationToken = null;
                if (response.Headers.TryGetValues("x-ms-continuationtoken", out var tokens))
                {
                    continuationToken = tokens.FirstOrDefault();
                }

            } while (!string.IsNullOrEmpty(continuationToken));

            return allPoints;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test points for suite {SuiteId}", suiteId);
            return allPoints;
        }
    }

    public async Task<List<AvailableTestPlan>> GetAvailableTestPlansAsync()
    {
        var project = _configuration["AzureDevOps:Project"];
        if (string.IsNullOrEmpty(project))
        {
            return new List<AvailableTestPlan>();
        }

        var plans = await GetAllTestPlansAsync(project);
        return plans.Select(p => new AvailableTestPlan { Id = p.Id, Name = p.Name ?? "" }).ToList();
    }

    private async Task<List<AzDoTestPlan>> GetAllTestPlansAsync(string project)
    {
        // Try Analytics API first (no 200 limit)
        var analyticsPlans = await GetTestPlansFromAnalyticsAsync(project);
        if (analyticsPlans.Count > 0)
        {
            return analyticsPlans;
        }

        // Fallback to REST API with pagination
        return await GetTestPlansFromRestApiAsync(project);
    }

    private async Task<List<AzDoTestPlan>> GetTestPlansFromAnalyticsAsync(string project)
    {
        try
        {
            var oDataQuery = "$apply=groupby((TestPlanId, TestPlanTitle))";
            var analyticsUrl = $"{_analyticsBaseUrl}/{project}/_odata/v4.0-preview/TestSuites?{oDataQuery}";

            var response = await _httpClient.GetAsync(analyticsUrl);
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Analytics API error fetching test plans: {StatusCode}", response.StatusCode);
                return new List<AzDoTestPlan>();
            }

            var result = JsonSerializer.Deserialize<ODataResponse<TestPlanFromAnalytics>>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return result?.Value?
                .Where(p => p.TestPlanId > 0)
                .Select(p => new AzDoTestPlan { Id = p.TestPlanId, Name = p.TestPlanTitle })
                .DistinctBy(p => p.Id)
                .OrderBy(p => p.Name)
                .ToList() ?? new List<AzDoTestPlan>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test plans from Analytics API");
            return new List<AzDoTestPlan>();
        }
    }

    private async Task<List<AzDoTestPlan>> GetTestPlansFromRestApiAsync(string project)
    {
        var allPlans = new List<AzDoTestPlan>();
        string? continuationToken = null;

        try
        {
            do
            {
                var url = $"{project}/_apis/testplan/plans?api-version=7.0&$top=200";
                if (!string.IsNullOrEmpty(continuationToken))
                {
                    url += $"&continuationToken={continuationToken}";
                }

                var response = await _httpClient.GetAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    break;
                }

                var result = JsonSerializer.Deserialize<AzDoTestPlansResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var plans = result?.Value ?? new List<AzDoTestPlan>();
                allPlans.AddRange(plans);

                continuationToken = null;
                if (response.Headers.TryGetValues("x-ms-continuationtoken", out var tokens))
                {
                    continuationToken = tokens.FirstOrDefault();
                }

            } while (!string.IsNullOrEmpty(continuationToken));

            return allPlans;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test plans from REST API");
            return allPlans;
        }
    }

    private async Task<List<AzDoTestSuite>> GetTestSuitesAsync(string project, int planId)
    {
        try
        {
            var url = $"{project}/_apis/testplan/Plans/{planId}/suites?api-version=7.0";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                return new List<AzDoTestSuite>();
            }

            var result = await response.Content.ReadFromJsonAsync<AzDoTestSuitesResponse>();
            return result?.Value ?? new List<AzDoTestSuite>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test suites for plan {PlanId}", planId);
            return new List<AzDoTestSuite>();
        }
    }

    private async Task<TestSuiteSummary?> GetSuiteProgressAsync(string project, int planId, int suiteId, string suiteName, string orgUrl)
    {
        try
        {
            var url = $"{project}/_apis/testplan/Plans/{planId}/Suites/{suiteId}/TestPoint?api-version=7.0";
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<AzDoTestPointsResponse>();
            var testPoints = result?.Value ?? new List<AzDoTestPoint>();

            var summary = new TestSuiteSummary
            {
                Id = suiteId,
                PlanId = planId,
                Name = suiteName,
                Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}&suiteId={suiteId}",
                TotalTests = testPoints.Count,
                PassedCount = testPoints.Count(tp => tp.Results?.Outcome?.Equals("passed", StringComparison.OrdinalIgnoreCase) == true),
                FailedCount = testPoints.Count(tp => tp.Results?.Outcome?.Equals("failed", StringComparison.OrdinalIgnoreCase) == true),
                BlockedCount = testPoints.Count(tp => tp.Results?.Outcome?.Equals("blocked", StringComparison.OrdinalIgnoreCase) == true),
            };

            summary.NotRunCount = summary.TotalTests - summary.PassedCount - summary.FailedCount - summary.BlockedCount;
            summary.PassRate = summary.TotalTests > 0
                ? Math.Round((double)summary.PassedCount / summary.TotalTests * 100, 1)
                : 0;

            return summary;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test suite {SuiteId} progress", suiteId);
            return null;
        }
    }

    #region Response Models

    private class ODataResponse<T>
    {
        [JsonPropertyName("@odata.context")]
        public string? Context { get; set; }

        [JsonPropertyName("value")]
        public List<T>? Value { get; set; }
    }

    private class TestPlanFromAnalytics
    {
        public int TestPlanId { get; set; }
        public string? TestPlanTitle { get; set; }
    }

    private class TestPointHistorySnapshotResult
    {
        public int DateSK { get; set; }
        public int Executed { get; set; }
        public int NotExecuted { get; set; }
        public int NotApplicable { get; set; }
        public int Blocked { get; set; }
        public int Failed { get; set; }
        public int Passed { get; set; }
        public int TotalCount { get; set; }
        public int? TestSuiteId { get; set; }
        public string? TestSuiteTitle { get; set; }
    }

    private class AzDoTestPlansResponse
    {
        public List<AzDoTestPlan>? Value { get; set; }
        public int Count { get; set; }
    }

    private class AzDoTestPlan
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoTestSuitesResponse
    {
        public List<AzDoTestSuite>? Value { get; set; }
        public int Count { get; set; }
    }

    private class AzDoTestSuite
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoTestSuitesInfoResponse
    {
        public List<AzDoTestSuiteInfo>? Value { get; set; }
        public int Count { get; set; }
    }

    private class AzDoTestSuiteInfo
    {
        public int Id { get; set; }
        public string? Name { get; set; }
        public string? SuiteType { get; set; }
    }

    private class AzDoTestPointsResponse
    {
        public List<AzDoTestPoint>? Value { get; set; }
        public int Count { get; set; }
    }

    private class AzDoTestPoint
    {
        public int Id { get; set; }
        public string? Url { get; set; }
        public AzDoTestCase? TestCase { get; set; }
        public AzDoTestResults? Results { get; set; }
        public AzDoTestSuiteRef? TestSuite { get; set; }
    }

    private class AzDoTestSuiteRef
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoTestCase
    {
        public int Id { get; set; }
        public string? Name { get; set; }
    }

    private class AzDoTestResults
    {
        [JsonPropertyName("outcome")]
        public string? Outcome { get; set; }

        [JsonPropertyName("state")]
        public string? State { get; set; }
    }

    #endregion
}
