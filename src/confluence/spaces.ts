/**
 * @fileoverview Confluence space operations module.
 * Provides high-level space management functions.
 * @module confluence/spaces
 */

import { ConfluenceClient } from './client.js';
import type {
  Space,
  Page,
  SpaceType,
  SpaceStatus,
} from './types.js';

// ============================================================================
// Space Service
// ============================================================================

/**
 * Options for listing spaces.
 */
export interface ListSpacesParams {
  /** Filter by space type */
  type?: SpaceType;
  /** Filter by status */
  status?: SpaceStatus;
  /** Maximum number of spaces to return */
  limit?: number;
  /** Sort order */
  sort?: 'id' | '-id' | 'key' | '-key' | 'name' | '-name';
  /** Fetch all spaces (handles pagination) */
  fetchAll?: boolean;
}

/**
 * Options for getting space pages.
 */
export interface GetSpacePagesParams {
  /** Depth of pages to retrieve */
  depth?: 'root' | 'all';
  /** Maximum number of pages per request */
  limit?: number;
  /** Fetch all pages (handles pagination) */
  fetchAll?: boolean;
}

/**
 * Service for Confluence space operations.
 *
 * @example
 * ```typescript
 * const spaceService = new SpaceService(client);
 *
 * // List all global spaces
 * const spaces = await spaceService.listSpaces({ type: 'global' });
 *
 * // Get all pages in a space
 * const pages = await spaceService.getSpacePages('space-id');
 * ```
 */
export class SpaceService {
  private readonly client: ConfluenceClient;

  /**
   * Creates a new SpaceService instance.
   * @param client - Confluence client instance
   */
  constructor(client: ConfluenceClient) {
    this.client = client;
  }

  // ==========================================================================
  // Space Operations
  // ==========================================================================

  /**
   * Lists accessible spaces.
   * @param params - List parameters
   * @returns Array of spaces
   *
   * @example
   * ```typescript
   * // List all global spaces
   * const globalSpaces = await spaceService.listSpaces({
   *   type: 'global',
   *   status: 'current',
   * });
   *
   * // Fetch all spaces with pagination
   * const allSpaces = await spaceService.listSpaces({ fetchAll: true });
   * ```
   */
  async listSpaces(params?: ListSpacesParams): Promise<Space[]> {
    const limit = params?.limit ?? 25;
    const fetchAll = params?.fetchAll ?? false;

    if (!fetchAll) {
      const result = await this.client.listSpaces({
        type: params?.type,
        status: params?.status,
        limit,
        sort: params?.sort,
      });
      return result.results;
    }

    // Fetch all spaces using cursor pagination
    const allSpaces: Space[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.listSpaces({
        type: params?.type,
        status: params?.status,
        cursor,
        limit,
        sort: params?.sort,
      });
      allSpaces.push(...result.results);
      cursor = this.extractCursor(result._links?.next);
    } while (cursor);

    return allSpaces;
  }

  /**
   * Gets a space by its ID.
   * @param spaceId - Space ID
   * @returns Space details
   *
   * @example
   * ```typescript
   * const space = await spaceService.getSpace('123456');
   * console.log(`Space: ${space.name} (${space.key})`);
   * ```
   */
  async getSpace(spaceId: string): Promise<Space> {
    return this.client.getSpace(spaceId);
  }

  /**
   * Gets a space by its key.
   * @param spaceKey - Space key (e.g., "ENG", "DOCS")
   * @returns Space details or null if not found
   *
   * @example
   * ```typescript
   * const space = await spaceService.getSpaceByKey('ENG');
   * if (space) {
   *   console.log(`Found space: ${space.name}`);
   * }
   * ```
   */
  async getSpaceByKey(spaceKey: string): Promise<Space | null> {
    return this.client.getSpaceByKey(spaceKey);
  }

  // ==========================================================================
  // Space Pages Operations
  // ==========================================================================

