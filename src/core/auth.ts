/**
 * OAuth 2.0 (3LO) Authentication Manager for Atlassian APIs
 * Handles token lifecycle, refresh, and secure storage
 */

import axios, { AxiosError } from 'axios';
import {
  AuthConfig,
  OAuthTokenResponse,
  StoredTokens,
  TokenStorage,
  ApiTokenAuth,
  AuthMethod,
  AuthenticationError,
} from './types.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// ============================================================================
// Constants
// ============================================================================

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com';
const ATLASSIAN_API_URL = 'https://api.atlassian.com';

/** Buffer time before token expiry to trigger refresh (5 minutes) */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Default OAuth scopes for Jira operations */
export const DEFAULT_JIRA_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'offline_access',
];

/** Default OAuth scopes for Confluence operations */
export const DEFAULT_CONFLUENCE_SCOPES = [
  'read:confluence-content.all',
  'write:confluence-content',
  'read:confluence-space.summary',
  'offline_access',
];

// ============================================================================
// Environment Token Storage
// ============================================================================

/**
 * Simple token storage using environment variables
 * For production, implement a secure storage backend
 */
export class EnvironmentTokenStorage implements TokenStorage {
  async getTokens(): Promise<StoredTokens | null> {
    const accessToken = process.env.ATLASSIAN_ACCESS_TOKEN;
    const refreshToken = process.env.ATLASSIAN_REFRESH_TOKEN;
    const expiresAt = process.env.ATLASSIAN_TOKEN_EXPIRY;

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt ? parseInt(expiresAt, 10) : Date.now() + 3600000,
      scope: process.env.ATLASSIAN_TOKEN_SCOPE || '',
    };
  }

  async saveTokens(tokens: StoredTokens): Promise<void> {
    // In a real implementation, this would persist to a secure store
    // Environment variables are read-only at runtime, so this is a no-op
    // The calling code should handle persistence appropriately
    console.log('Token save requested. Implement secure storage for production.');
    console.log(`Access Token: ${tokens.accessToken.substring(0, 10)}...`);
    console.log(`Refresh Token: ${tokens.refreshToken.substring(0, 10)}...`);
    console.log(`Expires At: ${new Date(tokens.expiresAt).toISOString()}`);
  }

  async clearTokens(): Promise<void> {
    // No-op for environment storage
    console.log('Token clear requested.');
  }
}

// ============================================================================
// OAuth Manager
// ============================================================================

/**
 * OAuth 2.0 (3LO) manager for Atlassian authentication
 */
export class AtlassianOAuthManager {
  private config: AuthConfig;
  private storage: TokenStorage;
  private logger: Logger;
  private cachedTokens: StoredTokens | null = null;
  private refreshPromise: Promise<StoredTokens> | null = null;

  constructor(
    config: AuthConfig,
    storage: TokenStorage = new EnvironmentTokenStorage(),
    logger?: Logger
  ) {
    this.config = config;
    this.storage = storage;
    this.logger = logger || createLoggerFromEnv('oauth');
  }

