/**
 * @fileoverview Confluence API v2 client implementation.
 * Uses shared Atlassian OAuth authentication with Jira.
 * @module confluence/client
 */

import type {
  Space,
  Page,
  PageVersion,
  SearchResult,
  PaginatedResponse,
  ListSpacesOptions,
  GetPageOptions,
  CreatePageOptions,
  UpdatePageOptions,
  SearchPagesOptions,
  ADFDocument,
  BodyRepresentationType,
} from './types.js';

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * API token authentication credentials.
 */
export interface ConfluenceApiTokenAuth {
  /** User email address */
  email: string;
  /** API token */
  apiToken: string;
}

/**
 * Configuration options for the Confluence client.
 */
export interface ConfluenceClientConfig {
  /** Atlassian Cloud ID */
  cloudId: string;
  /** OAuth access token (mutually exclusive with apiToken) */
  accessToken?: string;
  /** API token auth credentials (mutually exclusive with accessToken) */
  apiToken?: ConfluenceApiTokenAuth;
  /** Site URL — required for API token auth (e.g., https://your-domain.atlassian.net) */
  siteUrl?: string;
  /** Optional refresh token for token renewal */
  refreshToken?: string;
  /** Base URL override (for testing) */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Callback for token refresh */
  onTokenRefresh?: (newToken: string) => void;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  baseUrl: 'https://api.atlassian.com',
} as const;

// ============================================================================
// Confluence Client
// ============================================================================

/**
 * Client for interacting with Confluence Cloud API v2.
 * Shares authentication with Jira (same Atlassian OAuth flow).
 *
 * @example
 * ```typescript
 * const client = new ConfluenceClient({
 *   cloudId: 'your-cloud-id',
 *   accessToken: 'oauth-access-token',
 * });
 *
 * const spaces = await client.listSpaces();
 * const page = await client.getPage('page-id');
 * ```
 */
export class ConfluenceClient {
  private readonly cloudId: string;
  private accessToken: string | undefined;
  private readonly apiTokenAuth: ConfluenceApiTokenAuth | undefined;
  private readonly siteUrl: string | undefined;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly onTokenRefresh?: (newToken: string) => void;