  /**
   * Gets pages in a space.
   * @param spaceId - Space ID
   * @param params - Get pages parameters
   * @returns Array of pages
   *
   * @example
   * ```typescript
   * // Get root pages only
   * const rootPages = await spaceService.getSpacePages('space-id', {
   *   depth: 'root',
   * });
   *
   * // Get all pages in the space
   * const allPages = await spaceService.getSpacePages('space-id', {
   *   depth: 'all',
   *   fetchAll: true,
   * });
   * ```
   */
  async getSpacePages(
    spaceId: string,
    params?: GetSpacePagesParams
  ): Promise<Page[]> {
    const limit = params?.limit ?? 25;
    const fetchAll = params?.fetchAll ?? false;
    const depth = params?.depth ?? 'root';

    if (!fetchAll) {
      const result = await this.client.getSpacePages(spaceId, { limit, depth });
      return result.results;
    }

    // Fetch all pages using cursor pagination
    const allPages: Page[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.getSpacePages(spaceId, {
        cursor,
        limit,
        depth,
      });
      allPages.push(...result.results);
      cursor = this.extractCursor(result._links?.next);
    } while (cursor);

    return allPages;
  }

  /**
   * Gets the homepage of a space.
   * @param spaceId - Space ID
   * @returns Homepage page or null if not set
   *
   * @example
   * ```typescript
   * const homepage = await spaceService.getSpaceHomepage('space-id');
   * if (homepage) {
   *   console.log(`Homepage: ${homepage.title}`);
   * }
   * ```
   */
  async getSpaceHomepage(spaceId: string): Promise<Page | null> {
    const space = await this.getSpace(spaceId);
    if (!space.homepageId) {
      return null;
    }
    return this.client.getPage(space.homepageId);
  }

  /**
   * Gets the page tree structure of a space.
   * Returns root pages with their children.
   * @param spaceId - Space ID
   * @param maxDepth - Maximum depth to traverse
   * @returns Array of page tree nodes
   */
  async getSpacePageTree(
    spaceId: string,
    maxDepth: number = 3
  ): Promise<SpacePageTreeNode[]> {
    const rootPages = await this.getSpacePages(spaceId, { depth: 'root', fetchAll: true });
    const tree: SpacePageTreeNode[] = [];

    for (const page of rootPages) {
      const node = await this.buildPageTreeNode(page, maxDepth, 0);
      tree.push(node);
    }

    return tree;
  }

