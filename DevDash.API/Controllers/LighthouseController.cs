using DevDash.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace DevDash.API.Controllers;

/// <summary>
/// Controller for Lighthouse performance metrics
/// Provides endpoints for running audits and retrieving results
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class LighthouseController : ControllerBase
{
    private readonly ILighthouseService? _lighthouseService;
    private readonly IConfigurationService _configService;
    private readonly ILogger<LighthouseController> _logger;

    public LighthouseController(
        IConfigurationService configService,
        ILogger<LighthouseController> logger,
        ILighthouseService? lighthouseService = null)
    {
        _lighthouseService = lighthouseService;
        _configService = configService;
        _logger = logger;
    }

    /// <summary>
    /// Run a Lighthouse audit for a branch deployment
    /// </summary>
    [HttpPost("audit")]
    public async Task<ActionResult<LighthouseResult>> RunAudit([FromBody] LighthouseAuditRequest request)
    {
        if (!_configService.Config.Features.EnableLighthouse)
        {
            return BadRequest(new { error = "Lighthouse feature is not enabled" });
        }

        if (_lighthouseService == null)
        {
            return BadRequest(new { error = "Lighthouse service is not configured" });
        }

        if (string.IsNullOrWhiteSpace(request.Branch) || string.IsNullOrWhiteSpace(request.DeploymentUrl))
        {
            return BadRequest(new { error = "Branch and DeploymentUrl are required" });
        }

        _logger.LogInformation("Starting Lighthouse audit for branch {Branch}", request.Branch);

        var result = await _lighthouseService.RunAuditAsync(request.Branch, request.DeploymentUrl);
        return Ok(result);
    }

    /// <summary>
    /// Get the latest Lighthouse result for a branch
    /// </summary>
    [HttpGet("branch/{branch}")]
    public async Task<ActionResult<LighthouseResult>> GetBranchResult(string branch)
    {
        if (_lighthouseService == null)
        {
            return BadRequest(new { error = "Lighthouse service is not configured" });
        }

        var result = await _lighthouseService.GetLatestResultAsync(branch);
        if (result == null)
        {
            return NotFound(new { error = $"No Lighthouse results found for branch: {branch}" });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get historical Lighthouse results for a branch
    /// </summary>
    [HttpGet("branch/{branch}/history")]
    public async Task<ActionResult<List<LighthouseResult>>> GetBranchHistory(
        string branch,
        [FromQuery] int limit = 10)
    {
        if (_lighthouseService == null)
        {
            return BadRequest(new { error = "Lighthouse service is not configured" });
        }

        var results = await _lighthouseService.GetHistoryAsync(branch, limit);
        return Ok(results);
    }

    /// <summary>
    /// Get all branches with their latest Lighthouse status
    /// </summary>
    [HttpGet("branches")]
    public async Task<ActionResult<List<BranchLighthouseStatus>>> GetAllBranches()
    {
        if (_lighthouseService == null)
        {
            return BadRequest(new { error = "Lighthouse service is not configured" });
        }

        var statuses = await _lighthouseService.GetAllBranchStatusesAsync();
        return Ok(statuses);
    }

    /// <summary>
    /// Check if Lighthouse feature is enabled
    /// </summary>
    [HttpGet("status")]
    public ActionResult<LighthouseStatus> GetStatus()
    {
        return Ok(new LighthouseStatus
        {
            Enabled = _configService.Config.Features.EnableLighthouse,
            Configured = _lighthouseService != null
        });
    }
}

public class LighthouseAuditRequest
{
    public string Branch { get; set; } = string.Empty;
    public string DeploymentUrl { get; set; } = string.Empty;
}

public class LighthouseStatus
{
    public bool Enabled { get; set; }
    public bool Configured { get; set; }
}