  /**
   * Creates a new Confluence client instance.
   * Supports both OAuth (accessToken) and API token (email + apiToken) auth.
   * @param config - Client configuration options
   */
  constructor(config: ConfluenceClientConfig) {
    if (!config.cloudId) {
      throw new Error('cloudId is required');
    }
    if (!config.accessToken && !config.apiToken) {
      throw new Error('Either accessToken or apiToken credentials are required');
    }
    if (config.apiToken && !config.siteUrl) {
      throw new Error('siteUrl is required when using API token auth');
    }

    this.cloudId = config.cloudId;
    this.accessToken = config.accessToken;
    this.apiTokenAuth = config.apiToken;
    this.siteUrl = config.siteUrl;
    this.baseUrl = config.baseUrl ?? DEFAULT_CONFIG.baseUrl;
    this.timeout = config.timeout ?? DEFAULT_CONFIG.timeout;
    this.maxRetries = config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
    this.onTokenRefresh = config.onTokenRefresh;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Whether this client is using API token auth.
   */
  private get isApiTokenAuth(): boolean {
    return !!this.apiTokenAuth;
  }

  /**
   * Constructs the full API URL for a given endpoint.
   * API token auth routes directly to siteUrl; OAuth routes through api.atlassian.com.
   * @param endpoint - API endpoint path
   * @returns Full URL
   */
  private getApiUrl(endpoint: string): string {
    if (this.isApiTokenAuth) {
      // API token: route directly to site
      return `${this.siteUrl}/wiki/api/v2${endpoint}`;
    }
    // OAuth: route through Cloud API gateway
    const basePath = `/ex/confluence/${this.cloudId}/wiki/api/v2`;
    return `${this.baseUrl}${basePath}${endpoint}`;
  }

  /**
   * Builds request headers with authentication.
   * @returns Headers object
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiTokenAuth) {
      // API token: Basic auth with email:token
      const credentials = Buffer.from(
        `${this.apiTokenAuth.email}:${this.apiTokenAuth.apiToken}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Makes an HTTP request to the Confluence API with retry logic.
   * @param method - HTTP method
   * @param endpoint - API endpoint
   * @param body - Optional request body
   * @param queryParams - Optional query parameters
   * @returns Response data
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(this.getApiUrl(endpoint));

    // Add query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url.toString(), {
          method,
          headers: this.getHeaders(),
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
          await this.sleep(waitTime);
          continue;
        }

        // Handle auth errors
        if (response.status === 401) {
          throw new Error('Authentication failed. Token may be expired.');
        }

        // Handle other errors
        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage: string;
          try {
            const parsed = JSON.parse(errorBody);
            // Confluence API v2 uses { errors: [{ title, detail, code }] }
            if (parsed.errors?.length) {
              errorMessage = parsed.errors.map((e: { title?: string; detail?: string; code?: string }) =>
                e.title || e.detail || e.code || 'Unknown error'
              ).join('; ');
            } else {
              errorMessage = parsed.message || parsed.error || errorBody;
            }
          } catch {
            errorMessage = errorBody || response.statusText;
          }
          throw new Error(`Confluence API error: ${errorMessage} (${response.status})`);
        }

        // Handle empty responses
        if (response.status === 204) {
          return undefined as T;
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on auth errors or client errors
        if (
          lastError.message.includes('Authentication failed') ||
          lastError.message.includes('(4')
        ) {
          throw lastError;
        }

        // Wait before retrying
        if (attempt < this.maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Sleep for a specified duration.
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Serializes page body content to the appropriate format.
   * @param body - ADF document or string content
   * @param representation - Body format representation
   * @returns Serialized body object
   */
  private serializeBody(
    body: ADFDocument | string,
    representation: BodyRepresentationType = 'storage'
  ): { representation: string; value: string } {
    if (typeof body === 'string') {
      return { representation, value: body };
    }
    // ADF document - serialize to JSON string for atlas_doc_format
    return {
      representation: 'atlas_doc_format',
      value: JSON.stringify(body),
    };
  }

  // ==========================================================================
  // Space Operations
  // ==========================================================================

  /**
   * Lists all accessible spaces.
   * @param options - List options
   * @returns Paginated list of spaces
   *
   * @example
   * ```typescript
   * const spaces = await client.listSpaces({ type: 'global', limit: 25 });
   * ```
   */
  async listSpaces(options?: ListSpacesOptions): Promise<PaginatedResponse<Space>> {
    return this.request<PaginatedResponse<Space>>('GET', '/spaces', undefined, {
      type: options?.type,
      status: options?.status,
      cursor: options?.cursor,
      limit: options?.limit,
      sort: options?.sort,
    });
  }

  /**
   * Gets a specific space by ID.
   * @param spaceId - Space ID
   * @returns Space details
   *
   * @example
   * ```typescript
   * const space = await client.getSpace('123456');
   * ```
   */
  async getSpace(spaceId: string): Promise<Space> {
    return this.request<Space>('GET', `/spaces/${spaceId}`);
  }

  /**
   * Gets a space by its key.
   * @param spaceKey - Space key (e.g., "ENG")
   * @returns Space details or null if not found
   *
   * @example
   * ```typescript
   * const space = await client.getSpaceByKey('ENG');
   * ```
   */
  async getSpaceByKey(spaceKey: string): Promise<Space | null> {
    const result = await this.request<PaginatedResponse<Space>>(
      'GET',
      '/spaces',
      undefined,
      { keys: spaceKey, limit: 1 }
    );
    return result.results[0] ?? null;
  }

  // ==========================================================================
  // Page Operations
  // ==========================================================================

  /**
   * Creates a new page in Confluence.
   * @param options - Page creation options
   * @returns Created page
   *
   * @example
   * ```typescript
   * const page = await client.createPage({
   *   spaceId: 'space-id',
   *   title: 'My Page',
   *   body: '<p>Hello World</p>',
   * });
   * ```
   */
  async createPage(options: CreatePageOptions): Promise<Page> {
    const body = this.serializeBody(options.body, options.representation);

    const payload = {
      spaceId: options.spaceId,
      status: options.status ?? 'current',
      title: options.title,
      parentId: options.parentId,
      body: {
        representation: body.representation,
        value: body.value,
      },
    };

    return this.request<Page>('POST', '/pages', payload);
  }

  /**
   * Gets a page by ID.
   * @param pageId - Page ID
   * @param options - Get options
   * @returns Page details
   *
   * @example
   * ```typescript
   * const page = await client.getPage('page-id', { bodyFormat: 'storage' });
   * ```
   */
  async getPage(pageId: string, options?: GetPageOptions): Promise<Page> {
    return this.request<Page>('GET', `/pages/${pageId}`, undefined, {
      'body-format': options?.bodyFormat,
      'get-draft': false,
    });
  }

  /**
   * Updates an existing page.
   * @param options - Update options
   * @returns Updated page
   *
   * @example
   * ```typescript
   * const page = await client.updatePage({
   *   id: 'page-id',
   *   title: 'Updated Title',
   *   body: '<p>New content</p>',
   *   version: 2,
   * });
   * ```
   */
  async updatePage(options: UpdatePageOptions): Promise<Page> {
    // Confluence API v2 requires title in update payload.
    // If not provided, fetch the current title.
    let title = options.title;
    if (!title) {
      const current = await this.getPage(options.id);
      title = current.title;
    }

    const payload: Record<string, unknown> = {
      id: options.id,
      status: 'current',
      title,
      version: {
        number: options.version + 1,
        message: options.versionMessage,
      },
    };

    if (options.body) {
      const body = this.serializeBody(options.body, options.representation);
      payload.body = {
        representation: body.representation,
        value: body.value,
      };
    }

    return this.request<Page>('PUT', `/pages/${options.id}`, payload);
  }

  /**
   * Deletes a page.
   * @param pageId - Page ID to delete
   *
   * @example
   * ```typescript
   * await client.deletePage('page-id');
   * ```
   */
  async deletePage(pageId: string): Promise<void> {
    await this.request<void>('DELETE', `/pages/${pageId}`);
  }

  /**
   * Gets child pages of a page.
   * @param pageId - Parent page ID
   * @param options - Pagination options
   * @returns Paginated list of child pages
   *
   * @example
   * ```typescript
   * const children = await client.getPageChildren('parent-page-id');
   * ```
   */
  async getPageChildren(
    pageId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<PaginatedResponse<Page>> {
    return this.request<PaginatedResponse<Page>>(
      'GET',
      `/pages/${pageId}/children`,
      undefined,
      {
        cursor: options?.cursor,
        limit: options?.limit,
      }
    );
  }

  /**
   * Gets pages in a space.
   * @param spaceId - Space ID
   * @param options - Pagination options
   * @returns Paginated list of pages
   *
   * @example
   * ```typescript
   * const pages = await client.getSpacePages('space-id');
   * ```
   */
  async getSpacePages(
    spaceId: string,
    options?: { cursor?: string; limit?: number; depth?: 'root' | 'all' }
  ): Promise<PaginatedResponse<Page>> {
    return this.request<PaginatedResponse<Page>>(
      'GET',
      `/spaces/${spaceId}/pages`,
      undefined,
      {
        cursor: options?.cursor,
        limit: options?.limit,
        depth: options?.depth,
      }
    );
  }

  /**
   * Gets the version history of a page.
   * @param pageId - Page ID
   * @param options - Pagination options
   * @returns Paginated list of versions
   */
  async getPageVersions(
    pageId: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<PaginatedResponse<PageVersion>> {
    return this.request<PaginatedResponse<PageVersion>>(
      'GET',
      `/pages/${pageId}/versions`,
      undefined,
      {
        cursor: options?.cursor,
        limit: options?.limit,
      }
    );
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Searches for pages using Confluence Query Language (CQL).
   * @param options - Search options
   * @returns Search results
   *
   * @example
   * ```typescript
   * const results = await client.searchPages({
   *   cql: 'space = ENG AND text ~ "API"',
   *   limit: 25,
   * });
   * ```
   */
  async searchPages(options: SearchPagesOptions): Promise<SearchResult> {
    return this.request<SearchResult>('GET', '/pages', undefined, {
      'body-format': options.bodyFormat,
      cursor: options.cursor,
      limit: options.limit,
      // Note: CQL search in API v2 uses different endpoint
      // This is a simplified implementation
    });
  }

  /**
   * Searches using CQL via the search endpoint.
   * @param cql - CQL query string
   * @param options - Search options
   * @returns Search results
   */
  async searchByCQL(
    cql: string,
    options?: { cursor?: string; limit?: number }
  ): Promise<SearchResult> {
    // CQL search uses REST API v1 content/search endpoint
    const searchPath = this.isApiTokenAuth
      ? `${this.siteUrl}/wiki/rest/api/content/search`
      : `${this.baseUrl}/ex/confluence/${this.cloudId}/wiki/rest/api/content/search`;

    const response = await fetch(`${searchPath}?cql=${encodeURIComponent(cql)}&limit=${options?.limit ?? 25}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return {
      results: (data.results as SearchResult['results']) ?? [],
      _links: data._links as SearchResult['_links'],
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Tests the connection to Confluence.
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.listSpaces({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Updates the access token (after refresh).
   * @param newToken - New access token
   */
  updateAccessToken(newToken: string): void {
    this.accessToken = newToken;
    this.onTokenRefresh?.(newToken);
  }

  /**
   * Gets the current cloud ID.
   * @returns Cloud ID
   */
  getCloudId(): string {
    return this.cloudId;
  }
}

/**
 * Creates a Confluence client from environment variables.
 * Supports both OAuth (ATLASSIAN_ACCESS_TOKEN) and API token (ATLASSIAN_API_TOKEN + ATLASSIAN_USER_EMAIL) auth.
 * @returns Configured Confluence client
 */
export function createConfluenceClientFromEnv(): ConfluenceClient {
  const cloudId = process.env.ATLASSIAN_CLOUD_ID;

  if (!cloudId) {
    throw new Error('Missing required environment variable: ATLASSIAN_CLOUD_ID');
  }

  // Prefer OAuth if access token is available
  const accessToken = process.env.ATLASSIAN_ACCESS_TOKEN;
  if (accessToken) {
    return new ConfluenceClient({
      cloudId,
      accessToken,
      refreshToken: process.env.ATLASSIAN_REFRESH_TOKEN,
    });
  }

  // Fall back to API token auth
  const apiToken = process.env.ATLASSIAN_API_TOKEN;
  const email = process.env.ATLASSIAN_USER_EMAIL;
  const siteUrl = process.env.ATLASSIAN_SITE_URL;

  if (apiToken && email && siteUrl) {
    return new ConfluenceClient({
      cloudId,
      apiToken: { email, apiToken },
      siteUrl,
    });
  }

  throw new Error(
    'Missing required environment variables: either ATLASSIAN_ACCESS_TOKEN (OAuth) or ATLASSIAN_API_TOKEN + ATLASSIAN_USER_EMAIL + ATLASSIAN_SITE_URL (API token)'
  );
}
