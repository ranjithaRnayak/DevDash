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

    /// <summary>
    /// Connect GitHub using Personal Access Token
    /// </summary>
    [HttpPost("github/connect")]
    [RequiredScope("access_as_user")]
    public async Task<ActionResult<GitHubConnectionResponse>> ConnectGitHub([FromBody] GitHubConnectRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrEmpty(request.PersonalAccessToken))
        {
            return BadRequest(new { error = "Personal Access Token is required" });
        }

        try
        {
            // Validate PAT with GitHub API
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {request.PersonalAccessToken}");
            httpClient.DefaultRequestHeaders.Add("Accept", "application/vnd.github+json");
            httpClient.DefaultRequestHeaders.Add("User-Agent", "DevDash-API");

            var response = await httpClient.GetAsync("https://api.github.com/user");
            if (!response.IsSuccessStatusCode)
            {
                return BadRequest(new { error = "Invalid GitHub Personal Access Token" });
            }

            var content = await response.Content.ReadAsStringAsync();
            var gitHubUser = System.Text.Json.JsonSerializer.Deserialize<GitHubUserResponse>(content,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            // Store GitHub connection in cache (in production, store in database)
            await _cacheService.SetAsync($"github:{userId}", new GitHubConnection
            {
                UserId = userId,
                GitHubUsername = gitHubUser?.Login ?? "",
                GitHubId = gitHubUser?.Id.ToString() ?? "",
                ConnectedAt = DateTime.UtcNow,
                TokenHash = ComputeTokenHash(request.PersonalAccessToken)
            }, TimeSpan.FromDays(30));

            _logger.LogInformation("User {UserId} connected GitHub account {GitHubUsername}", userId, gitHubUser?.Login);

            return Ok(new GitHubConnectionResponse
            {
                Connected = true,
                GitHubUsername = gitHubUser?.Login ?? "",
                AvatarUrl = gitHubUser?.AvatarUrl ?? ""
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect GitHub for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to connect GitHub" });
        }
    }

    /// <summary>
    /// Disconnect GitHub integration
    /// </summary>
    [HttpPost("github/disconnect")]
    [RequiredScope("access_as_user")]
    public async Task<ActionResult> DisconnectGitHub()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        await _cacheService.RemoveAsync($"github:{userId}");
        _logger.LogInformation("User {UserId} disconnected GitHub account", userId);

        return Ok(new { success = true });
    }

    /// <summary>
    /// Get GitHub connection status
    /// </summary>
    [HttpGet("github/status")]
    [RequiredScope("access_as_user")]
    public async Task<ActionResult<GitHubConnectionResponse>> GetGitHubStatus()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var connection = await _cacheService.GetAsync<GitHubConnection>($"github:{userId}");
        if (connection == null)
        {
            return Ok(new GitHubConnectionResponse { Connected = false });
        }

        return Ok(new GitHubConnectionResponse
        {
            Connected = true,
            GitHubUsername = connection.GitHubUsername,
            AvatarUrl = ""
        });
    }

    private static string ComputeTokenHash(string token)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public class GitHubConnectRequest
    {
        public string PersonalAccessToken { get; set; } = string.Empty;
    }

    public class GitHubConnectionResponse
    {
        public bool Connected { get; set; }
        public string GitHubUsername { get; set; } = string.Empty;
        public string AvatarUrl { get; set; } = string.Empty;
    }

    public class GitHubUserResponse
    {
        public int Id { get; set; }
        public string Login { get; set; } = string.Empty;
        public string AvatarUrl { get; set; } = string.Empty;
    }

    public class GitHubConnection
    {
        public string UserId { get; set; } = string.Empty;
        public string GitHubUsername { get; set; } = string.Empty;
        public string GitHubId { get; set; } = string.Empty;
        public DateTime ConnectedAt { get; set; }
        public string TokenHash { get; set; } = string.Empty;
    }
}
