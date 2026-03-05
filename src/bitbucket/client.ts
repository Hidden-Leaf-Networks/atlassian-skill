/**
 * Bitbucket Cloud API Client
 *
 * A robust HTTP client for interacting with the Bitbucket Cloud REST API v2.0.
 * Supports OAuth 2.0 and App Password authentication methods.
 *
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/intro/
 */

import {
  BitbucketClientConfig,
  BitbucketAuthConfig,
  BitbucketError,
  PaginatedResponse,
  PaginationOptions,
} from './types';

/**
 * HTTP methods supported by the client
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Request options for API calls
 */
interface RequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  /** Request body (will be JSON stringified unless it's a string) */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Response type (default: json) */
  responseType?: 'json' | 'text' | 'blob';
}

/**
 * Default configuration values
 */
const DEFAULT_BASE_URL = 'https://api.bitbucket.org/2.0';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_USER_AGENT = 'AtlassianSkill-BitbucketClient/1.0';

/**
 * Bitbucket API Client
 *
 * Provides methods for making authenticated requests to the Bitbucket Cloud API.
 * Handles authentication, retries, error handling, and pagination.
 *
 * @example
 * ```typescript
 * const client = new BitbucketClient({
 *   auth: {
 *     accessToken: 'your-oauth-token'
 *   }
 * });
 *
 * // Make a request
 * const repo = await client.get('/repositories/workspace/repo-slug');
 * ```
 */
