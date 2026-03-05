/**
 * Points-based Rate Limiter for Atlassian APIs
 * Implements Atlassian's rate limiting model with 65k points/hour
 */

import { RateLimitConfig, RateLimitState, EndpointCost, RateLimitError } from './types.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// ============================================================================
// Constants
// ============================================================================

/** Default rate limit configuration */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  pointsPerHour: 65000,
  requestsPerSecond: 10,
  allowBurst: true,
  burstSize: 20,
};

/** One hour in milliseconds */
const HOUR_MS = 60 * 60 * 1000;

/** One second in milliseconds */
const SECOND_MS = 1000;

// ============================================================================
// Endpoint Cost Registry
// ============================================================================

/**
 * Known endpoint costs for Atlassian APIs
 * Based on Atlassian's documented rate limits
 */
export const ENDPOINT_COSTS: Record<string, EndpointCost> = {
  // Jira Issue endpoints
  'GET /rest/api/3/issue': { baseCost: 1, perResultCost: 0, maxResults: 1 },
  'POST /rest/api/3/issue': { baseCost: 10, perResultCost: 0, maxResults: 1 },
  'PUT /rest/api/3/issue': { baseCost: 5, perResultCost: 0, maxResults: 1 },
  'DELETE /rest/api/3/issue': { baseCost: 10, perResultCost: 0, maxResults: 1 },

  // Jira Search
  'GET /rest/api/3/search': { baseCost: 5, perResultCost: 1, maxResults: 100 },
  'POST /rest/api/3/search': { baseCost: 5, perResultCost: 1, maxResults: 100 },

  // Jira Project endpoints
  'GET /rest/api/3/project': { baseCost: 1, perResultCost: 0, maxResults: 1 },
  'GET /rest/api/3/project/search': { baseCost: 3, perResultCost: 1, maxResults: 50 },

  // Jira Sprint endpoints (Agile API)
  'GET /rest/agile/1.0/sprint': { baseCost: 1, perResultCost: 0, maxResults: 1 },
  'GET /rest/agile/1.0/board': { baseCost: 1, perResultCost: 0, maxResults: 1 },
  'GET /rest/agile/1.0/board/sprint': { baseCost: 3, perResultCost: 1, maxResults: 50 },
  'GET /rest/agile/1.0/sprint/issue': { baseCost: 5, perResultCost: 1, maxResults: 100 },

  // Jira Transitions
  'GET /rest/api/3/issue/transitions': { baseCost: 1, perResultCost: 0, maxResults: 50 },
  'POST /rest/api/3/issue/transitions': { baseCost: 5, perResultCost: 0, maxResults: 1 },

  // Jira Comments
  'GET /rest/api/3/issue/comment': { baseCost: 1, perResultCost: 1, maxResults: 100 },
  'POST /rest/api/3/issue/comment': { baseCost: 5, perResultCost: 0, maxResults: 1 },

  // Confluence endpoints
  'GET /wiki/api/v2/pages': { baseCost: 3, perResultCost: 1, maxResults: 100 },
  'POST /wiki/api/v2/pages': { baseCost: 10, perResultCost: 0, maxResults: 1 },
  'PUT /wiki/api/v2/pages': { baseCost: 5, perResultCost: 0, maxResults: 1 },
  'GET /wiki/api/v2/spaces': { baseCost: 3, perResultCost: 1, maxResults: 100 },

  // Default for unknown endpoints
  'DEFAULT': { baseCost: 5, perResultCost: 0, maxResults: 1 },
};

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

