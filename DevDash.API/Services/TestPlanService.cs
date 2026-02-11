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

        Console.WriteLine("========================================");
        Console.WriteLine("[TestPlanService] CONSTRUCTOR CALLED");
        Console.WriteLine("========================================");

        ConfigureHttpClient();
    }

    private void ConfigureHttpClient()
    {
        Console.WriteLine("[TestPlanService] ConfigureHttpClient() starting...");

        var orgUrl = _configuration["AzureDevOps:OrganizationUrl"];
        Console.WriteLine($"[TestPlanService] AzureDevOps:OrganizationUrl = '{orgUrl ?? "NULL"}'");

        var pat = _configuration["AzureDevOps:PAT"];
        Console.WriteLine($"[TestPlanService] AzureDevOps:PAT exists = {!string.IsNullOrEmpty(pat)}");

        var project = _configuration["AzureDevOps:Project"];
        Console.WriteLine($"[TestPlanService] AzureDevOps:Project = '{project ?? "NULL"}'");

        var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();
        Console.WriteLine($"[TestPlanService] TestPlans:Plans deserialized count = {plansConfig.Count}");

        foreach (var plan in plansConfig)
        {
            Console.WriteLine($"[TestPlanService] Configured plan: Name='{plan.Name}', Suites count={plan.Suites?.Count ?? 0}");
            if (plan.Suites != null && plan.Suites.Count > 0)
            {
                foreach (var suite in plan.Suites)
                {
                    Console.WriteLine($"[TestPlanService]   - Suite: '{suite}'");
                }
            }
        }

        // Extract organization name from URL
        // From https://se-tfs.visualstudio.com -> SE-TFS
        // From https://dev.azure.com/SE-TFS -> SE-TFS
        if (!string.IsNullOrEmpty(orgUrl))
        {
            if (orgUrl.Contains("visualstudio.com"))
            {
                // Format: https://org-name.visualstudio.com
                var uri = new Uri(orgUrl);
                _organization = uri.Host.Split('.')[0];
            }
            else if (orgUrl.Contains("dev.azure.com"))
            {
                // Format: https://dev.azure.com/org-name
                var uri = new Uri(orgUrl);
                _organization = uri.AbsolutePath.Trim('/').Split('/')[0];
            }
            else
            {
                _organization = orgUrl.TrimEnd('/').Split('/').Last();
            }

            _analyticsBaseUrl = $"https://analytics.dev.azure.com/{_organization}";
            Console.WriteLine($"[TestPlanService] Organization extracted: '{_organization}'");
            Console.WriteLine($"[TestPlanService] Analytics base URL: '{_analyticsBaseUrl}'");
        }

        _logger.LogInformation("TestPlanService initialized - OrgUrl: {OrgUrl}, Analytics: {AnalyticsUrl}, Project: {Project}, PAT configured: {HasPAT}, Plans configured: {PlanCount}",
            orgUrl ?? "NOT SET",
            _analyticsBaseUrl ?? "NOT SET",
            project ?? "NOT SET",
            !string.IsNullOrEmpty(pat),
            plansConfig.Count);

        if (string.IsNullOrEmpty(orgUrl))
        {
            _logger.LogWarning("AzureDevOps:OrganizationUrl is not configured");
            return;
        }

        // Set base address for regular REST API (used for getting plan list)
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
        Console.WriteLine("[TestPlanService] GetDebugInfo called");
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
        Console.WriteLine($"[TestPlanService] GetTestPlanProgressAsync called (bypassCache: {bypassCache})");

        var cacheDuration = _configuration.GetValue<int>("TestPlans:CacheDurationMinutes", 5);
        var cacheKey = "testplans:progress";

        if (!bypassCache)
        {
            var cached = await _cacheService.GetAsync<TestPlanProgress>(cacheKey);
            if (cached != null)
            {
                Console.WriteLine("[TestPlanService] Returning cached test plan progress");
                return cached;
            }
        }
        else
        {
            Console.WriteLine("[TestPlanService] Bypassing cache");
        }

        try
        {
            Console.WriteLine("[TestPlanService] Starting to fetch test plan progress...");

            var project = _configuration["AzureDevOps:Project"];
            var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');

            Console.WriteLine($"[TestPlanService] Project: '{project}', OrgUrl: '{orgUrl}'");
            Console.WriteLine($"[TestPlanService] Analytics URL: '{_analyticsBaseUrl}'");

            var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();
            Console.WriteLine($"[TestPlanService] Plans configured: {plansConfig.Count}");

            if (plansConfig.Count == 0)
            {
                Console.WriteLine("[TestPlanService] WARNING: No test plans configured!");
                return new TestPlanProgress();
            }

            var progress = new TestPlanProgress();

            // First, get all test plans using REST API
            var allPlans = await GetAllTestPlansAsync(project!);
            Console.WriteLine($"[TestPlanService] Found {allPlans.Count} test plans from REST API");

            foreach (var planConfig in plansConfig)
            {
                Console.WriteLine($"[TestPlanService] Processing plan config: '{planConfig.Name}'");

                var matchingPlan = allPlans.FirstOrDefault(p =>
                    p.Name?.Contains(planConfig.Name, StringComparison.OrdinalIgnoreCase) == true ||
                    planConfig.Name.Contains(p.Name ?? "", StringComparison.OrdinalIgnoreCase));

                if (matchingPlan == null)
                {
                    Console.WriteLine($"[TestPlanService] WARNING: Plan '{planConfig.Name}' not found!");
                    _logger.LogWarning("Test plan '{PlanName}' not found", planConfig.Name);
                    continue;
                }

                Console.WriteLine($"[TestPlanService] Matched to plan ID: {matchingPlan.Id}, Name: '{matchingPlan.Name}'");

                // Use Analytics OData API to get test point outcomes
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

            Console.WriteLine($"[TestPlanService] Final result: {progress.Plans.Count} plans, {progress.TotalTestCases} tests, {progress.OverallPassRate}% pass rate");

            await _cacheService.SetAsync(cacheKey, progress, TimeSpan.FromMinutes(cacheDuration));
            return progress;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestPlanService] ERROR: {ex.Message}");
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
        try
        {
            Console.WriteLine($"[TestPlanService] Fetching Analytics data for plan {planId}...");

            // Query TestPointHistorySnapshot grouped by TestSuite to get per-suite counts
            // Get the latest snapshot by ordering by DateSK desc
            var oDataQuery = $"$apply=filter(TestPlanId eq {planId})/groupby((TestSuiteId, TestSuiteTitle, DateSK), aggregate(Passed with sum as Passed, Failed with sum as Failed, Blocked with sum as Blocked, NotExecuted with sum as NotExecuted, TotalCount with sum as TotalCount))&$orderby=DateSK desc";
            var analyticsUrl = $"{_analyticsBaseUrl}/{project}/_odata/v4.0-preview/TestPointHistorySnapshot?{oDataQuery}";

            Console.WriteLine($"[TestPlanService] Analytics URL: {analyticsUrl}");

            var response = await _httpClient.GetAsync(analyticsUrl);
            var responseContent = await response.Content.ReadAsStringAsync();

            Console.WriteLine($"[TestPlanService] Analytics response status: {response.StatusCode}");
            Console.WriteLine($"[TestPlanService] Response preview: {responseContent.Substring(0, Math.Min(500, responseContent.Length))}...");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"[TestPlanService] Analytics API error: {responseContent}");
                _logger.LogWarning("Analytics API returned {StatusCode}: {Content}", response.StatusCode, responseContent);

                // Fallback to REST API
                Console.WriteLine("[TestPlanService] Falling back to REST API...");
                return await GetTestPlanProgressFromRestApiAsync(project, planId, planName, suiteFilters, orgUrl);
            }

            var analyticsResult = JsonSerializer.Deserialize<ODataResponse<TestPointHistorySnapshotResult>>(responseContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (analyticsResult?.Value == null || analyticsResult.Value.Count == 0)
            {
                Console.WriteLine("[TestPlanService] No data from Analytics API, trying REST API...");
                return await GetTestPlanProgressFromRestApiAsync(project, planId, planName, suiteFilters, orgUrl);
            }

            Console.WriteLine($"[TestPlanService] Got {analyticsResult.Value.Count} rows from Analytics API");

            var planSummary = new TestPlanSummary
            {
                Id = planId,
                Name = planName,
                Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}"
            };

            // Get the latest date's data for each suite
            var latestDateSK = analyticsResult.Value.Max(r => r.DateSK);
            Console.WriteLine($"[TestPlanService] Latest DateSK: {latestDateSK}");

            var latestData = analyticsResult.Value
                .Where(r => r.DateSK == latestDateSK)
                .ToList();

            Console.WriteLine($"[TestPlanService] Found {latestData.Count} suites with latest data");

            foreach (var row in latestData)
            {
                var suiteName = row.TestSuiteTitle ?? $"Suite {row.TestSuiteId}";
                var suiteId = row.TestSuiteId ?? 0;

                // Check if suite matches filters (if any)
                if (suiteFilters != null && suiteFilters.Count > 0)
                {
                    var matchesFilter = suiteFilters.Any(f =>
                        suiteName.Contains(f, StringComparison.OrdinalIgnoreCase) ||
                        f.Contains(suiteName, StringComparison.OrdinalIgnoreCase));

                    if (!matchesFilter)
                    {
                        continue;
                    }
                }

                var suiteSummary = new TestSuiteSummary
                {
                    Id = suiteId,
                    PlanId = planId,
                    Name = suiteName,
                    Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}&suiteId={suiteId}",
                    TotalTests = row.TotalCount,
                    PassedCount = row.Passed,
                    FailedCount = row.Failed,
                    BlockedCount = row.Blocked,
                    NotRunCount = row.NotExecuted
                };

                suiteSummary.PassRate = suiteSummary.TotalTests > 0
                    ? Math.Round((double)suiteSummary.PassedCount / suiteSummary.TotalTests * 100, 1)
                    : 0;

                planSummary.Suites.Add(suiteSummary);
                Console.WriteLine($"[TestPlanService]   Suite '{suiteName}': {suiteSummary.TotalTests} tests, {suiteSummary.PassedCount} passed, {suiteSummary.FailedCount} failed");
            }

            // Calculate plan totals
            planSummary.TotalTests = planSummary.Suites.Sum(s => s.TotalTests);
            planSummary.PassedCount = planSummary.Suites.Sum(s => s.PassedCount);
            planSummary.FailedCount = planSummary.Suites.Sum(s => s.FailedCount);
            planSummary.BlockedCount = planSummary.Suites.Sum(s => s.BlockedCount);
            planSummary.NotRunCount = planSummary.Suites.Sum(s => s.NotRunCount);
            planSummary.PassRate = planSummary.TotalTests > 0
                ? Math.Round((double)planSummary.PassedCount / planSummary.TotalTests * 100, 1)
                : 0;

            Console.WriteLine($"[TestPlanService] Plan total: {planSummary.TotalTests} tests, {planSummary.PassRate}% pass rate");

            return planSummary;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestPlanService] Analytics error: {ex.Message}");
            _logger.LogError(ex, "Failed to get test plan progress from Analytics API for plan {PlanId}", planId);

            // Fallback to REST API
            return await GetTestPlanProgressFromRestApiAsync(project, planId, planName, suiteFilters, orgUrl);
        }
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
            Console.WriteLine($"[TestPlanService] Using REST API fallback for plan {planId}...");

            var planSummary = new TestPlanSummary
            {
                Id = planId,
                Name = planName,
                Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planId}"
            };

            // Get all suites for the plan
            var allSuites = await GetTestSuitesAsync(project, planId);
            Console.WriteLine($"[TestPlanService] REST API found {allSuites.Count} suites");

            List<AzDoTestSuite> suitesToProcess;

            if (suiteFilters == null || suiteFilters.Count == 0)
            {
                suitesToProcess = allSuites;
            }
            else
            {
                suitesToProcess = allSuites.Where(s =>
                    suiteFilters.Any(f =>
                        (s.Name?.Contains(f, StringComparison.OrdinalIgnoreCase) == true) ||
                        f.Contains(s.Name ?? "", StringComparison.OrdinalIgnoreCase)))
                    .ToList();
            }

            foreach (var suite in suitesToProcess)
            {
                var suiteSummary = await GetSuiteProgressAsync(project, planId, suite.Id, suite.Name ?? "Unknown", orgUrl);
                if (suiteSummary != null)
                {
                    planSummary.Suites.Add(suiteSummary);
                }
            }

            // Calculate plan totals
            planSummary.TotalTests = planSummary.Suites.Sum(s => s.TotalTests);
            planSummary.PassedCount = planSummary.Suites.Sum(s => s.PassedCount);
            planSummary.FailedCount = planSummary.Suites.Sum(s => s.FailedCount);
            planSummary.BlockedCount = planSummary.Suites.Sum(s => s.BlockedCount);
            planSummary.NotRunCount = planSummary.Suites.Sum(s => s.NotRunCount);
            planSummary.PassRate = planSummary.TotalTests > 0
                ? Math.Round((double)planSummary.PassedCount / planSummary.TotalTests * 100, 1)
                : 0;

            return planSummary;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestPlanService] REST API error: {ex.Message}");
            _logger.LogError(ex, "Failed to get test plan progress from REST API for plan {PlanId}", planId);
            return null;
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

                Console.WriteLine($"[TestPlanService] Fetching test plans from REST API: {url}");

                var response = await _httpClient.GetAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"[TestPlanService] REST API response: {response.StatusCode}");

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[TestPlanService] REST API error: {content}");
                    break;
                }

                var result = JsonSerializer.Deserialize<AzDoTestPlansResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                var plans = result?.Value ?? new List<AzDoTestPlan>();
                allPlans.AddRange(plans);
                Console.WriteLine($"[TestPlanService] Fetched {plans.Count} plans (total so far: {allPlans.Count})");

                // Check for continuation token in response headers
                continuationToken = null;
                if (response.Headers.TryGetValues("x-ms-continuationtoken", out var tokens))
                {
                    continuationToken = tokens.FirstOrDefault();
                    Console.WriteLine($"[TestPlanService] Continuation token found, fetching more...");
                }

            } while (!string.IsNullOrEmpty(continuationToken));

            Console.WriteLine($"[TestPlanService] Total plans found: {allPlans.Count}");

            // Log some plan names for debugging
            var planNames = allPlans.Select(p => $"{p.Id}:{p.Name}").ToList();
            Console.WriteLine($"[TestPlanService] Plan names: {string.Join(", ", planNames.Take(50))}...");

            return allPlans;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestPlanService] Error fetching plans: {ex.Message}");
            _logger.LogError(ex, "Failed to fetch test plans");
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

    private class TestPointAnalytics
    {
        public int TestSuiteId { get; set; }
        public string? TestSuiteTitle { get; set; }
        public string? Outcome { get; set; }
        public int Count { get; set; }
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
