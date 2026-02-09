using DevDash.API.Configuration;
using DevDash.API.Services;
using DevDash.API.Middleware;
using Microsoft.Identity.Web;
using Microsoft.FeatureManagement;
using StackExchange.Redis;
using Elastic.Clients.Elasticsearch;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ============================================
// Configuration
// ============================================
// appsettings.json    - Settings (org, project, URLs) - committed
// config/secrets.config.json - Secrets (PATs, keys) - gitignored

var configPath = Path.Combine(AppContext.BaseDirectory, "config");

builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile(Path.Combine(configPath, "secrets.config.json"), optional: true, reloadOnChange: true)
    .AddEnvironmentVariables();

// Register ConfigurationService for centralized config access
builder.Services.AddSingleton<IConfigurationService, ConfigurationService>();

// ============================================
// Authentication - Microsoft Entra ID
// ============================================

var entraEnabled = builder.Configuration.GetValue<bool>("Features:EnableEntraId", true);
if (entraEnabled)
{
    builder.Services.AddMicrosoftIdentityWebApiAuthentication(builder.Configuration, "AzureAd");
}

// ============================================
// Feature Flags
// ============================================

builder.Services.AddFeatureManagement(builder.Configuration.GetSection("Features"));

// ============================================
// Database - SQL Server
// ============================================

var sqlConnection = builder.Configuration["ConnectionStrings:SqlServer"]
                    ?? builder.Configuration.GetConnectionString("SqlServer");

if (!string.IsNullOrEmpty(sqlConnection))
{
    builder.Services.AddDbContext<DevDashDbContext>(options =>
        options.UseSqlServer(sqlConnection));
}

// ============================================
// Redis Cache (optional - falls back to in-memory)
// ============================================

var redisConnection = builder.Configuration["ConnectionStrings:Redis"]
                      ?? builder.Configuration.GetConnectionString("Redis");

if (!string.IsNullOrEmpty(redisConnection))
{
    try
    {
        var redis = ConnectionMultiplexer.Connect(redisConnection);
        builder.Services.AddSingleton<IConnectionMultiplexer>(redis);
        builder.Services.AddScoped<ICacheService, RedisCacheService>();
    }
    catch
    {
        builder.Services.AddMemoryCache();
        builder.Services.AddScoped<ICacheService, InMemoryCacheService>();
    }
}
else
{
    builder.Services.AddMemoryCache();
    builder.Services.AddScoped<ICacheService, InMemoryCacheService>();
}

// ============================================
// Elasticsearch
// ============================================

var elasticUri = builder.Configuration["Services:Elasticsearch:Uri"]
                 ?? builder.Configuration["Elasticsearch:Uri"];

if (!string.IsNullOrEmpty(elasticUri))
{
    builder.Services.AddSingleton(new ElasticsearchClient(new Uri(elasticUri)));
}
builder.Services.AddScoped<IIssueSearchService, ElasticsearchIssueService>();

// ============================================
// AI Services
// ============================================

builder.Services.AddScoped<IAIService, AzureOpenAIService>();
builder.Services.AddScoped<IAIService, CopilotService>();
builder.Services.AddScoped<AIServiceRouter>();

// ============================================
// DevOps Integration
// ============================================

builder.Services.AddHttpClient<IDevOpsService, AzureDevOpsService>(client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

builder.Services.AddHttpClient<IGitHubService, GitHubService>(client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github+json");
    client.DefaultRequestHeaders.Add("User-Agent", "DevDash-API");
});

// ============================================
// Performance Service (User-specific DevOps data)
// ============================================

builder.Services.AddHttpClient("AzureDevOps", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

builder.Services.AddHttpClient("GitHub", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/vnd.github+json");
    client.DefaultRequestHeaders.Add("User-Agent", "DevDash-API");
});

builder.Services.AddHttpClient("MicrosoftGraph", client =>
{
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

builder.Services.AddScoped<IPerformanceService, PerformanceService>();

// ============================================
// Copilot Service (GitHub Copilot Chat)
// ============================================

var copilotEnabled = builder.Configuration.GetValue<bool>("Features:EnableCopilot", false);
if (copilotEnabled)
{
    builder.Services.AddScoped<ICopilotChatService, CopilotChatService>();
}

// ============================================
// Lighthouse Service
// ============================================

var lighthouseEnabled = builder.Configuration.GetValue<bool>("Features:EnableLighthouse", false);
if (lighthouseEnabled)
{
    builder.Services.AddScoped<ILighthouseService, LighthouseService>();
}

// ============================================
// Health Checks
// ============================================

var healthChecksBuilder = builder.Services.AddHealthChecks();

if (!string.IsNullOrEmpty(redisConnection))
{
    healthChecksBuilder.AddRedis(redisConnection, name: "redis");
}

if (!string.IsNullOrEmpty(elasticUri))
{
    healthChecksBuilder.AddElasticsearch(elasticUri, name: "elasticsearch");
}

if (!string.IsNullOrEmpty(sqlConnection))
{
    healthChecksBuilder.AddSqlServer(sqlConnection, name: "sqlserver");
}

// ============================================
// CORS - Allow React Frontend
// ============================================

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? new[] { "http://localhost:5173" };

        policy.WithOrigins(origins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ============================================
// Controllers & Swagger
// ============================================

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "DevDash API", Version = "v1" });
});

var app = builder.Build();

// ============================================
// Middleware Pipeline
// ============================================

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseHttpsRedirection();

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
