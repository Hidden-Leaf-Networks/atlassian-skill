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
  adf,
} from './core/adf-builder.js';

export * from './core/types.js';

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

export * from './jira/types.js';

// ============================================================================
// Confluence Exports
// ============================================================================

export {
  ConfluenceClient,
} from './confluence/client.js';

export * from './confluence/types.js';

// ============================================================================
// Bitbucket Exports
// ============================================================================

export {
  BitbucketClient,
} from './bitbucket/client.js';

export * from './bitbucket/types.js';

// ============================================================================
// Orchestration Exports
// ============================================================================

export * from './orchestration/types.js';
export * from './orchestration/branch-naming.js';
export * from './orchestration/changelog-generator.js';
export * from './orchestration/pr-description-generator.js';

// ============================================================================
// Autonomous Exports
// ============================================================================

export * from './autonomous/types.js';
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
