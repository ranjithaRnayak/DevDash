using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace DevDash.API.Middleware;

/// <summary>
/// Authentication handler for PAT (Personal Access Token) mode.
/// When PAT mode is enabled, this handler authenticates all requests
/// without requiring Microsoft Entra ID authentication.
/// </summary>
public class PATAuthenticationHandler : AuthenticationHandler<PATAuthenticationOptions>
{
    private readonly IConfiguration _configuration;

    public PATAuthenticationHandler(
        IOptionsMonitor<PATAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _configuration = configuration;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // If this handler is registered, PAT mode is enabled - always authenticate
        // The check for UsePATToken is done at startup in Program.cs

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "pat-user"),
            new Claim(ClaimTypes.Name, "PAT User"),
            new Claim(ClaimTypes.Email, "pat-user@local"),
            new Claim("auth_type", "PAT"),
        };

        // Check for PAT token in header (optional - for GitHub/Azure DevOps API calls)
        var patToken = Request.Headers["X-PAT-Token"].FirstOrDefault()
                       ?? Request.Headers["Authorization"].FirstOrDefault()?.Replace("Bearer ", "");

        if (!string.IsNullOrEmpty(patToken))
        {
            claims.Add(new Claim("pat_token", patToken));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        Logger.LogDebug("PAT authentication successful for request {Path}", Request.Path);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

/// <summary>
/// Options for PAT authentication handler
/// </summary>
public class PATAuthenticationOptions : AuthenticationSchemeOptions
{
    public const string SchemeName = "PAT";
}

/// <summary>
/// Extension methods for adding PAT authentication
/// </summary>
public static class PATAuthenticationExtensions
{
    public static AuthenticationBuilder AddPATAuthentication(
        this AuthenticationBuilder builder,
        Action<PATAuthenticationOptions>? configureOptions = null)
    {
        return builder.AddScheme<PATAuthenticationOptions, PATAuthenticationHandler>(
            PATAuthenticationOptions.SchemeName,
            configureOptions ?? (_ => { }));
    }
}