export class BitbucketClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly userAgent: string;
  private auth: BitbucketAuthConfig;

  /**
   * Creates a new BitbucketClient instance
   *
   * @param config - Client configuration including authentication
   * @throws Error if no authentication method is provided
   */
  constructor(config: BitbucketClientConfig) {
    this.validateAuth(config.auth);
    this.auth = { ...config.auth };
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.userAgent = config.userAgent || DEFAULT_USER_AGENT;
  }

  /**
   * Validates that at least one authentication method is configured
   */
  private validateAuth(auth: BitbucketAuthConfig): void {
    const hasOAuth = !!auth.accessToken;
    const hasAppPassword = !!(auth.appPassword && auth.username);

    if (!hasOAuth && !hasAppPassword) {
      throw new Error(
        'BitbucketClient requires either an OAuth access token or username/app password combination'
      );
    }
  }

  /**
   * Gets the authorization header value based on configured auth method
   */
  private getAuthHeader(): string {
    if (this.auth.accessToken) {
      return `Bearer ${this.auth.accessToken}`;
    }

    if (this.auth.username && this.auth.appPassword) {
      const credentials = Buffer.from(
        `${this.auth.username}:${this.auth.appPassword}`
      ).toString('base64');
      return `Basic ${credentials}`;
    }

    throw new Error('No valid authentication method configured');
  }

  /**
   * Builds the full URL with query parameters
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    // Handle absolute URLs (e.g., pagination next links)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(status: number): boolean {
    // Retry on rate limiting and server errors
    return status === 429 || (status >= 500 && status < 600);
  }

  /**
   * Calculates exponential backoff delay
   */
  private getRetryDelay(attempt: number, retryAfter?: string): number {
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
    // Exponential backoff: 1s, 2s, 4s, etc.
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }

  /**
   * Sleeps for the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Makes an HTTP request to the Bitbucket API
   *
   * @param path - API endpoint path (relative to base URL)
   * @param options - Request options
   * @returns The response data
   * @throws BitbucketApiError on API errors
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      body,
      headers = {},
      params,
      responseType = 'json',
    } = options;

    const url = this.buildUrl(path, params);

    const requestHeaders: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      'User-Agent': this.userAgent,
      Accept: 'application/json',
      ...headers,
    };

    if (body && typeof body !== 'string') {
      requestHeaders['Content-Type'] = 'application/json';
    }

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      body: body
        ? typeof body === 'string'
          ? body
          : JSON.stringify(body)
        : undefined,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting and retryable errors
        if (this.isRetryableError(response.status) && attempt < this.maxRetries) {
          const retryAfter = response.headers.get('Retry-After') || undefined;
          const delay = this.getRetryDelay(attempt, retryAfter);
          await this.sleep(delay);
          continue;
        }

        // Handle error responses
        if (!response.ok) {
          const errorBody = await response.text();
          let errorData: BitbucketError;

          try {
            errorData = JSON.parse(errorBody);
          } catch {
            errorData = {
              type: 'error',
              error: {
                message: errorBody || `HTTP ${response.status}: ${response.statusText}`,
              },
            };
          }

          throw new BitbucketApiError(
            errorData.error.message,
            response.status,
            errorData
          );
        }

        // Parse response based on type
        if (responseType === 'text') {
          return (await response.text()) as T;
        }

        if (responseType === 'blob') {
          return (await response.blob()) as T;
        }

        // Handle empty responses
        const contentLength = response.headers.get('Content-Length');
        if (contentLength === '0' || response.status === 204) {
          return {} as T;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort errors or client errors
        if (
          error instanceof BitbucketApiError ||
          (error as Error).name === 'AbortError'
        ) {
          throw error;
        }

        // Retry network errors
        if (attempt < this.maxRetries) {
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Makes a GET request
   *
   * @param path - API endpoint path
   * @param params - Query parameters
   * @returns The response data
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'GET', params });
  }

  /**
   * Makes a POST request
   *
   * @param path - API endpoint path
   * @param body - Request body
   * @param params - Query parameters
   * @returns The response data
   */
  async post<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, params });
  }

  /**
   * Makes a PUT request
   *
   * @param path - API endpoint path
   * @param body - Request body
   * @param params - Query parameters
   * @returns The response data
   */
  async put<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body, params });
  }

  /**
   * Makes a PATCH request
   *
   * @param path - API endpoint path
   * @param body - Request body
   * @param params - Query parameters
   * @returns The response data
   */
  async patch<T>(
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body, params });
  }

  /**
   * Makes a DELETE request
   *
   * @param path - API endpoint path
   * @param params - Query parameters
   * @returns The response data
   */
  async delete<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', params });
  }

  /**
   * Gets raw diff content as text
   *
   * @param path - API endpoint path for diff
   * @returns The raw diff text
   */
  async getDiff(path: string): Promise<string> {
    return this.request<string>(path, {
      method: 'GET',
      responseType: 'text',
      headers: {
        Accept: 'text/plain',
      },
    });
  }

  /**
   * Fetches all pages of a paginated endpoint
   *
   * @param path - API endpoint path
   * @param options - Pagination options
   * @returns All items from all pages
   */
  async getAllPages<T>(
    path: string,
    options: PaginationOptions = {}
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextUrl: string | undefined = path;
    const params: Record<string, string | number | boolean | undefined> = {
      pagelen: options.pagelen || 100,
      ...options,
    };

    // First request includes params
    let isFirstRequest = true;

    while (nextUrl) {
      const response = await this.get<PaginatedResponse<T>>(
        nextUrl,
        isFirstRequest ? params : undefined
      );

      allItems.push(...response.values);
      nextUrl = response.next;
      isFirstRequest = false;

      // Safety check to prevent infinite loops
      if (allItems.length > 10000) {
        console.warn('Pagination limit reached (10000 items)');
        break;
      }
    }

    return allItems;
  }

  /**
   * Fetches a single page of results
   *
   * @param path - API endpoint path
   * @param options - Pagination options
   * @returns Paginated response
   */
  async getPage<T>(
    path: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<T>> {
    const params: Record<string, string | number | boolean | undefined> = {
      pagelen: options.pagelen || 50,
      page: options.page,
      sort: options.sort,
      q: options.q,
    };

    return this.get<PaginatedResponse<T>>(path, params);
  }

  /**
   * Updates the access token (useful for token refresh)
   *
   * @param accessToken - New access token
   */
  setAccessToken(accessToken: string): void {
    this.auth.accessToken = accessToken;
  }

  /**
   * Refreshes the OAuth 2.0 access token using the refresh token
   *
   * @returns The new access token
   * @throws Error if refresh token or client credentials are not configured
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.auth.refreshToken) {
      throw new Error('Refresh token is not configured');
    }

    if (!this.auth.clientId || !this.auth.clientSecret) {
      throw new Error('Client ID and secret are required for token refresh');
    }

    const tokenUrl = 'https://bitbucket.org/site/oauth2/access_token';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${this.auth.clientId}:${this.auth.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.auth.refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    this.auth.accessToken = data.access_token;

    if (data.refresh_token) {
      this.auth.refreshToken = data.refresh_token;
    }

    return data.access_token;
  }
}

/**
 * Custom error class for Bitbucket API errors
 */
export class BitbucketApiError extends Error {
  public readonly status: number;
  public readonly data: BitbucketError;

  constructor(message: string, status: number, data: BitbucketError) {
    super(message);
    this.name = 'BitbucketApiError';
    this.status = status;
    this.data = data;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BitbucketApiError);
    }
  }

  /**
   * Returns a detailed error message including status and details
   */
  get detailedMessage(): string {
    let msg = `[${this.status}] ${this.message}`;
    if (this.data.error.detail) {
      msg += `: ${this.data.error.detail}`;
    }
    return msg;
  }
}

/**
 * Factory function to create a configured BitbucketClient instance
 *
 * @param config - Client configuration
 * @returns Configured BitbucketClient instance
 *
 * @example
 * ```typescript
 * const client = createBitbucketClient({
 *   auth: {
 *     accessToken: process.env.BITBUCKET_ACCESS_TOKEN
 *   }
 * });
 * ```
 */
export function createBitbucketClient(
  config: BitbucketClientConfig
): BitbucketClient {
  return new BitbucketClient(config);
}
