namespace DevDash.API.Models;

/// <summary>
/// Request model for AI assistant queries
/// </summary>
public class AIQueryRequest
{
    public string Query { get; set; } = string.Empty;
    public string? Context { get; set; }
    public AIQueryType QueryType { get; set; } = AIQueryType.General;
    public string? PipelineId { get; set; }
    public string? PRId { get; set; }
    public string? ErrorLog { get; set; }
}

public enum AIQueryType
{
    General,
    PipelineFailure,
    PRReview,
    CodeExplanation,
    ResolutionSuggestion,
    BestPractices
}

/// <summary>
/// Response model from AI assistant
/// </summary>
public class AIQueryResponse
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Query { get; set; } = string.Empty;
    public string Response { get; set; } = string.Empty;
    public AIResponseSource Source { get; set; }
    public List<SuggestedResolution> SuggestedResolutions { get; set; } = new();
    public List<RelatedIssue> RelatedIssues { get; set; } = new();
    public double ConfidenceScore { get; set; }
    public int TokensUsed { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum AIResponseSource
{
    AzureOpenAI,
    MicrosoftCopilot,
    CachedResponse,
    KnowledgeBase
}

/// <summary>
/// Suggested resolution returned by AI
/// </summary>
public class SuggestedResolution
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> Steps { get; set; } = new();
    public string? CodeSnippet { get; set; }
    public double RelevanceScore { get; set; }
    public string? SourceUrl { get; set; }
}

/// <summary>
/// Related issue found in knowledge base
/// </summary>
public class RelatedIssue
{
    public string IssueId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public double SimilarityScore { get; set; }
    public int ResolutionCount { get; set; }
}

/// <summary>
/// Chat message for conversation history
/// </summary>
public class ChatMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public ChatMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum ChatMessageRole
{
    User,
    Assistant,
    System
}

/// <summary>
/// AI usage tracking for cost management
/// </summary>
public class AIUsageRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public AIResponseSource Provider { get; set; }
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public decimal EstimatedCost { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
