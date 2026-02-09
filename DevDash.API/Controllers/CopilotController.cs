using DevDash.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevDash.API.Controllers;

/// <summary>
/// Controller for GitHub Copilot Chat integration
/// Provides AI-powered DevOps assistance through the backend
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class CopilotController : ControllerBase
{
    private readonly ICopilotChatService? _copilotService;
    private readonly IConfigurationService _configService;
    private readonly ILogger<CopilotController> _logger;

    public CopilotController(
        IConfigurationService configService,
        ILogger<CopilotController> logger,
        ICopilotChatService? copilotService = null)
    {
        _copilotService = copilotService;
        _configService = configService;
        _logger = logger;
    }

    /// <summary>
    /// Send a chat message to GitHub Copilot
    /// </summary>
    [HttpPost("chat")]
    public async Task<ActionResult<CopilotChatResponse>> Chat([FromBody] CopilotChatRequest request)
    {
        if (!_configService.Config.Features.EnableCopilot)
        {
            return BadRequest(new CopilotChatResponse
            {
                Success = false,
                Error = "Copilot integration is not enabled"
            });
        }

        if (_copilotService == null)
        {
            return BadRequest(new CopilotChatResponse
            {
                Success = false,
                Error = "Copilot service is not configured"
            });
        }

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new CopilotChatResponse
            {
                Success = false,
                Error = "Message is required"
            });
        }

        // Get user token from header if available (OAuth flow)
        var userToken = GetUserGitHubToken();

        // Build context if not provided
        if (request.Context == null)
        {
            var userId = User.Identity?.Name ?? "anonymous";
            request.Context = await _copilotService.BuildContextAsync(userId);
        }

        var response = await _copilotService.SendMessageAsync(request, userToken);
        return Ok(response);
    }

    /// <summary>
    /// Get current context for the dashboard
    /// </summary>
    [HttpGet("context")]
    public async Task<ActionResult<CopilotContext>> GetContext([FromQuery] string? dashboardId)
    {
        if (_copilotService == null)
        {
            return BadRequest(new { error = "Copilot service is not configured" });
        }

        var userId = User.Identity?.Name ?? "anonymous";
        var context = await _copilotService.BuildContextAsync(userId, dashboardId);
        return Ok(context);
    }

    /// <summary>
    /// Check if Copilot is enabled and configured
    /// </summary>
    [HttpGet("status")]
    [AllowAnonymous]
    public ActionResult<CopilotStatus> GetStatus()
    {
        return Ok(new CopilotStatus
        {
            Enabled = _configService.Config.Features.EnableCopilot,
            Configured = _copilotService != null,
            Model = _configService.Config.Services.Copilot.Model
        });
    }

    private string? GetUserGitHubToken()
    {
        // Check for GitHub OAuth token in Authorization header
        var authHeader = Request.Headers["X-GitHub-Token"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader))
        {
            return authHeader;
        }

        // Could also check session/claims for stored OAuth token
        return null;
    }
}

public class CopilotStatus
{
    public bool Enabled { get; set; }
    public bool Configured { get; set; }
    public string Model { get; set; } = string.Empty;
}
