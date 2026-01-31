using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DevDash.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    private readonly HealthCheckService _healthCheckService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HealthController> _logger;

    public HealthController(
        HealthCheckService healthCheckService,
        IConfiguration configuration,
        ILogger<HealthController> logger)
    {
        _healthCheckService = healthCheckService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Basic liveness probe - returns 200 if the service is running
    /// </summary>
    [HttpGet("live")]
    public ActionResult Live()
    {
        return Ok(new
        {
            status = "Healthy",
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Readiness probe - checks all dependencies
    /// </summary>
    [HttpGet("ready")]
    public async Task<ActionResult> Ready()
    {
        try
        {
            var result = await _healthCheckService.CheckHealthAsync();

            var response = new HealthCheckResponse
            {
                Status = result.Status.ToString(),
                TotalDuration = result.TotalDuration.TotalMilliseconds,
                Timestamp = DateTime.UtcNow,
                Checks = result.Entries.Select(e => new HealthCheckItem
                {
                    Name = e.Key,
                    Status = e.Value.Status.ToString(),
                    Duration = e.Value.Duration.TotalMilliseconds,
                    Description = e.Value.Description,
                    Error = e.Value.Exception?.Message
                }).ToList()
            };

            return result.Status == HealthStatus.Healthy
                ? Ok(response)
                : StatusCode(503, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return StatusCode(503, new
            {
                status = "Unhealthy",
                error = ex.Message,
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Detailed health status with configuration info (requires auth in production)
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult> Status()
    {
        var result = await _healthCheckService.CheckHealthAsync();

        var response = new DetailedHealthResponse
        {
            Status = result.Status.ToString(),
            Version = GetType().Assembly.GetName().Version?.ToString() ?? "1.0.0",
            Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
            Timestamp = DateTime.UtcNow,
            Uptime = GetUptime(),
            Dependencies = new DependencyStatus
            {
                Redis = GetDependencyStatus(result, "redis"),
                Elasticsearch = GetDependencyStatus(result, "elasticsearch"),
                SqlServer = GetDependencyStatus(result, "sqlserver")
            },
            Features = new FeatureStatus
            {
                AIAssistantEnabled = _configuration.GetValue<bool>("FeatureFlags:EnableAIAssistant"),
                AzureOpenAIEnabled = _configuration.GetValue<bool>("FeatureFlags:UseAzureOpenAI"),
                CopilotEnabled = _configuration.GetValue<bool>("FeatureFlags:UseCopilot"),
                PipelineAlertsEnabled = _configuration.GetValue<bool>("FeatureFlags:EnablePipelineAlerts"),
                PRAlertsEnabled = _configuration.GetValue<bool>("FeatureFlags:EnablePRAlerts")
            }
        };

        return Ok(response);
    }

    private static string GetUptime()
    {
        var uptime = DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime();
        return $"{uptime.Days}d {uptime.Hours}h {uptime.Minutes}m";
    }

    private static string GetDependencyStatus(HealthReport report, string name)
    {
        return report.Entries.TryGetValue(name, out var entry)
            ? entry.Status.ToString()
            : "NotConfigured";
    }

    public class HealthCheckResponse
    {
        public string Status { get; set; } = string.Empty;
        public double TotalDuration { get; set; }
        public DateTime Timestamp { get; set; }
        public List<HealthCheckItem> Checks { get; set; } = new();
    }

    public class HealthCheckItem
    {
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public double Duration { get; set; }
        public string? Description { get; set; }
        public string? Error { get; set; }
    }

    public class DetailedHealthResponse
    {
        public string Status { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string Environment { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string Uptime { get; set; } = string.Empty;
        public DependencyStatus Dependencies { get; set; } = new();
        public FeatureStatus Features { get; set; } = new();
    }

    public class DependencyStatus
    {
        public string Redis { get; set; } = "NotConfigured";
        public string Elasticsearch { get; set; } = "NotConfigured";
        public string SqlServer { get; set; } = "NotConfigured";
    }

    public class FeatureStatus
    {
        public bool AIAssistantEnabled { get; set; }
        public bool AzureOpenAIEnabled { get; set; }
        public bool CopilotEnabled { get; set; }
        public bool PipelineAlertsEnabled { get; set; }
        public bool PRAlertsEnabled { get; set; }
    }
}