  /**
   * Recursively builds a page tree node.
   */
  private async buildPageTreeNode(
    page: Page,
    maxDepth: number,
    currentDepth: number
  ): Promise<SpacePageTreeNode> {
    const node: SpacePageTreeNode = {
      page,
      children: [],
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    const children = await this.client.getPageChildren(page.id, { limit: 100 });

    for (const child of children.results) {
      const childNode = await this.buildPageTreeNode(child, maxDepth, currentDepth + 1);
      node.children.push(childNode);
    }

    return node;
  }

  // ==========================================================================
  // Space Statistics
  // ==========================================================================

  /**
   * Gets statistics about a space.
   * @param spaceId - Space ID
   * @returns Space statistics
   *
   * @example
   * ```typescript
   * const stats = await spaceService.getSpaceStats('space-id');
   * console.log(`Total pages: ${stats.totalPages}`);
   * ```
   */
  async getSpaceStats(spaceId: string): Promise<SpaceStats> {
    const pages = await this.getSpacePages(spaceId, { depth: 'all', fetchAll: true });

    const rootPages = pages.filter((p) => !p.parentId);
    const draftPages = pages.filter((p) => p.status === 'draft');
    const archivedPages = pages.filter((p) => p.status === 'archived');

    // Calculate depth statistics
    const depthCounts: Record<number, number> = {};
    for (const page of pages) {
      const depth = await this.calculatePageDepth(page, pages);
      depthCounts[depth] = (depthCounts[depth] ?? 0) + 1;
    }

    const maxDepth = Math.max(...Object.keys(depthCounts).map(Number), 0);

    return {
      totalPages: pages.length,
      rootPages: rootPages.length,
      draftPages: draftPages.length,
      archivedPages: archivedPages.length,
      maxDepth,
      depthDistribution: depthCounts,
    };
  }

  /**
   * Calculates the depth of a page in the tree.
   */
  private async calculatePageDepth(
    page: Page,
    allPages: Page[]
  ): Promise<number> {
    let depth = 0;
    let currentPage = page;

    while (currentPage.parentId) {
      depth++;
      const parent = allPages.find((p) => p.id === currentPage.parentId);
      if (!parent) break;
      currentPage = parent;
    }

    return depth;
  }

  // ==========================================================================
  // Space Search
  // ==========================================================================

  /**
   * Searches for spaces by name.
   * @param query - Search query
   * @param options - Search options
   * @returns Array of matching spaces
   *
   * @example
   * ```typescript
   * const spaces = await spaceService.searchSpaces('Engineering');
   * ```
   */
  async searchSpaces(
    query: string,
    options?: { type?: SpaceType; status?: SpaceStatus }
  ): Promise<Space[]> {
    const allSpaces = await this.listSpaces({
      type: options?.type,
      status: options?.status,
      fetchAll: true,
    });

    const lowerQuery = query.toLowerCase();
    return allSpaces.filter(
      (space) =>
        space.name.toLowerCase().includes(lowerQuery) ||
        space.key.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Finds spaces that the user has access to.
   * @param options - Filter options
   * @returns Array of accessible spaces with their roles
   */
  async getAccessibleSpaces(options?: {
    type?: SpaceType;
    status?: SpaceStatus;
  }): Promise<SpaceWithAccess[]> {
    const spaces = await this.listSpaces({
      type: options?.type,
      status: options?.status,
      fetchAll: true,
    });

    // Note: Actual access level would require additional API calls
    // This is a simplified implementation
    return spaces.map((space) => ({
      space,
      accessLevel: 'view' as const, // Would be determined by actual permissions
    }));
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Checks if a space exists.
   * @param spaceId - Space ID to check
   * @returns True if space exists
   */
  async spaceExists(spaceId: string): Promise<boolean> {
    try {
      await this.getSpace(spaceId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if a space exists by key.
   * @param spaceKey - Space key to check
   * @returns True if space exists
   */
  async spaceExistsByKey(spaceKey: string): Promise<boolean> {
    const space = await this.getSpaceByKey(spaceKey);
    return space !== null;
  }

  /**
   * Gets space ID from space key.
   * @param spaceKey - Space key
   * @returns Space ID or null if not found
   */
  async getSpaceId(spaceKey: string): Promise<string | null> {
    const space = await this.getSpaceByKey(spaceKey);
    return space?.id ?? null;
  }

  /**
   * Extracts cursor from a next link URL.
   */
  private extractCursor(nextLink?: string): string | undefined {
    if (!nextLink) return undefined;

    try {
      const url = new URL(nextLink, 'https://placeholder.com');
      return url.searchParams.get('cursor') ?? undefined;
    } catch {
      return undefined;
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Page tree node within a space.
 */
export interface SpacePageTreeNode {
  /** The page at this node */
  page: Page;
  /** Child page nodes */
  children: SpacePageTreeNode[];
}

/**
 * Space statistics.
 */
export interface SpaceStats {
  /** Total number of pages */
  totalPages: number;
  /** Number of root-level pages */
  rootPages: number;
  /** Number of draft pages */
  draftPages: number;
  /** Number of archived pages */
  archivedPages: number;
  /** Maximum page tree depth */
  maxDepth: number;
  /** Distribution of pages by depth */
  depthDistribution: Record<number, number>;
}

/**
 * Space with access level information.
 */
export interface SpaceWithAccess {
  /** Space details */
  space: Space;
  /** User's access level */
  accessLevel: 'view' | 'edit' | 'admin';
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a SpaceService from a Confluence client.
 * @param client - Confluence client
 * @returns SpaceService instance
 */
export function createSpaceService(client: ConfluenceClient): SpaceService {
  return new SpaceService(client);
}
