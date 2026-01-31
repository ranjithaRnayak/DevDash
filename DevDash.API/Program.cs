using DevDash.API.Configuration;
using DevDash.API.Services;
using DevDash.API.Middleware;
using Microsoft.Identity.Web;
using Microsoft.FeatureManagement;
using StackExchange.Redis;
using Elastic.Clients.Elasticsearch;
using Microsoft.EntityFrameworkCore;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var builder = WebApplication.CreateBuilder(args);

// ============================================
// Configuration
// ============================================

// Add Azure Key Vault (if configured)
var keyVaultUri = builder.Configuration["KeyVault:Uri"];
if (!string.IsNullOrEmpty(keyVaultUri))
{
    builder.Configuration.AddAzureKeyVault(
        new Uri(keyVaultUri),
        new DefaultAzureCredential());
}

// ============================================
// Authentication - Microsoft Entra ID
// ============================================

builder.Services.AddMicrosoftIdentityWebApiAuthentication(builder.Configuration, "AzureAd");

// ============================================
// Feature Flags
// ============================================

builder.Services.AddFeatureManagement(builder.Configuration.GetSection("FeatureFlags"));

// ============================================
// Database - SQL Server
// ============================================

builder.Services.AddDbContext<DevDashDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));

// ============================================
// Redis Cache
// ============================================

var redisConnection = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrEmpty(redisConnection))
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(
        ConnectionMultiplexer.Connect(redisConnection));
    builder.Services.AddScoped<ICacheService, RedisCacheService>();
}
else
{
    // Fallback to in-memory cache for development
    builder.Services.AddMemoryCache();
    builder.Services.AddScoped<ICacheService, InMemoryCacheService>();
}

// ============================================
// Elasticsearch
// ============================================

var elasticUri = builder.Configuration["Elasticsearch:Uri"];
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

var sqlConnection = builder.Configuration.GetConnectionString("SqlServer");
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
        policy.WithOrigins(
                builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? new[] { "http://localhost:5173" })
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

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");

// Custom error handling
app.UseMiddleware<ErrorHandlingMiddleware>();

// Rate limiting middleware
app.UseMiddleware<RateLimitingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
