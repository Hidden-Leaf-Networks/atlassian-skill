/**
 * Core types for the Atlassian Skill
 * Shared across all modules for consistent typing
 */

// ============================================================================
// Authentication Types
// ============================================================================

/**
 * OAuth 2.0 token response from Atlassian
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

/**
 * Stored token with expiry timestamp
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * API Token authentication (fallback)
 */
export interface ApiTokenAuth {
  email: string;
  apiToken: string;
}

/**
 * Union type for authentication methods
 */
export type AuthMethod =
  | { type: 'oauth'; tokens: StoredTokens }
  | { type: 'api_token'; credentials: ApiTokenAuth };

/**
 * Token storage interface for persistence
 */
export interface TokenStorage {
  getTokens(): Promise<StoredTokens | null>;
  saveTokens(tokens: StoredTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum points per hour (default: 65000) */
  pointsPerHour: number;
  /** Maximum requests per second (default: 10) */
  requestsPerSecond: number;
  /** Enable burst mode for short-term spikes */
  allowBurst: boolean;
  /** Burst bucket size */
  burstSize: number;
}

/**
 * Rate limit state tracking
 */
export interface RateLimitState {
  /** Points consumed in current hour window */
  pointsConsumed: number;
  /** Timestamp when hour window started */
  windowStart: number;
  /** Timestamps of recent requests for per-second limiting */
  recentRequests: number[];
  /** Whether currently in backoff mode */
  inBackoff: boolean;
  /** Backoff end timestamp */
  backoffUntil: number;
}

/**
 * API endpoint rate cost mapping
 */
export interface EndpointCost {
  /** Base cost in points */
  baseCost: number;
  /** Additional cost per result (for paginated endpoints) */
  perResultCost: number;
  /** Maximum results allowed per request */
  maxResults: number;
}

// ============================================================================
// HTTP Client Types
// ============================================================================

/**
 * HTTP request configuration
 */
export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Override default rate limit cost */
  rateLimitCost?: number;
  /** Skip rate limiting check */
  skipRateLimit?: boolean;
}

/**
 * HTTP response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  rateLimitInfo?: RateLimitInfo;
}

/**
 * Rate limit info from response headers
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Backoff multiplier */
  backoffFactor: number;
  /** HTTP status codes to retry */
  retryableStatuses: number[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base Atlassian API error
 */
export class AtlassianApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AtlassianApiError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AtlassianApiError {
  constructor(message: string, details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error (forbidden)
 */
export class AuthorizationError extends AtlassianApiError {
  constructor(message: string, details?: unknown) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AtlassianApiError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AtlassianApiError {
  constructor(
    message: string,
    public readonly retryAfter: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Validation error for request data
 */
export class ValidationError extends AtlassianApiError {
  constructor(
    message: string,
    public readonly validationErrors: ValidationIssue[]
  ) {
    super(message, 400, 'VALIDATION_ERROR', { validationErrors });
    this.name = 'ValidationError';
  }
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// Atlassian Document Format (ADF) Types
// ============================================================================

/**
 * ADF node types
 */
export type AdfNodeType =
  | 'doc'
  | 'paragraph'
  | 'text'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'codeBlock'
  | 'blockquote'
  | 'rule'
  | 'hardBreak'
  | 'table'
  | 'tableRow'
  | 'tableHeader'
  | 'tableCell'
  | 'panel'
  | 'mention'
  | 'emoji'
  | 'inlineCard'
  | 'mediaGroup'
  | 'mediaSingle'
  | 'media';

/**
 * Text mark types
 */
export type AdfMarkType =
  | 'strong'
  | 'em'
  | 'code'
  | 'strike'
  | 'underline'
  | 'link'
  | 'textColor'
  | 'subsup';

/**
 * ADF mark definition
 */
export interface AdfMark {
  type: AdfMarkType;
  attrs?: Record<string, unknown>;
}

/**
 * Base ADF node
 */
export interface AdfNode {
  type: AdfNodeType;
  content?: AdfNode[];
  text?: string;
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
}

/**
 * Root ADF document
 */
export interface AdfDocument {
  version: 1;
  type: 'doc';
  content: AdfNode[];
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  values: T[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
}

/**
 * Pagination options for requests
 */
export interface PaginationOptions {
  startAt?: number;
  maxResults?: number;
}

// ============================================================================
// Cloud Resource Types
// ============================================================================

/**
 * Atlassian Cloud resource (site)
 */
export interface CloudResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session tracking data
 */
export interface SessionData {
  sessionId: string;
  startedAt: number;
  lastActivityAt: number;
  operations: OperationLog[];
}

/**
 * Operation log entry
 */
export interface OperationLog {
  timestamp: number;
  operation: string;
  resource: string;
  resourceId?: string;
  success: boolean;
  durationMs: number;
  pointsCost?: number;
  error?: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Atlassian client configuration
 */
export interface AtlassianClientConfig {
  /** Cloud ID for the Atlassian site */
  cloudId: string;
  /** Site URL (e.g., https://your-domain.atlassian.net) */
  siteUrl: string;
  /** Authentication method */
  auth: AuthMethod;
  /** Optional rate limit configuration */
  rateLimit?: Partial<RateLimitConfig>;
  /** Optional retry configuration */
  retry?: Partial<RetryConfig>;
  /** Enable debug logging */
  debug?: boolean;
}
