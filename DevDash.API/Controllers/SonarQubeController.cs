using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web.Resource;
using System.Text;

namespace DevDash.API.Controllers;

/// <summary>
/// SonarQube API Controller - Proxies requests to SonarQube with authentication
/// This keeps the SonarQube token secure on the server side
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SonarQubeController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SonarQubeController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public SonarQubeController(
        IConfiguration configuration,
        ILogger<SonarQubeController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Get SonarQube metrics for a project
    /// </summary>
    [HttpGet("metrics")]
    [RequiredScope("access_as_user")]
    public async Task<ActionResult<SonarQubeMetricsResponse>> GetMetrics([FromQuery] string projectKey)
    {
        if (string.IsNullOrEmpty(projectKey))
        {
            return BadRequest(new { error = "Project key is required" });
        }

        var sonarUrl = _configuration["SonarQube:Url"];
        var sonarToken = _configuration["SonarQube:Token"];

        if (string.IsNullOrEmpty(sonarUrl))
        {
            return StatusCode(500, new { error = "SonarQube is not configured" });
        }

        try
        {
            var client = _httpClientFactory.CreateClient();

            // Add authentication if token is provided
            if (!string.IsNullOrEmpty(sonarToken))
            {
                var authBytes = Encoding.ASCII.GetBytes($"{sonarToken}:");
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
            }

            // Request metrics from SonarQube
            var metricKeys = "bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,alert_status,reliability_rating,security_rating,sqale_rating";
            var requestUrl = $"{sonarUrl}/api/measures/component?component={Uri.EscapeDataString(projectKey)}&metricKeys={metricKeys}";

            var response = await client.GetAsync(requestUrl);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("SonarQube API returned {StatusCode} for project {ProjectKey}",
                    response.StatusCode, projectKey);

                return response.StatusCode switch
                {
                    System.Net.HttpStatusCode.Unauthorized =>
                        StatusCode(401, new { error = "SonarQube authentication failed" }),
                    System.Net.HttpStatusCode.Forbidden =>
                        StatusCode(403, new { error = "Access denied to SonarQube project" }),
                    System.Net.HttpStatusCode.NotFound =>
                        NotFound(new { error = "SonarQube project not found" }),
                    _ => StatusCode((int)response.StatusCode, new { error = "SonarQube API error" })
                };
            }

            var content = await response.Content.ReadAsStringAsync();
            var sonarResponse = System.Text.Json.JsonSerializer.Deserialize<SonarQubeApiResponse>(content,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (sonarResponse?.Component?.Measures == null)
            {
                return Ok(new SonarQubeMetricsResponse());
            }

            // Parse metrics into response object
            var metrics = new SonarQubeMetricsResponse
            {
                ProjectKey = projectKey
            };

            foreach (var measure in sonarResponse.Component.Measures)
            {
                switch (measure.Metric)
                {
                    case "bugs":
                        metrics.Bugs = int.TryParse(measure.Value, out var bugs) ? bugs : 0;
                        break;
                    case "vulnerabilities":
                        metrics.Vulnerabilities = int.TryParse(measure.Value, out var vulns) ? vulns : 0;
                        break;
                    case "code_smells":
                        metrics.CodeSmells = int.TryParse(measure.Value, out var smells) ? smells : 0;
                        break;
                    case "coverage":
                        metrics.Coverage = double.TryParse(measure.Value, out var cov) ? cov : 0;
                        break;
                    case "duplicated_lines_density":
                        metrics.Duplications = double.TryParse(measure.Value, out var dup) ? dup : 0;
                        break;
                    case "alert_status":
                        metrics.QualityGateStatus = measure.Value ?? "UNKNOWN";
                        break;
                    case "reliability_rating":
                        metrics.ReliabilityRating = measure.Value ?? "E";
                        break;
                    case "security_rating":
                        metrics.SecurityRating = measure.Value ?? "E";
                        break;
                    case "sqale_rating":
                        metrics.MaintainabilityRating = measure.Value ?? "E";
                        break;
                }
            }

            return Ok(metrics);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch SonarQube metrics for project {ProjectKey}", projectKey);
            return StatusCode(500, new { error = "Failed to fetch SonarQube metrics" });
        }
    }

    /// <summary>
    /// Get quality gate status for a project
    /// </summary>
    [HttpGet("quality-gate")]
    [RequiredScope("access_as_user")]
    public async Task<ActionResult<QualityGateResponse>> GetQualityGate([FromQuery] string projectKey)
    {
        if (string.IsNullOrEmpty(projectKey))
        {
            return BadRequest(new { error = "Project key is required" });
        }

        var sonarUrl = _configuration["SonarQube:Url"];
        var sonarToken = _configuration["SonarQube:Token"];

        if (string.IsNullOrEmpty(sonarUrl))
        {
            return StatusCode(500, new { error = "SonarQube is not configured" });
        }

        try
        {
            var client = _httpClientFactory.CreateClient();

            if (!string.IsNullOrEmpty(sonarToken))
            {
                var authBytes = Encoding.ASCII.GetBytes($"{sonarToken}:");
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
            }

            var requestUrl = $"{sonarUrl}/api/qualitygates/project_status?projectKey={Uri.EscapeDataString(projectKey)}";
            var response = await client.GetAsync(requestUrl);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { error = "Failed to fetch quality gate status" });
            }

            var content = await response.Content.ReadAsStringAsync();
            var gateResponse = System.Text.Json.JsonSerializer.Deserialize<SonarQubeQualityGateApiResponse>(content,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return Ok(new QualityGateResponse
            {
                Status = gateResponse?.ProjectStatus?.Status ?? "UNKNOWN",
                Conditions = gateResponse?.ProjectStatus?.Conditions?.Select(c => new QualityGateCondition
                {
                    Metric = c.MetricKey ?? "",
                    Status = c.Status ?? "",
                    ActualValue = c.ActualValue ?? "",
                    ErrorThreshold = c.ErrorThreshold ?? ""
                }).ToList() ?? new List<QualityGateCondition>()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch quality gate for project {ProjectKey}", projectKey);
            return StatusCode(500, new { error = "Failed to fetch quality gate status" });
        }
    }

    // Response DTOs
    public class SonarQubeMetricsResponse
    {
        public string ProjectKey { get; set; } = string.Empty;
        public int Bugs { get; set; }
        public int Vulnerabilities { get; set; }
        public int CodeSmells { get; set; }
        public double Coverage { get; set; }
        public double Duplications { get; set; }
        public string QualityGateStatus { get; set; } = "UNKNOWN";
        public string ReliabilityRating { get; set; } = "E";
        public string SecurityRating { get; set; } = "E";
        public string MaintainabilityRating { get; set; } = "E";
    }

    public class QualityGateResponse
    {
        public string Status { get; set; } = "UNKNOWN";
        public List<QualityGateCondition> Conditions { get; set; } = new();
    }

    public class QualityGateCondition
    {
        public string Metric { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string ActualValue { get; set; } = string.Empty;
        public string ErrorThreshold { get; set; } = string.Empty;
    }

    // SonarQube API Response Models
    private class SonarQubeApiResponse
    {
        public SonarQubeComponent? Component { get; set; }
    }

    private class SonarQubeComponent
    {
        public string? Key { get; set; }
        public string? Name { get; set; }
        public List<SonarQubeMeasure>? Measures { get; set; }
    }

    private class SonarQubeMeasure
    {
        public string? Metric { get; set; }
        public string? Value { get; set; }
    }

    private class SonarQubeQualityGateApiResponse
    {
        public SonarQubeProjectStatus? ProjectStatus { get; set; }
    }

    private class SonarQubeProjectStatus
    {
        public string? Status { get; set; }
        public List<SonarQubeCondition>? Conditions { get; set; }
    }

    private class SonarQubeCondition
    {
        public string? MetricKey { get; set; }
        public string? Status { get; set; }
        public string? ActualValue { get; set; }
        public string? ErrorThreshold { get; set; }
    }
}
