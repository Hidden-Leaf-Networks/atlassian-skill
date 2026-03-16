/**
 * Atlassian Claude Code Skill
 * Unified integration for Jira, Confluence, and Bitbucket
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Exports
// ============================================================================

export {
  AtlassianClient,
  createClientFromEnv,
} from './core/client.js';

export {
  AtlassianOAuthManager,
  createAuthFromEnv,
  createOAuthManagerFromEnv,
  createApiTokenAuth,
  validateApiToken,
  EnvironmentTokenStorage,
  DEFAULT_JIRA_SCOPES,
  DEFAULT_CONFLUENCE_SCOPES,
} from './core/auth.js';

export {
  RateLimiter,
  createRateLimiterFromEnv,
} from './core/rate-limiter.js';

export {
  AdfBuilder,
  TextBuilder,
  adf,
  text,
  textToAdf,
  markdownToAdf,
  adfToText,
} from './core/adf-builder.js';

export {
  // Auth types
  type OAuthTokenResponse,
  type StoredTokens,
  type AuthConfig,
  type ApiTokenAuth,
  type AuthMethod,
  type TokenStorage,
  // Rate limiting types
  type RateLimitConfig,
  type RateLimitState,
  type EndpointCost,
  // HTTP types
  type RequestConfig,
  type ApiResponse,
  type RateLimitInfo,
  type RetryConfig,
  // Error types
  AtlassianApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  type ValidationIssue,
  // ADF types
  type AdfNodeType,
  type AdfMarkType,
  type AdfMark,
  type AdfNode,
  type AdfDocument,
  // Pagination types
  type PaginatedResponse,
  type PaginationOptions,
  // Cloud types
  type CloudResource,
  // Session types
  type SessionData,
  type OperationLog,
  // Client config
  type AtlassianClientConfig,
} from './core/types.js';

// ============================================================================
// Jira Exports
// ============================================================================

export {
  JiraClient,
  createJiraClientFromEnv,
} from './jira/client.js';

export {
  JqlBuilder,
  jql,
  JqlFunctions,
  JqlTemplates,
} from './jira/jql-builder.js';

export {
  type JiraUser,
  type JiraProject,
  type JiraProjectSearchResult,
  type JiraProjectCreateInput,
  type JiraIssueType,
  type JiraPriority,
  type JiraStatus,
  type JiraResolution,
  type JiraComponent,
  type JiraVersion,
  type JiraIssueLinkType,
  type JiraIssueLink,
  type JiraIssueReference,
  type JiraChangelogEntry,
  type JiraComment,
  type JiraWorklog,
  type JiraAttachment,
  type JiraIssue,
  type JiraIssueFields,
  type JiraFieldMeta,
  type JiraTransition,
  type JiraBoard,
  type JiraSprint,
  type JiraSprintIssuesResponse,
  type JiraSearchOptions,
  type JiraSearchResults,
  type JiraIssueCreateInput,
  type JiraIssueUpdateInput,
  type JiraCommentInput,
  type JiraTransitionInput,
  type JiraIssueCreateResponse,
  type JiraTransitionsResponse,
  type JiraCommentsResponse,
  JIRA_LIST_FIELDS,
  JIRA_DETAIL_FIELDS,
  JIRA_EXTENDED_FIELDS,
} from './jira/types.js';

// ============================================================================
// Confluence Exports
// ============================================================================

export {
  ConfluenceClient,
} from './confluence/client.js';

export {
  type Space,
  type SpaceType,
  type SpaceStatus,
  type SpaceDescription,
  type SpaceIcon,
  type SpaceLinks,
  type Page,
  type PageStatus,
  type ParentType,
  type PageVersion,
  type PageBody,
  type PageBodyRepresentation,
  type BodyRepresentationType,
  type Label,
  type PageLinks,
  type ADFDocument,
  type ADFNode,
  type ADFNodeType,
  type ADFMark,
  type ADFMarkType,
  type CQLQuery,
  type SearchResult,
  type PaginationLinks,
  type CreatePageOptions,
  type UpdatePageOptions,
  type GetPageOptions,
  type SearchPagesOptions,
  type ListSpacesOptions,
  type SyncOptions,
  type SyncResult,
  type PageSyncInfo,
  type SyncError,
  type ConfluenceError,
  isConfluenceError,
} from './confluence/types.js';

// ============================================================================
// Bitbucket Exports
// ============================================================================

export {
  BitbucketClient,
} from './bitbucket/client.js';

export {
  type BitbucketLink,
  type BitbucketLinks,
  type BitbucketAccount,
  type BitbucketError,
  type Project as BitbucketProject,
  type Repository,
  type Workspace,
  type BranchRef,
  type CommitRef,
  type BranchTarget,
  type Branch,
  type CreateBranchRequest,
  type PullRequestState,
  type PullRequestRef,
  type PullRequestParticipant,
  type PullRequestReviewer,
  type PullRequest,
  type CreatePullRequestRequest,
  type UpdatePullRequestRequest,
  type MergeStrategy,
  type MergePullRequestRequest,
  type CommentContent,
  type InlineLocation,
  type Comment,
  type CreateCommentRequest,
  type PipelineStateType,
  type PipelineResultType,
  type PipelineState,
  type PipelineTarget,
  type PipelineTrigger,
  type PipelineCreator,
  type Pipeline,
  type PipelineStepState,
  type PipelineStep,
  type PipelineVariable,
  type TriggerPipelineRequest,
  type EnvironmentType,
  type EnvironmentLock,
  type Environment,
  type DeploymentState,
  type DeploymentRelease,
  type Deployment,
  type DeploymentVariable,
  type SetDeploymentVariableRequest,
  type DiffStatEntry,
  type DiffResponse,
  type BitbucketAuthConfig,
  type BitbucketClientConfig,
  type WaitForPipelineOptions,
  type ApprovalResponse,
  type StopPipelineResponse,
} from './bitbucket/types.js';

// ============================================================================
// Orchestration Exports
// ============================================================================

export {
  type WorkType,
  ISSUE_TYPE_TO_WORK_TYPE,
  type JiraTransition as OrchestrJiraTransition,
  type PipelineStatus,
  type DeploymentEnvironment,
  type BitbucketBranch,
  type BitbucketPullRequest,
  type BitbucketPipeline,
  type BitbucketDeployment,
  type ConfluencePage,
  type SessionContext,
  type FeatureContext,
  type CompletionResult,
  type ReleaseResult,
  type WorkflowConfig,
  DEFAULT_WORKFLOW_CONFIG,
  type WorkflowState,
  type BranchCreatedEvent,
  type PRCreatedEvent,
  type PRMergedEvent,
  type PRDeclinedEvent,
  type PipelineCompletedEvent,
  type DeploymentCompletedEvent,
  type JiraIssueUpdatedEvent,
  type AnyWorkflowEvent,
  type IJiraService,
  type IBitbucketService,
  type IConfluenceService,
  type ISessionManager,
  WorkflowError,
  type WorkflowErrorCode,
  type RequireFields,
  type DeepPartial,
  type Result,
  type AsyncResult,
  type JiraTransitionInfo,
} from './orchestration/types.js';

export * from './orchestration/branch-naming.js';
export * from './orchestration/changelog-generator.js';
export * from './orchestration/plan-executor.js';
export * from './orchestration/board-sync.js';
export * from './orchestration/workflow-manager.js';
export * from './orchestration/project-reset.js';

export {
  type PRTemplateType,
  type PRDescriptionOptions,
  type PRCustomSection,
  type DiffAnalysis,
  type GeneratedPRDescription,
  generatePRDescription,
  generatePRTitle,
  analyzeDiff,
  suggestLabels as suggestPRLabels,
  generatePRDescriptionFromSession,
  generateQuickPRDescription,
} from './orchestration/pr-description-generator.js';

export * from './orchestration/session-bridge.js';

// ============================================================================
// Autonomous Exports
// ============================================================================

export {
  OperationMode,
  ConfidenceLevel,
  Priority,
  IssueType,
  RiskLevel,
  AnomalyType,
  TriggerType,
  ActionType,
  type AuditEntry,
  type BaseResult,
  type ConfidenceScore,
  type SimilarIssue,
  type DuplicateResult,
  type AssigneeSuggestion,
  type TriageRecommendation,
  type TriageResult,
  type SprintMetrics,
  type VelocityAnalysis,
  type IssueSuggestion,
  type ScopeSuggestion,
  type RiskFactor,
  type RiskAssessment,
  type EstimationSuggestion,
  type StaleIssue,
  type BlockedIssue,
  type AtRiskItem,
  type HealthMetrics,
  type HealthReport,
  type Anomaly,
  type AgentCapability,
  type AgentRequest,
  type AgentResponse,
  type WorkflowContext,
  type TriggerConfig,
  type Condition,
  type Action,
  type AutomationRule,
  type ActionResult,
  type WeeklyDigest,
  type PerformanceAnalysis,
  type Improvement,
  type DeliveryPrediction,
  type AutonomousConfig,
} from './autonomous/types.js';

export * from './autonomous/planning.js';
export * from './autonomous/triage.js';

// ============================================================================
// Session Exports
// ============================================================================

export {
  SessionCapture,
  createSessionCaptureFromEnv,
} from './session/capture.js';

export {
  SessionArchiver,
  createArchiverFromEnv,
} from './session/archiver.js';

export * from './session/types.js';

// ============================================================================
// Utilities
// ============================================================================

export {
  Logger,
  createLogger,
  createLoggerFromEnv,
} from './utils/logger.js';

export * from './utils/validators.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
