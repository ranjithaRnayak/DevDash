using System.Collections.Concurrent;
using System.Security.Claims;

namespace DevDash.API.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private static readonly ConcurrentDictionary<string, RateLimitInfo> _rateLimits = new();

    public RateLimitingMiddleware(
        RequestDelegate next,
        IConfiguration configuration,
        ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLower() ?? "";

        // Apply rate limiting to AI endpoints
        if (path.Contains("/api/aiassistant"))
        {
            var limit = _configuration.GetValue<int>("RateLimiting:AIRequestsPerMinute", 10);
            if (!await CheckRateLimitAsync(context, "ai", limit))
            {
                return;
            }
        }
        // Apply rate limiting to DevOps endpoints
        else if (path.Contains("/api/devops"))
        {
            var limit = _configuration.GetValue<int>("RateLimiting:DevOpsRequestsPerMinute", 30);
            if (!await CheckRateLimitAsync(context, "devops", limit))
            {
                return;
            }
        }

        await _next(context);
    }

    private async Task<bool> CheckRateLimitAsync(HttpContext context, string category, int maxRequests)
    {
        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? context.Connection.RemoteIpAddress?.ToString()
                     ?? "anonymous";

        var key = $"{category}:{userId}";
        var now = DateTime.UtcNow;

        var rateLimitInfo = _rateLimits.AddOrUpdate(
            key,
            _ => new RateLimitInfo { Count = 1, WindowStart = now },
            (_, existing) =>
            {
                // Reset window if expired (1 minute window)
                if (now - existing.WindowStart > TimeSpan.FromMinutes(1))
                {
                    return new RateLimitInfo { Count = 1, WindowStart = now };
                }

                existing.Count++;
                return existing;
            });

        // Add rate limit headers
        context.Response.Headers["X-RateLimit-Limit"] = maxRequests.ToString();
        context.Response.Headers["X-RateLimit-Remaining"] = Math.Max(0, maxRequests - rateLimitInfo.Count).ToString();
        context.Response.Headers["X-RateLimit-Reset"] = ((int)(rateLimitInfo.WindowStart.AddMinutes(1) - now).TotalSeconds).ToString();

        if (rateLimitInfo.Count > maxRequests)
        {
            _logger.LogWarning("Rate limit exceeded for {UserId} on {Category}", userId, category);

            context.Response.StatusCode = 429;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Rate limit exceeded",
                message = $"You have exceeded the rate limit of {maxRequests} requests per minute",
                retryAfter = (int)(rateLimitInfo.WindowStart.AddMinutes(1) - now).TotalSeconds
            });

            return false;
        }

        return true;
    }

    private class RateLimitInfo
    {
        public int Count { get; set; }
        public DateTime WindowStart { get; set; }
    }
}
