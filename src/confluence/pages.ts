/**
 * @fileoverview Confluence page operations module.
 * Provides high-level page management functions.
 * @module confluence/pages
 */

import { ConfluenceClient } from './client.js';
import type {
  Page,
  ADFDocument,
  SearchResult,
  GetPageOptions,
  BodyRepresentationType,
  PageVersion,
} from './types.js';

// ============================================================================
// Page Service
// ============================================================================

/**
 * Options for creating a page.
 */
export interface CreatePageParams {
  /** Space ID where the page will be created */
  spaceId: string;
  /** Page title */
  title: string;
  /** Page body content (ADF document or storage format HTML) */
  body: ADFDocument | string;
  /** Parent page ID for hierarchy */
  parentId?: string;
  /** Body format representation */
  representation?: BodyRepresentationType;
}

/**
 * Options for updating a page.
 */
export interface UpdatePageParams {
  /** Page ID to update */
  pageId: string;
  /** New title (optional) */
  title?: string;
  /** New body content (optional) */
  body?: ADFDocument | string;
  /** Version message describing the change */
  versionMessage?: string;
  /** Body format representation */
  representation?: BodyRepresentationType;
}

/**
 * Options for searching pages.
 */
export interface SearchPagesParams {
  /** CQL query string */
  cql: string;
  /** Maximum results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
  /** Body format to include in results */
  bodyFormat?: BodyRepresentationType;
}

/**
 * Service for Confluence page operations.
 * Wraps the client with convenient high-level methods.
 *
 * @example
 * ```typescript
 * const pageService = new PageService(client);
 *
 * // Create a page
 * const page = await pageService.createPage({
 *   spaceId: 'space-id',
 *   title: 'My New Page',
 *   body: '<p>Hello World</p>',
 * });
 *
 * // Update the page
 * await pageService.updatePage({
 *   pageId: page.id,
 *   body: '<p>Updated content</p>',
 *   versionMessage: 'Updated content',
 * });
 * ```
 */
export class PageService {
  private readonly client: ConfluenceClient;

