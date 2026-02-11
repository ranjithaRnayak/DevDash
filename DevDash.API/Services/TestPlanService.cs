using System.Net.Http.Json;
using System.Text.Json.Serialization;
using DevDash.API.Models;

namespace DevDash.API.Services;

/// <summary>
/// Interface for Azure DevOps Test Plan operations
/// </summary>
public interface ITestPlanService
{
    Task<TestPlanProgress> GetTestPlanProgressAsync();
}

/// <summary>
/// Azure DevOps Test Plan API integration service
/// </summary>
public class TestPlanService : ITestPlanService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<TestPlanService> _logger;

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

    public async Task<TestPlanProgress> GetTestPlanProgressAsync()
    {
        var cacheDuration = _configuration.GetValue<int>("TestPlans:CacheDurationMinutes", 5);
        var cacheKey = "testplans:progress";
        var cached = await _cacheService.GetAsync<TestPlanProgress>(cacheKey);
        if (cached != null)
        {
            return cached;
        }

        try
        {
            var project = _configuration["AzureDevOps:Project"];
            var orgUrl = _configuration["AzureDevOps:OrganizationUrl"]?.TrimEnd('/');
            var plansConfig = _configuration.GetSection("TestPlans:Plans").Get<List<TestPlanConfig>>() ?? new List<TestPlanConfig>();

            if (plansConfig.Count == 0)
            {
                _logger.LogWarning("No test plans configured in TestPlans:Plans");
                return new TestPlanProgress();
            }

            var allPlans = await GetAllTestPlansAsync(project!);
            _logger.LogInformation("Found {Count} test plans in Azure DevOps: {Names}",
                allPlans.Count, string.Join(", ", allPlans.Select(p => p.Name)));

            var progress = new TestPlanProgress();

            foreach (var planConfig in plansConfig)
            {
                var matchingPlan = allPlans.FirstOrDefault(p =>
                    p.Name?.Contains(planConfig.Name, StringComparison.OrdinalIgnoreCase) == true ||
                    planConfig.Name.Contains(p.Name ?? "", StringComparison.OrdinalIgnoreCase));

                if (matchingPlan == null)
                {
                    _logger.LogWarning("Test plan '{PlanName}' not found in Azure DevOps. Available plans: {AvailablePlans}",
                        planConfig.Name, string.Join(", ", allPlans.Select(p => p.Name)));
                    continue;
                }

                _logger.LogInformation("Matched plan config '{ConfigName}' to Azure DevOps plan '{AzdoName}' (ID: {Id})",
                    planConfig.Name, matchingPlan.Name, matchingPlan.Id);

                var planSummary = new TestPlanSummary
                {
                    Id = matchingPlan.Id,
                    Name = matchingPlan.Name ?? planConfig.Name,
                    Url = $"{orgUrl}/{project}/_testPlans/execute?planId={matchingPlan.Id}"
                };

                var allSuites = await GetTestSuitesAsync(project!, matchingPlan.Id);
                _logger.LogInformation("Found {Count} suites in plan '{PlanName}': {Suites}",
                    allSuites.Count, matchingPlan.Name, string.Join(", ", allSuites.Select(s => s.Name)));

                List<AzDoTestSuite> suitesToProcess;

                if (planConfig.Suites == null || planConfig.Suites.Count == 0)
                {
                    suitesToProcess = allSuites;
                    _logger.LogInformation("No specific suites configured, including all {Count} suites", allSuites.Count);
                }
                else
                {
                    suitesToProcess = new List<AzDoTestSuite>();
                    foreach (var suiteName in planConfig.Suites)
                    {
                        var matchingSuite = allSuites.FirstOrDefault(s =>
                            s.Name?.Contains(suiteName, StringComparison.OrdinalIgnoreCase) == true ||
                            suiteName.Contains(s.Name ?? "", StringComparison.OrdinalIgnoreCase));

                        if (matchingSuite != null)
                        {
                            suitesToProcess.Add(matchingSuite);
                            _logger.LogInformation("Matched suite config '{ConfigName}' to '{AzdoName}'", suiteName, matchingSuite.Name);
                        }
                        else
                        {
                            _logger.LogWarning("Test suite '{SuiteName}' not found in plan '{PlanName}'", suiteName, planConfig.Name);
                        }
                    }
                }

                foreach (var suite in suitesToProcess)
                {
                    var suiteSummary = await GetSuiteProgressAsync(project!, matchingPlan.Id, suite.Id, suite.Name ?? "Unknown", orgUrl!);
                    if (suiteSummary != null)
                    {
                        planSummary.Suites.Add(suiteSummary);
                    }
                }

                planSummary.TotalTests = planSummary.Suites.Sum(s => s.TotalTests);
                planSummary.PassedCount = planSummary.Suites.Sum(s => s.PassedCount);
                planSummary.FailedCount = planSummary.Suites.Sum(s => s.FailedCount);
                planSummary.BlockedCount = planSummary.Suites.Sum(s => s.BlockedCount);
                planSummary.NotRunCount = planSummary.Suites.Sum(s => s.NotRunCount);
                planSummary.PassRate = planSummary.TotalTests > 0
                    ? Math.Round((double)planSummary.PassedCount / planSummary.TotalTests * 100, 1)
                    : 0;

                progress.Plans.Add(planSummary);
            }

            progress.TotalTestCases = progress.Plans.Sum(p => p.TotalTests);
            progress.PassedCount = progress.Plans.Sum(p => p.PassedCount);
            progress.FailedCount = progress.Plans.Sum(p => p.FailedCount);
            progress.BlockedCount = progress.Plans.Sum(p => p.BlockedCount);
            progress.NotRunCount = progress.Plans.Sum(p => p.NotRunCount);
            progress.OverallPassRate = progress.TotalTestCases > 0
                ? Math.Round((double)progress.PassedCount / progress.TotalTestCases * 100, 1)
                : 0;
            progress.GeneratedAt = DateTime.UtcNow;

            await _cacheService.SetAsync(cacheKey, progress, TimeSpan.FromMinutes(cacheDuration));
            return progress;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test plan progress");
            return new TestPlanProgress();
        }
    }

    private async Task<List<AzDoTestPlan>> GetAllTestPlansAsync(string project)
    {
        try
        {
            var url = $"{project}/_apis/testplan/plans?api-version=7.0";
            _logger.LogInformation("Fetching test plans from: {Url}", url);

            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch test plans: {StatusCode}", response.StatusCode);
                return new List<AzDoTestPlan>();
            }

            var result = await response.Content.ReadFromJsonAsync<AzDoTestPlansResponse>();
            return result?.Value ?? new List<AzDoTestPlan>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch test plans");
            return new List<AzDoTestPlan>();
        }
    }

    private async Task<List<AzDoTestSuite>> GetTestSuitesAsync(string project, int planId)
    {
        try
        {
            var url = $"{project}/_apis/testplan/Plans/{planId}/suites?api-version=7.0";
            _logger.LogInformation("Fetching test suites for plan {PlanId} from: {Url}", planId, url);

            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch test suites for plan {PlanId}: {StatusCode}", planId, response.StatusCode);
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
            _logger.LogInformation("Fetching test points for suite '{SuiteName}' from: {Url}", suiteName, url);

            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch test points for suite {SuiteId}: {StatusCode}", suiteId, response.StatusCode);
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

    #region Configuration Models

    private class TestPlanConfig
    {
        public string Name { get; set; } = string.Empty;
        public List<string> Suites { get; set; } = new();
    }

    #endregion

    #region Azure DevOps API Response Models

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
