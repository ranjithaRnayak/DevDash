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
            var suitesConfig = _configuration.GetSection("TestPlans:Suites").Get<List<TestSuiteConfig>>() ?? new List<TestSuiteConfig>();

            var progress = new TestPlanProgress();

            foreach (var planConfig in plansConfig)
            {
                var planSummary = new TestPlanSummary
                {
                    Id = planConfig.Id,
                    Name = planConfig.Name,
                    Url = $"{orgUrl}/{project}/_testPlans/execute?planId={planConfig.Id}"
                };

                var planSuites = suitesConfig.Where(s => s.PlanId == planConfig.Id).ToList();

                foreach (var suiteConfig in planSuites)
                {
                    var suiteSummary = await GetSuiteProgressAsync(project!, planConfig.Id, suiteConfig.SuiteId, suiteConfig.Name, orgUrl!);
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

    private async Task<TestSuiteSummary?> GetSuiteProgressAsync(string project, int planId, int suiteId, string suiteName, string orgUrl)
    {
        try
        {
            var url = $"{project}/_apis/testplan/Plans/{planId}/Suites/{suiteId}/TestPoint?api-version=7.0";
            _logger.LogInformation("Fetching test points from: {Url}", url);

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
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    private class TestSuiteConfig
    {
        public int PlanId { get; set; }
        public int SuiteId { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    #endregion

    #region Azure DevOps API Response Models

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
