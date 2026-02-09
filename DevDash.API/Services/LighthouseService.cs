using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DevDash.API.Services;

/// <summary>
/// Service for running Lighthouse audits on branch deployments
/// Stores results for historical comparison
/// </summary>
public interface ILighthouseService
{
    Task<LighthouseResult> RunAuditAsync(string branch, string deploymentUrl);
    Task<LighthouseResult?> GetLatestResultAsync(string branch);
    Task<List<LighthouseResult>> GetHistoryAsync(string branch, int limit = 10);
    Task<List<BranchLighthouseStatus>> GetAllBranchStatusesAsync();
}

public class LighthouseService : ILighthouseService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<LighthouseService> _logger;
    private readonly ICacheService? _cacheService;
    private readonly string _resultsPath;

    public LighthouseService(
        IConfiguration configuration,
        ILogger<LighthouseService> logger,
        ICacheService? cacheService = null)
    {
        _configuration = configuration;
        _logger = logger;
        _cacheService = cacheService;

        // Store results in a local directory (could be replaced with database storage)
        _resultsPath = Path.Combine(AppContext.BaseDirectory, "lighthouse-results");
        Directory.CreateDirectory(_resultsPath);
    }

    public async Task<LighthouseResult> RunAuditAsync(string branch, string deploymentUrl)
    {
        var result = new LighthouseResult
        {
            Branch = branch,
            DeploymentUrl = deploymentUrl,
            Timestamp = DateTime.UtcNow
        };

        try
        {
            // Run Lighthouse via CLI (requires lighthouse to be installed)
            var outputFile = Path.Combine(_resultsPath, $"{SanitizeBranchName(branch)}_{DateTime.UtcNow:yyyyMMddHHmmss}.json");

            var startInfo = new ProcessStartInfo
            {
                FileName = "lighthouse",
                Arguments = $"\"{deploymentUrl}\" --output=json --output-path=\"{outputFile}\" " +
                           "--only-categories=performance,accessibility,best-practices,seo " +
                           "--chrome-flags=\"--headless --no-sandbox --disable-gpu\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = startInfo };

            _logger.LogInformation("Starting Lighthouse audit for {Branch} at {Url}", branch, deploymentUrl);

            process.Start();

            var timeoutMs = _configuration.GetValue("Lighthouse:TimeoutMs", 120000);
            var completed = await Task.Run(() => process.WaitForExit(timeoutMs));

            if (!completed)
            {
                process.Kill();
                result.Success = false;
                result.Error = "Lighthouse audit timed out";
                return result;
            }

            if (process.ExitCode != 0)
            {
                var stderr = await process.StandardError.ReadToEndAsync();
                result.Success = false;
                result.Error = $"Lighthouse exited with code {process.ExitCode}: {stderr}";
                return result;
            }

            // Parse the results
            if (File.Exists(outputFile))
            {
                var json = await File.ReadAllTextAsync(outputFile);
                var report = JsonSerializer.Deserialize<LighthouseReport>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (report?.Categories != null)
                {
                    result.Performance = (int)((report.Categories.Performance?.Score ?? 0) * 100);
                    result.Accessibility = (int)((report.Categories.Accessibility?.Score ?? 0) * 100);
                    result.BestPractices = (int)((report.Categories.BestPractices?.Score ?? 0) * 100);
                    result.SEO = (int)((report.Categories.Seo?.Score ?? 0) * 100);
                }

                if (report?.Audits != null)
                {
                    result.Metrics = new LighthouseMetrics
                    {
                        FirstContentfulPaint = GetAuditValue(report.Audits, "first-contentful-paint"),
                        LargestContentfulPaint = GetAuditValue(report.Audits, "largest-contentful-paint"),
                        TimeToInteractive = GetAuditValue(report.Audits, "interactive"),
                        TotalBlockingTime = GetAuditValue(report.Audits, "total-blocking-time"),
                        CumulativeLayoutShift = GetAuditValue(report.Audits, "cumulative-layout-shift"),
                        SpeedIndex = GetAuditValue(report.Audits, "speed-index"),
                    };
                }

                result.Success = true;
                result.ReportPath = outputFile;

                // Cache the result
                await CacheResultAsync(result);
            }
            else
            {
                result.Success = false;
                result.Error = "Lighthouse report file not found";
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error running Lighthouse audit for {Branch}", branch);
            result.Success = false;
            result.Error = ex.Message;
        }

        return result;
    }

    public async Task<LighthouseResult?> GetLatestResultAsync(string branch)
    {
        var cacheKey = $"lighthouse_latest_{SanitizeBranchName(branch)}";

        if (_cacheService != null)
        {
            var cached = await _cacheService.GetAsync<LighthouseResult>(cacheKey);
            if (cached != null)
            {
                return cached;
            }
        }

        // Look for most recent result file
        var pattern = $"{SanitizeBranchName(branch)}_*.json";
        var files = Directory.GetFiles(_resultsPath, pattern)
            .OrderByDescending(f => f)
            .FirstOrDefault();

        if (files == null)
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(files);
        return JsonSerializer.Deserialize<LighthouseResult>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    public async Task<List<LighthouseResult>> GetHistoryAsync(string branch, int limit = 10)
    {
        var results = new List<LighthouseResult>();
        var pattern = $"{SanitizeBranchName(branch)}_*.json";

        var files = Directory.GetFiles(_resultsPath, pattern)
            .OrderByDescending(f => f)
            .Take(limit);

        foreach (var file in files)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var result = JsonSerializer.Deserialize<LighthouseResult>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (result != null)
                {
                    results.Add(result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error reading Lighthouse result file: {File}", file);
            }
        }

        return results;
    }

    public async Task<List<BranchLighthouseStatus>> GetAllBranchStatusesAsync()
    {
        var statuses = new List<BranchLighthouseStatus>();

        // Get unique branch names from result files
        var files = Directory.GetFiles(_resultsPath, "*.json");
        var branches = files
            .Select(f => Path.GetFileNameWithoutExtension(f).Split('_')[0])
            .Distinct();

        foreach (var branch in branches)
        {
            var latest = await GetLatestResultAsync(branch);
            if (latest != null)
            {
                statuses.Add(new BranchLighthouseStatus
                {
                    Branch = branch,
                    LastAudit = latest.Timestamp,
                    Performance = latest.Performance,
                    Accessibility = latest.Accessibility,
                    BestPractices = latest.BestPractices,
                    SEO = latest.SEO,
                    Success = latest.Success
                });
            }
        }

        return statuses.OrderByDescending(s => s.LastAudit).ToList();
    }

    private async Task CacheResultAsync(LighthouseResult result)
    {
        var cacheKey = $"lighthouse_latest_{SanitizeBranchName(result.Branch)}";

        if (_cacheService != null)
        {
            await _cacheService.SetAsync(cacheKey, result, TimeSpan.FromHours(1));
        }

        // Also save to file for persistence
        var resultFile = Path.Combine(_resultsPath,
            $"{SanitizeBranchName(result.Branch)}_{result.Timestamp:yyyyMMddHHmmss}_result.json");

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(resultFile, json);
    }

    private static string SanitizeBranchName(string branch)
    {
        return branch.Replace("/", "_").Replace("\\", "_").Replace(":", "_");
    }

    private static double GetAuditValue(Dictionary<string, LighthouseAudit> audits, string key)
    {
        if (audits.TryGetValue(key, out var audit))
        {
            return audit.NumericValue;
        }
        return 0;
    }
}

#region Models

public class LighthouseResult
{
    public string Branch { get; set; } = string.Empty;
    public string DeploymentUrl { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? ReportPath { get; set; }

    public int Performance { get; set; }
    public int Accessibility { get; set; }
    public int BestPractices { get; set; }
    public int SEO { get; set; }

    public LighthouseMetrics? Metrics { get; set; }
}

public class LighthouseMetrics
{
    public double FirstContentfulPaint { get; set; }
    public double LargestContentfulPaint { get; set; }
    public double TimeToInteractive { get; set; }
    public double TotalBlockingTime { get; set; }
    public double CumulativeLayoutShift { get; set; }
    public double SpeedIndex { get; set; }
}

public class BranchLighthouseStatus
{
    public string Branch { get; set; } = string.Empty;
    public DateTime LastAudit { get; set; }
    public int Performance { get; set; }
    public int Accessibility { get; set; }
    public int BestPractices { get; set; }
    public int SEO { get; set; }
    public bool Success { get; set; }
}

// Lighthouse Report JSON structure
public class LighthouseReport
{
    public LighthouseCategories? Categories { get; set; }
    public Dictionary<string, LighthouseAudit>? Audits { get; set; }
}

public class LighthouseCategories
{
    public LighthouseCategory? Performance { get; set; }
    public LighthouseCategory? Accessibility { get; set; }

    [JsonPropertyName("best-practices")]
    public LighthouseCategory? BestPractices { get; set; }

    public LighthouseCategory? Seo { get; set; }
}

public class LighthouseCategory
{
    public double Score { get; set; }
}

public class LighthouseAudit
{
    public double NumericValue { get; set; }
    public string? DisplayValue { get; set; }
}

#endregion