  /**
   * Generate the OAuth authorization URL
   * User should be redirected to this URL to initiate the OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `${ATLASSIAN_AUTH_URL}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<StoredTokens> {
    this.logger.info('Exchanging authorization code for tokens');

    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${ATLASSIAN_AUTH_URL}/oauth/token`,
        {
          grant_type: 'authorization_code',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const tokens = this.convertTokenResponse(response.data);
      await this.storage.saveTokens(tokens);
      this.cachedTokens = tokens;

      this.logger.info('Successfully obtained tokens', {
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      });

      return tokens;
    } catch (error) {
      this.handleAuthError(error, 'Failed to exchange authorization code');
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Try cached tokens first
    if (!this.cachedTokens) {
      this.cachedTokens = await this.storage.getTokens();
    }

    if (!this.cachedTokens) {
      throw new AuthenticationError(
        'No tokens available. Please complete the OAuth flow first.'
      );
    }

    // Check if token needs refresh
    if (this.isTokenExpiringSoon(this.cachedTokens)) {
      this.logger.debug('Token expiring soon, refreshing');
      this.cachedTokens = await this.refreshTokens();
    }

    return this.cachedTokens.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshTokens(): Promise<StoredTokens> {
    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshTokens();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method to perform token refresh
   */
  private async doRefreshTokens(): Promise<StoredTokens> {
    const currentTokens = this.cachedTokens || await this.storage.getTokens();

    if (!currentTokens?.refreshToken) {
      throw new AuthenticationError(
        'No refresh token available. Please re-authenticate.'
      );
    }

    this.logger.info('Refreshing access token');

    try {
      const response = await axios.post<OAuthTokenResponse>(
        `${ATLASSIAN_AUTH_URL}/oauth/token`,
        {
          grant_type: 'refresh_token',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: currentTokens.refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Note: Atlassian uses rotating refresh tokens
      // The response includes a new refresh token that must be stored
      const tokens = this.convertTokenResponse(response.data);
      await this.storage.saveTokens(tokens);
      this.cachedTokens = tokens;

      this.logger.info('Successfully refreshed tokens', {
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      });

      return tokens;
    } catch (error) {
      // Clear cached tokens on refresh failure
      this.cachedTokens = null;
      await this.storage.clearTokens();

      this.handleAuthError(error, 'Failed to refresh token');
    }
  }

  /**
   * Get accessible cloud resources (sites) for the authenticated user
   */
  async getAccessibleResources(): Promise<CloudResource[]> {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.get<CloudResource[]>(
        `${ATLASSIAN_API_URL}/oauth/token/accessible-resources`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      this.handleAuthError(error, 'Failed to get accessible resources');
    }
  }

  /**
   * Revoke the current tokens
   */
  async revokeTokens(): Promise<void> {
    const currentTokens = this.cachedTokens || await this.storage.getTokens();

    if (!currentTokens) {
      return;
    }

    this.logger.info('Revoking tokens');

    try {
      // Revoke access token
      await axios.post(
        `${ATLASSIAN_AUTH_URL}/oauth/revoke`,
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          token: currentTokens.accessToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Clear stored tokens
      await this.storage.clearTokens();
      this.cachedTokens = null;

      this.logger.info('Successfully revoked tokens');
    } catch (error) {
      this.logger.warn('Failed to revoke tokens', { error });
      // Still clear local tokens even if revocation fails
      await this.storage.clearTokens();
      this.cachedTokens = null;
    }
  }

  /**
   * Check if token is expiring soon
   */
  private isTokenExpiringSoon(tokens: StoredTokens): boolean {
    return tokens.expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS;
  }

  /**
   * Convert OAuth response to stored token format
   */
  private convertTokenResponse(response: OAuthTokenResponse): StoredTokens {
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      scope: response.scope,
    };
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; error_description?: string }>;
      const errorData = axiosError.response?.data;

      throw new AuthenticationError(
        `${context}: ${errorData?.error_description || errorData?.error || axiosError.message}`,
        {
          status: axiosError.response?.status,
          error: errorData?.error,
        }
      );
    }

    throw new AuthenticationError(
      `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { originalError: error }
    );
  }
}

// ============================================================================
// API Token Authentication
// ============================================================================

/**
 * Create Basic auth header for API token authentication
 */
export function createApiTokenAuth(credentials: ApiTokenAuth): string {
  const encoded = Buffer.from(`${credentials.email}:${credentials.apiToken}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Validate API token credentials
 */
export async function validateApiToken(
  credentials: ApiTokenAuth,
  siteUrl: string
): Promise<boolean> {
  try {
    const response = await axios.get(`${siteUrl}/rest/api/3/myself`, {
      headers: {
        Authorization: createApiTokenAuth(credentials),
        Accept: 'application/json',
      },
    });

    return response.status === 200;
  } catch {
    return false;
  }
}

// ============================================================================
// Auth Factory
// ============================================================================

/**
 * Create authentication method from environment variables
 */
export function createAuthFromEnv(): AuthMethod {
  // Try OAuth first
  const accessToken = process.env.ATLASSIAN_ACCESS_TOKEN;
  const refreshToken = process.env.ATLASSIAN_REFRESH_TOKEN;

  if (accessToken && refreshToken) {
    return {
      type: 'oauth',
      tokens: {
        accessToken,
        refreshToken,
        expiresAt: parseInt(process.env.ATLASSIAN_TOKEN_EXPIRY || '0', 10) || Date.now() + 3600000,
        scope: process.env.ATLASSIAN_TOKEN_SCOPE || '',
      },
    };
  }

  // Fall back to API token
  const apiToken = process.env.ATLASSIAN_API_TOKEN;
  const email = process.env.ATLASSIAN_USER_EMAIL;

  if (apiToken && email) {
    return {
      type: 'api_token',
      credentials: { email, apiToken },
    };
  }

  throw new AuthenticationError(
    'No authentication credentials found. Set either OAuth tokens or API token in environment variables.'
  );
}

/**
 * Create OAuth manager from environment variables
 */
export function createOAuthManagerFromEnv(): AtlassianOAuthManager {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new AuthenticationError(
      'OAuth configuration incomplete. Set ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, and ATLASSIAN_REDIRECT_URI.'
    );
  }

  return new AtlassianOAuthManager({
    clientId,
    clientSecret,
    redirectUri,
    scopes: [...DEFAULT_JIRA_SCOPES, ...DEFAULT_CONFLUENCE_SCOPES],
  });
}

// ============================================================================
// Types Re-export
// ============================================================================

interface CloudResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
  avatarUrl?: string;
}
