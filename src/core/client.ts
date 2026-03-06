/**
 * Base Atlassian API Client
 * Provides unified HTTP interface with rate limiting, retries, and error handling
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import {
  AtlassianClientConfig,
  RequestConfig,
  ApiResponse,
  RetryConfig,
  RateLimitInfo,
  AtlassianApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  AuthMethod,
} from './types.js';
import { RateLimiter, RateLimitStatus } from './rate-limiter.js';
import { AtlassianOAuthManager, createApiTokenAuth } from './auth.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// ============================================================================
// Constants
// ============================================================================

const ATLASSIAN_API_BASE = 'https://api.atlassian.com';

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// ============================================================================
// Base Atlassian Client
// ============================================================================

/**
 * Base client for Atlassian API operations
 * Handles authentication, rate limiting, retries, and error handling
 */
export class AtlassianClient {
  protected readonly cloudId: string;
  protected readonly siteUrl: string;
  protected readonly auth: AuthMethod;
  protected readonly rateLimiter: RateLimiter;
  protected readonly retryConfig: RetryConfig;
  protected readonly logger: Logger;
  protected readonly httpClient: AxiosInstance;
  protected oauthManager?: AtlassianOAuthManager;

  constructor(config: AtlassianClientConfig) {
    this.cloudId = config.cloudId;
    this.siteUrl = config.siteUrl;
    this.auth = config.auth;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retry };
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.logger = createLoggerFromEnv('atlassian-client');

    if (config.debug) {
      this.logger.setLevel(0); // DEBUG level
    }

