using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web.Resource;
using DevDash.API.Models;
using DevDash.API.Services;
using System.Security.Claims;

namespace DevDash.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ICacheService _cacheService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IConfiguration configuration,
        ICacheService cacheService,
        ILogger<AuthController> logger)
    {
        _configuration = configuration;
        _cacheService = cacheService;
        _logger = logger;
    }

    /// <summary>
    /// Get current user information from token
    /// </summary>
    [HttpGet("me")]
    [RequiredScope("access_as_user")]
    public ActionResult<UserInfo> GetCurrentUser()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value
                    ?? User.FindFirst("preferred_username")?.Value;
        var name = User.FindFirst(ClaimTypes.Name)?.Value
                   ?? User.FindFirst("name")?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var userInfo = new UserInfo
        {
            Id = userId,
            Email = email ?? "",
            DisplayName = name ?? email ?? "Unknown",
            Roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList()
        };

        _logger.LogInformation("User {UserId} authenticated successfully", userId);

        return Ok(userInfo);
    }

    /// <summary>
    /// Validate token and return status
    /// </summary>
    [HttpGet("validate")]
    public ActionResult ValidateToken()
    {
        return Ok(new { valid = true, timestamp = DateTime.UtcNow });
    }

    /// <summary>
    /// Logout - clear server-side session
    /// </summary>
    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId))
        {
            // Clear user session from cache
            await _cacheService.RemoveAsync($"session:{userId}");
            _logger.LogInformation("User {UserId} logged out", userId);
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get feature flags for the current user
    /// </summary>
    [HttpGet("features")]
    [AllowAnonymous]
    public ActionResult<FeatureFlagsResponse> GetFeatureFlags()
    {
        var flags = new FeatureFlagsResponse
        {
            UseAzureOpenAI = _configuration.GetValue<bool>("FeatureFlags:UseAzureOpenAI"),
            UseCopilot = _configuration.GetValue<bool>("FeatureFlags:UseCopilot"),
            EnableAIAssistant = _configuration.GetValue<bool>("FeatureFlags:EnableAIAssistant"),
            EnablePipelineAlerts = _configuration.GetValue<bool>("FeatureFlags:EnablePipelineAlerts"),
            EnablePRAlerts = _configuration.GetValue<bool>("FeatureFlags:EnablePRAlerts"),
            UsePATToken = _configuration.GetValue<bool>("FeatureFlags:UsePATToken")
        };

        return Ok(flags);
    }

    public class UserInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public List<string> Roles { get; set; } = new();
    }

    public class FeatureFlagsResponse
    {
        public bool UseAzureOpenAI { get; set; }
        public bool UseCopilot { get; set; }
        public bool EnableAIAssistant { get; set; }
        public bool EnablePipelineAlerts { get; set; }
        public bool EnablePRAlerts { get; set; }
        public bool UsePATToken { get; set; }
    }
}