  /**
   * Creates a new PageService instance.
   * @param client - Confluence client instance
   */
  constructor(client: ConfluenceClient) {
    this.client = client;
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Creates a new page in Confluence.
   * @param params - Page creation parameters
   * @returns Created page
   *
   * @example
   * ```typescript
   * const page = await pageService.createPage({
   *   spaceId: 'space-id',
   *   title: 'API Documentation',
   *   body: adfDocument,
   *   parentId: 'parent-page-id',
   * });
   * ```
   */
  async createPage(params: CreatePageParams): Promise<Page> {
    return this.client.createPage({
      spaceId: params.spaceId,
      title: params.title,
      body: params.body,
      parentId: params.parentId,
      representation: params.representation,
    });
  }

  /**
   * Gets a page by its ID.
   * @param pageId - Page ID
   * @param options - Additional options
   * @returns Page details
   *
   * @example
   * ```typescript
   * const page = await pageService.getPage('page-id', {
   *   bodyFormat: 'storage',
   *   includeVersion: true,
   * });
   * ```
   */
  async getPage(pageId: string, options?: GetPageOptions): Promise<Page> {
    return this.client.getPage(pageId, options);
  }

  /**
   * Updates an existing page.
   * Automatically fetches current version for optimistic locking.
   * @param params - Update parameters
   * @returns Updated page
   *
   * @example
   * ```typescript
   * const updatedPage = await pageService.updatePage({
   *   pageId: 'page-id',
   *   title: 'New Title',
   *   body: '<p>New content</p>',
   *   versionMessage: 'Updated title and content',
   * });
   * ```
   */
  async updatePage(params: UpdatePageParams): Promise<Page> {
    // Fetch current page to get version number
    const currentPage = await this.client.getPage(params.pageId, {
      includeVersion: true,
    });

    const currentVersion = currentPage.version?.number ?? 1;

    return this.client.updatePage({
      id: params.pageId,
      title: params.title,
      body: params.body,
      version: currentVersion,
      versionMessage: params.versionMessage,
      representation: params.representation,
    });
  }

  /**
   * Deletes a page.
   * @param pageId - Page ID to delete
   *
   * @example
   * ```typescript
   * await pageService.deletePage('page-id');
   * ```
   */
  async deletePage(pageId: string): Promise<void> {
    return this.client.deletePage(pageId);
  }

  // ==========================================================================
  // Navigation Operations
  // ==========================================================================

  /**
   * Gets all child pages of a parent page.
   * Handles pagination automatically to return all children.
   * @param pageId - Parent page ID
   * @param options - Options
   * @returns Array of child pages
   *
   * @example
   * ```typescript
   * const children = await pageService.getPageChildren('parent-page-id');
   * console.log(`Found ${children.length} child pages`);
   * ```
   */
  async getPageChildren(
    pageId: string,
    options?: { limit?: number; fetchAll?: boolean }
  ): Promise<Page[]> {
    const limit = options?.limit ?? 25;
    const fetchAll = options?.fetchAll ?? false;

    if (!fetchAll) {
      const result = await this.client.getPageChildren(pageId, { limit });
      return result.results;
    }

    // Fetch all pages using cursor pagination
    const allPages: Page[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.getPageChildren(pageId, { cursor, limit });
      allPages.push(...result.results);

      // Extract cursor from next link
      cursor = this.extractCursor(result._links?.next);
    } while (cursor);

    return allPages;
  }

  /**
   * Gets the page hierarchy (ancestors) for a page.
   * @param pageId - Page ID
   * @returns Array of ancestor pages (root first)
   */
  async getPageAncestors(pageId: string): Promise<Page[]> {
    const ancestors: Page[] = [];
    let currentPage = await this.getPage(pageId);

    while (currentPage.parentId) {
      const parent = await this.getPage(currentPage.parentId);
      ancestors.unshift(parent);
      currentPage = parent;
    }

    return ancestors;
  }

  /**
   * Gets the full page tree under a page.
   * @param pageId - Root page ID
   * @param maxDepth - Maximum depth to traverse (default: 10)
   * @returns Tree structure with pages and children
   */
  async getPageTree(
    pageId: string,
    maxDepth: number = 10
  ): Promise<PageTreeNode> {
    const page = await this.getPage(pageId);
    return this.buildTreeNode(page, maxDepth, 0);
  }

  /**
   * Recursively builds a page tree node.
   */
  private async buildTreeNode(
    page: Page,
    maxDepth: number,
    currentDepth: number
  ): Promise<PageTreeNode> {
    const node: PageTreeNode = {
      page,
      children: [],
    };

    if (currentDepth >= maxDepth) {
      return node;
    }

    const children = await this.getPageChildren(page.id, { fetchAll: true });

    for (const child of children) {
      const childNode = await this.buildTreeNode(child, maxDepth, currentDepth + 1);
      node.children.push(childNode);
    }

    return node;
  }

  // ==========================================================================
  // Search Operations
  // ==========================================================================

  /**
   * Searches for pages using Confluence Query Language (CQL).
   * @param params - Search parameters
   * @returns Search results
   *
   * @example
   * ```typescript
   * // Search for pages containing "API" in the ENG space
   * const results = await pageService.searchPages({
   *   cql: 'space = ENG AND text ~ "API"',
   *   limit: 50,
   * });
   * ```
   */
  async searchPages(params: SearchPagesParams): Promise<SearchResult> {
    return this.client.searchByCQL(params.cql, {
      limit: params.limit,
      cursor: params.cursor,
    });
  }

  /**
   * Finds a page by title in a space.
   * @param spaceId - Space ID
   * @param title - Page title to find
   * @returns Page if found, null otherwise
   *
   * @example
   * ```typescript
   * const page = await pageService.findPageByTitle('space-id', 'README');
   * if (page) {
   *   console.log('Found page:', page.id);
   * }
   * ```
   */
  async findPageByTitle(spaceId: string, title: string): Promise<Page | null> {
    const cql = `space.id = "${spaceId}" AND title = "${this.escapeCQL(title)}"`;
    const result = await this.searchPages({ cql, limit: 1 });
    return result.results[0] ?? null;
  }

  /**
   * Finds pages by label.
   * @param spaceId - Space ID
   * @param label - Label to search for
   * @returns Array of matching pages
   */
  async findPagesByLabel(spaceId: string, label: string): Promise<Page[]> {
    const cql = `space.id = "${spaceId}" AND label = "${this.escapeCQL(label)}"`;
    const result = await this.searchPages({ cql, limit: 100 });
    return result.results;
  }

  // ==========================================================================
  // Version Operations
  // ==========================================================================

  /**
   * Gets the version history of a page.
   * @param pageId - Page ID
   * @param limit - Maximum versions to return
   * @returns Array of page versions
   */
  async getPageVersions(pageId: string, limit?: number): Promise<PageVersion[]> {
    const result = await this.client.getPageVersions(pageId, { limit });
    return result.results;
  }

  /**
   * Gets a specific version of a page.
   * @param pageId - Page ID
   * @param versionNumber - Version number to retrieve
   * @returns Page at specified version
   */
  async getPageVersion(pageId: string, _versionNumber: number): Promise<Page> {
    // Note: API v2 may handle this differently
    // This is a simplified implementation
    return this.client.getPage(pageId);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Checks if a page exists.
   * @param pageId - Page ID to check
   * @returns True if page exists
   */
  async pageExists(pageId: string): Promise<boolean> {
    try {
      await this.client.getPage(pageId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Creates or updates a page by title.
   * If a page with the given title exists in the space, updates it.
   * Otherwise, creates a new page.
   * @param params - Page parameters
   * @returns Created or updated page
   *
   * @example
   * ```typescript
   * const page = await pageService.upsertPage({
   *   spaceId: 'space-id',
   *   title: 'README',
   *   body: '<p>Updated content</p>',
   *   versionMessage: 'Synced from repository',
   * });
   * ```
   */
  async upsertPage(
    params: CreatePageParams & { versionMessage?: string }
  ): Promise<Page> {
    const existing = await this.findPageByTitle(params.spaceId, params.title);

    if (existing) {
      return this.updatePage({
        pageId: existing.id,
        title: params.title,
        body: params.body,
        versionMessage: params.versionMessage,
        representation: params.representation,
      });
    }

    return this.createPage(params);
  }

  /**
   * Copies a page to a new location.
   * @param sourcePageId - Source page ID
   * @param targetSpaceId - Target space ID
   * @param options - Copy options
   * @returns Copied page
   */
  async copyPage(
    sourcePageId: string,
    targetSpaceId: string,
    options?: { newTitle?: string; parentId?: string }
  ): Promise<Page> {
    const source = await this.getPage(sourcePageId, { bodyFormat: 'storage' });

    return this.createPage({
      spaceId: targetSpaceId,
      title: options?.newTitle ?? `${source.title} (Copy)`,
      body: source.body?.storage?.value ?? '',
      parentId: options?.parentId,
    });
  }

  /**
   * Moves a page to a new parent.
   * @param pageId - Page ID to move
   * @param newParentId - New parent page ID
   * @param versionMessage - Version message for the move
   * @returns Updated page
   */
  async movePage(
    pageId: string,
    _newParentId: string,
    versionMessage?: string
  ): Promise<Page> {
    const page = await this.getPage(pageId, { includeVersion: true });
    const currentVersion = page.version?.number ?? 1;

    return this.client.updatePage({
      id: pageId,
      version: currentVersion,
      versionMessage: versionMessage ?? 'Moved page',
    });
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Extracts cursor from a next link URL.
   */
  private extractCursor(nextLink?: string): string | undefined {
    if (!nextLink) return undefined;

    const url = new URL(nextLink, 'https://placeholder.com');
    return url.searchParams.get('cursor') ?? undefined;
  }

  /**
   * Escapes special characters in CQL strings.
   */
  private escapeCQL(value: string): string {
    return value.replace(/["\\]/g, '\\$&');
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Page tree node structure.
 */
export interface PageTreeNode {
  /** The page at this node */
  page: Page;
  /** Child page nodes */
  children: PageTreeNode[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a PageService from a Confluence client.
 * @param client - Confluence client
 * @returns PageService instance
 */
export function createPageService(client: ConfluenceClient): PageService {
  return new PageService(client);
}