    this.httpClient = this.createHttpClient();
  }

  /**
   * Set OAuth manager for token refresh
   */
  setOAuthManager(manager: AtlassianOAuthManager): void {
    this.oauthManager = manager;
  }

  /**
   * Make an API request
   */
  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const { method, path, params, body, headers, rateLimitCost, skipRateLimit } = config;

    // Calculate rate limit cost
    const cost = rateLimitCost ?? this.rateLimiter.getEndpointCost(method, path);

    // Wait for rate limit capacity if not skipped
    if (!skipRateLimit) {
      await this.rateLimiter.waitForCapacity(cost);
    }

    const url = this.buildUrl(path);
    const requestHeaders = await this.buildHeaders(headers);

    this.logger.debug('Making API request', { method, url, cost });

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        const response = await this.httpClient.request<T>({
          method,
          url,
          params: this.cleanParams(params),
          data: body,
          headers: requestHeaders,
        });

        // Record successful request
        if (!skipRateLimit) {
          this.rateLimiter.recordRequest(cost);
        }

        // Update rate limit state from headers
        this.rateLimiter.updateFromHeaders(this.extractRateLimitHeaders(response));

        return this.wrapResponse(response);
      } catch (error) {
        lastError = error as Error;

        if (!this.shouldRetry(error as AxiosError, attempt)) {
          break;
        }

        const delay = this.calculateRetryDelay(error as AxiosError, attempt);
        this.logger.warn('Request failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: (error as Error).message,
        });

        await this.sleep(delay);
        attempt++;
      }
    }

    // All retries exhausted, throw the error
    throw this.transformError(lastError as AxiosError);
  }

  /**
   * GET request
   */
  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', path, params });
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', path, body, params });
  }

  /**
   * PUT request
   */
  async put<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', path, body, params });
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', path, params });
  }

  /**
   * PATCH request
   */
  async patch<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, body, params });
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    return this.rateLimiter.getStatus();
  }

  /**
   * Get the configured cloud ID
   */
  getCloudId(): string {
    return this.cloudId;
  }

  /**
   * Get the configured site URL
   */
  getSiteUrl(): string {
    return this.siteUrl;
  }

  // ==========================================================================
  // Protected Methods
  // ==========================================================================

  /**
   * Build full URL for request
   */
  protected buildUrl(path: string): string {
    // If path already includes the full URL, use it directly
    if (path.startsWith('http')) {
      return path;
    }

    // API token auth goes directly to the site URL
    // OAuth auth routes through the Cloud API gateway
    if (this.auth.type === 'api_token') {
      return `${this.siteUrl}${path}`;
    }

    // OAuth: use Cloud API gateway
    if (path.startsWith('/rest/api/') || path.startsWith('/rest/agile/')) {
      return `${ATLASSIAN_API_BASE}/ex/jira/${this.cloudId}${path}`;
    }

    if (path.startsWith('/wiki/')) {
      return `${ATLASSIAN_API_BASE}/ex/confluence/${this.cloudId}${path}`;
    }

    // Default: append to site URL
    return `${this.siteUrl}${path}`;
  }

  /**
   * Build request headers with authentication
   */
  protected async buildHeaders(additionalHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };

    // Add authentication header
    if (this.auth.type === 'oauth') {
      let accessToken = this.auth.tokens.accessToken;

      // Refresh token if OAuth manager is available and token is expiring
      if (this.oauthManager) {
        try {
          accessToken = await this.oauthManager.getAccessToken();
        } catch (error) {
          this.logger.warn('Failed to refresh OAuth token, using cached token', { error });
        }
      }

      headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
      headers['Authorization'] = createApiTokenAuth(this.auth.credentials);
    }

    return headers;
  }

  /**
   * Create axios HTTP client
   */
  protected createHttpClient(): AxiosInstance {
    return axios.create({
      timeout: 30000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx
    });
  }

  /**
   * Clean undefined values from params
   */
  protected cleanParams(params?: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean> | undefined {
    if (!params) {
      return undefined;
    }

    const cleaned: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  /**
   * Extract rate limit headers from response
   */
  protected extractRateLimitHeaders(response: AxiosResponse): Record<string, string> {
    const headers: Record<string, string> = {};
    const rateLimitHeaders = [
      'x-ratelimit-remaining',
      'x-ratelimit-limit',
      'x-ratelimit-reset',
      'retry-after',
    ];

    for (const header of rateLimitHeaders) {
      const value = response.headers[header];
      if (value) {
        headers[header] = String(value);
      }
    }

    return headers;
  }

  /**
   * Wrap axios response in ApiResponse
   */
  protected wrapResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    // Handle error status codes
    if (response.status >= 400) {
      throw this.transformError({
        response,
        isAxiosError: true,
        message: `Request failed with status ${response.status}`,
      } as AxiosError);
    }

    const rateLimitInfo: RateLimitInfo | undefined = this.extractRateLimitInfo(response);

    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
      rateLimitInfo,
    };
  }

  /**
   * Extract rate limit info from response
   */
  protected extractRateLimitInfo(response: AxiosResponse): RateLimitInfo | undefined {
    const remaining = response.headers['x-ratelimit-remaining'];
    const limit = response.headers['x-ratelimit-limit'];
    const reset = response.headers['x-ratelimit-reset'];

    if (remaining && limit) {
      return {
        remaining: parseInt(String(remaining), 10),
        limit: parseInt(String(limit), 10),
        resetAt: reset ? parseInt(String(reset), 10) * 1000 : Date.now() + 3600000,
      };
    }

    return undefined;
  }

  /**
   * Check if request should be retried
   */
  protected shouldRetry(error: AxiosError, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }

    // Don't retry API errors (4xx) — these are wrapped by wrapResponse
    if (error instanceof AtlassianApiError) {
      return false;
    }

    // Network errors should be retried
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Handle rate limit
    if (status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        this.rateLimiter.handleRateLimitResponse(parseInt(String(retryAfter), 10));
      }
      return true;
    }

    return this.retryConfig.retryableStatuses.includes(status);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  protected calculateRetryDelay(error: AxiosError, attempt: number): number {
    // Check for Retry-After header
    if (error.response?.headers['retry-after']) {
      const retryAfter = parseInt(String(error.response.headers['retry-after']), 10);
      return retryAfter * 1000;
    }

    // Exponential backoff with jitter
    const baseDelay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attempt);
    const jitter = Math.random() * 0.3 * baseDelay; // 0-30% jitter
    const delay = Math.min(baseDelay + jitter, this.retryConfig.maxDelay);

    return Math.floor(delay);
  }

  /**
   * Transform axios error to typed API error
   */
  protected transformError(error: AxiosError): AtlassianApiError {
    if (!error.response) {
      return new AtlassianApiError(
        `Network error: ${error.message}`,
        0,
        'NETWORK_ERROR',
        { originalError: error.message }
      );
    }

    const status = error.response.status;
    const data = error.response.data as Record<string, unknown> | undefined;
    const message = this.extractErrorMessage(data) || error.message;

    switch (status) {
      case 400:
        return new ValidationError(message, this.extractValidationErrors(data));

      case 401:
        return new AuthenticationError(message, data);

      case 403:
        return new AuthorizationError(message, data);

      case 404:
        return new NotFoundError('Resource', message);

      case 429: {
        const retryAfter = parseInt(String(error.response.headers['retry-after']) || '60', 10);
        return new RateLimitError(message, retryAfter);
      }

      default:
        return new AtlassianApiError(message, status, data?.errorCode as string, data);
    }
  }

  /**
   * Extract error message from response data
   */
  protected extractErrorMessage(data: Record<string, unknown> | undefined): string {
    if (!data) {
      return 'Unknown error';
    }

    // Try common error message fields
    if (typeof data.message === 'string') {
      return data.message;
    }

    if (typeof data.errorMessage === 'string') {
      return data.errorMessage;
    }

    if (Array.isArray(data.errorMessages) && data.errorMessages.length > 0) {
      return data.errorMessages.join('; ');
    }

    if (typeof data.errors === 'object' && data.errors !== null) {
      const errors = data.errors as Record<string, string>;
      return Object.values(errors).join('; ');
    }

    return 'Unknown error';
  }

  /**
   * Extract validation errors from response data
   */
  protected extractValidationErrors(data: Record<string, unknown> | undefined): { field: string; message: string; code: string }[] {
    const issues: { field: string; message: string; code: string }[] = [];

    if (!data) {
      return issues;
    }

    if (typeof data.errors === 'object' && data.errors !== null) {
      const errors = data.errors as Record<string, string | string[]>;
      for (const [field, message] of Object.entries(errors)) {
        const msg = Array.isArray(message) ? message.join('; ') : message;
        issues.push({ field, message: msg, code: 'VALIDATION_ERROR' });
      }
    }

    return issues;
  }

  /**
   * Sleep helper
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Atlassian client from environment variables
 */
