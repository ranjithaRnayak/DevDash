namespace DevDash.API.Models;

/// <summary>
/// Application user entity
/// </summary>
public class User
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public UserRole Role { get; set; } = UserRole.Developer;
    public AuthProvider AuthProvider { get; set; }
    public string? ExternalId { get; set; } // Entra ID object ID
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    public UserPreferences Preferences { get; set; } = new();
}

public enum UserRole
{
    Developer,
    TeamLead,
    Admin
}

public enum AuthProvider
{
    EntraID,
    Google,
    GitHub,
    Email
}

/// <summary>
/// User preferences for dashboard
/// </summary>
public class UserPreferences
{
    public string Theme { get; set; } = "dark";
    public bool EnableNotifications { get; set; } = true;
    public bool EnableEmailAlerts { get; set; } = false;
    public List<string> FavoritePipelines { get; set; } = new();
    public List<string> WatchedRepos { get; set; } = new();
    public string DefaultEnvironment { get; set; } = "dev";
}

/// <summary>
/// Audit log entry for tracking user actions
/// </summary>
public class AuditLog
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
    public AuditAction Action { get; set; }
    public string ResourceType { get; set; } = string.Empty;
    public string ResourceId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum AuditAction
{
    Login,
    Logout,
    ViewDashboard,
    ViewPipeline,
    ViewPR,
    AIQuery,
    ExportData,
    UpdateSettings
}