/**
 * Points-based rate limiter for Atlassian APIs
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;
  private logger: Logger;

  constructor(config: Partial<RateLimitConfig> = {}, logger?: Logger) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.state = {
      pointsConsumed: 0,
      windowStart: Date.now(),
      recentRequests: [],
      inBackoff: false,
      backoffUntil: 0,
    };
    this.logger = logger || createLoggerFromEnv('rate-limiter');
  }

  /**
   * Get the cost for an endpoint
   */
  getEndpointCost(method: string, path: string, resultCount: number = 1): number {
    // Try exact match first
    const key = `${method} ${path}`;
    let cost = ENDPOINT_COSTS[key];

    // Try pattern matching for parameterized endpoints
    if (!cost) {
      // Normalize path by removing IDs
      const normalizedPath = path
        .replace(/\/\d+/g, '')
        .replace(/\/[A-Z]+-\d+/g, '')
        .replace(/\/[a-f0-9-]{36}/g, '');

      const normalizedKey = `${method} ${normalizedPath}`;
      cost = ENDPOINT_COSTS[normalizedKey];
    }

    // Use default if no match found
    if (!cost) {
      cost = ENDPOINT_COSTS['DEFAULT'];
      this.logger.debug('Using default cost for unknown endpoint', { method, path });
    }

    return cost.baseCost + cost.perResultCost * Math.min(resultCount, cost.maxResults);
  }

  /**
   * Check if a request can be made without exceeding limits
   */
  canMakeRequest(cost: number = 1): boolean {
    this.cleanupState();

    // Check if in backoff
    if (this.state.inBackoff && Date.now() < this.state.backoffUntil) {
      return false;
    }

    // Check hourly points limit
    if (this.state.pointsConsumed + cost > this.config.pointsPerHour) {
      return false;
    }

    // Check per-second limit
    const oneSecondAgo = Date.now() - SECOND_MS;
    const recentCount = this.state.recentRequests.filter(t => t > oneSecondAgo).length;

    if (recentCount >= this.config.requestsPerSecond) {
      // Allow burst if enabled
      if (this.config.allowBurst && recentCount < this.config.burstSize) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Wait until a request can be made
   * Returns the wait time in milliseconds (0 if no wait needed)
   */
  async waitForCapacity(cost: number = 1): Promise<number> {
    const startTime = Date.now();

    while (!this.canMakeRequest(cost)) {
      const waitTime = this.calculateWaitTime(cost);

      if (waitTime > 60000) {
        // If wait time exceeds 1 minute, throw rate limit error
        throw new RateLimitError(
          `Rate limit would require waiting ${Math.ceil(waitTime / 1000)} seconds`,
          waitTime
        );
      }

      this.logger.debug('Waiting for rate limit capacity', { waitTime, cost });
      await this.sleep(waitTime);
    }

    return Date.now() - startTime;
  }

  /**
   * Record that a request was made
   */
  recordRequest(cost: number): void {
    this.cleanupState();
    this.state.pointsConsumed += cost;
    this.state.recentRequests.push(Date.now());

    this.logger.debug('Recorded request', {
      cost,
      totalPoints: this.state.pointsConsumed,
      remainingPoints: this.config.pointsPerHour - this.state.pointsConsumed,
    });
  }

  /**
   * Handle rate limit response from API
   */
  handleRateLimitResponse(retryAfter: number): void {
    this.state.inBackoff = true;
    this.state.backoffUntil = Date.now() + retryAfter * 1000;

    this.logger.warn('Rate limit hit, entering backoff', {
      retryAfter,
      backoffUntil: new Date(this.state.backoffUntil).toISOString(),
    });
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.cleanupState();

    const oneSecondAgo = Date.now() - SECOND_MS;
    const recentCount = this.state.recentRequests.filter(t => t > oneSecondAgo).length;

    return {
      pointsConsumed: this.state.pointsConsumed,
      pointsRemaining: this.config.pointsPerHour - this.state.pointsConsumed,
      pointsLimit: this.config.pointsPerHour,
      windowResetAt: this.state.windowStart + HOUR_MS,
      requestsInLastSecond: recentCount,
      requestsPerSecondLimit: this.config.requestsPerSecond,
      inBackoff: this.state.inBackoff && Date.now() < this.state.backoffUntil,
      backoffUntil: this.state.backoffUntil,
    };
  }

  /**
   * Reset rate limit state (use with caution)
   */
  reset(): void {
    this.state = {
      pointsConsumed: 0,
      windowStart: Date.now(),
      recentRequests: [],
      inBackoff: false,
      backoffUntil: 0,
    };

    this.logger.info('Rate limiter state reset');
  }

  /**
   * Update state from API response headers
   */
  updateFromHeaders(headers: Record<string, string>): void {
    // Atlassian rate limit headers
    const remaining = headers['x-ratelimit-remaining'];
    const limit = headers['x-ratelimit-limit'];
    const reset = headers['x-ratelimit-reset'];
    const retryAfter = headers['retry-after'];

    if (retryAfter) {
      this.handleRateLimitResponse(parseInt(retryAfter, 10));
    }

    if (remaining && limit) {
      const serverRemaining = parseInt(remaining, 10);
      const serverLimit = parseInt(limit, 10);

      // Sync our tracking with server state if server shows less remaining
      const serverConsumed = serverLimit - serverRemaining;
      if (serverConsumed > this.state.pointsConsumed) {
        this.logger.debug('Syncing rate limit state with server', {
          localConsumed: this.state.pointsConsumed,
          serverConsumed,
        });
        this.state.pointsConsumed = serverConsumed;
      }
    }

    if (reset) {
      const resetTime = parseInt(reset, 10) * 1000;
      if (resetTime > this.state.windowStart + HOUR_MS) {
        this.state.windowStart = resetTime - HOUR_MS;
      }
    }
  }

  /**
   * Clean up expired state
   */
  private cleanupState(): void {
    const now = Date.now();

    // Reset hourly window if expired
    if (now - this.state.windowStart >= HOUR_MS) {
      this.state.pointsConsumed = 0;
      this.state.windowStart = now;
    }

    // Clear old request timestamps (keep only last 2 seconds)
    const cutoff = now - 2 * SECOND_MS;
    this.state.recentRequests = this.state.recentRequests.filter(t => t > cutoff);

    // Clear backoff if expired
    if (this.state.inBackoff && now >= this.state.backoffUntil) {
      this.state.inBackoff = false;
      this.state.backoffUntil = 0;
    }
  }

  /**
   * Calculate wait time until capacity is available
   */
  private calculateWaitTime(cost: number): number {
    // If in backoff, wait until backoff ends
    if (this.state.inBackoff && Date.now() < this.state.backoffUntil) {
      return this.state.backoffUntil - Date.now();
    }

    // If hourly limit exceeded, wait until window resets
    if (this.state.pointsConsumed + cost > this.config.pointsPerHour) {
      return this.state.windowStart + HOUR_MS - Date.now();
    }

    // If per-second limit exceeded, wait for requests to clear
    const oneSecondAgo = Date.now() - SECOND_MS;
    const recentRequests = this.state.recentRequests.filter(t => t > oneSecondAgo);

    if (recentRequests.length >= this.config.requestsPerSecond) {
      // Wait until the oldest recent request expires
      const oldestRecent = Math.min(...recentRequests);
      return oldestRecent + SECOND_MS - Date.now() + 10; // Add 10ms buffer
    }

    return 0;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limit status for monitoring
 */
export interface RateLimitStatus {
  pointsConsumed: number;
  pointsRemaining: number;
  pointsLimit: number;
  windowResetAt: number;
  requestsInLastSecond: number;
  requestsPerSecondLimit: number;
  inBackoff: boolean;
  backoffUntil: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create rate limiter from environment variables
 */
export function createRateLimiterFromEnv(): RateLimiter {
  const pointsPerHour = parseInt(process.env.RATE_LIMIT_POINTS_PER_HOUR || '65000', 10);
  const requestsPerSecond = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_SECOND || '10', 10);

  return new RateLimiter({
    pointsPerHour,
    requestsPerSecond,
  });
}