export function createClientFromEnv(): AtlassianClient {
  const cloudId = process.env.ATLASSIAN_CLOUD_ID;
  const siteUrl = process.env.ATLASSIAN_SITE_URL;

  if (!cloudId || !siteUrl) {
    throw new Error('ATLASSIAN_CLOUD_ID and ATLASSIAN_SITE_URL are required');
  }

  // Determine auth method
  const accessToken = process.env.ATLASSIAN_ACCESS_TOKEN;
  const refreshToken = process.env.ATLASSIAN_REFRESH_TOKEN;
  const apiToken = process.env.ATLASSIAN_API_TOKEN;
  const email = process.env.ATLASSIAN_USER_EMAIL;

  let auth: AuthMethod;

  if (accessToken && refreshToken) {
    auth = {
      type: 'oauth',
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: parseInt(process.env.ATLASSIAN_TOKEN_EXPIRY || '0', 10) || Date.now() + 3600000,
        scope: process.env.ATLASSIAN_TOKEN_SCOPE || '',
      },
    };
  } else if (apiToken && email) {
    auth = {
      type: 'api_token',
      credentials: { email, apiToken },
    };
  } else {
    throw new Error('Either OAuth tokens or API token credentials are required');
  }

  return new AtlassianClient({
    cloudId,
    siteUrl,
    auth,
    debug: process.env.LOG_LEVEL === 'debug',
  });
}
