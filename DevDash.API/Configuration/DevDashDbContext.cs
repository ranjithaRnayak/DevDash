using Microsoft.EntityFrameworkCore;
using DevDash.API.Models;

namespace DevDash.API.Configuration;

public class DevDashDbContext : DbContext
{
    public DevDashDbContext(DbContextOptions<DevDashDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<AIUsageRecord> AIUsageRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User configuration
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.ExternalId);

            entity.Property(e => e.Email).IsRequired().HasMaxLength(256);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(256);
            entity.Property(e => e.Role).HasConversion<string>();
            entity.Property(e => e.AuthProvider).HasConversion<string>();

            // Store preferences as JSON
            entity.OwnsOne(e => e.Preferences, prefs =>
            {
                prefs.ToJson();
            });
        });

        // Audit log configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.UserId, e.Timestamp });

            entity.Property(e => e.Action).HasConversion<string>();
            entity.Property(e => e.ResourceType).HasMaxLength(100);
            entity.Property(e => e.ResourceId).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(50);
        });

        // AI usage record configuration
        modelBuilder.Entity<AIUsageRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.UserId, e.Timestamp });

            entity.Property(e => e.Provider).HasConversion<string>();
            entity.Property(e => e.EstimatedCost).HasPrecision(10, 6);
        });
    }
}
