/**
 * @fileoverview Type definitions for Confluence API v2 integration.
 * @module confluence/types
 */

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * Confluence space representation.
 */
export interface Space {
  /** Unique space identifier */
  id: string;
  /** Space key (e.g., "ENG", "DOCS") */
  key: string;
  /** Display name of the space */
  name: string;
  /** Space type */
  type: SpaceType;
  /** Current status of the space */
  status: SpaceStatus;
  /** URL to the space's homepage */
  homepageId?: string;
  /** Space description */
  description?: SpaceDescription;
  /** Space icon */
  icon?: SpaceIcon;
  /** Creation timestamp */
  createdAt?: string;
  /** Author account ID */
  authorId?: string;
  /** Links associated with the space */
  _links?: SpaceLinks;
}

/**
 * Space type enumeration.
 */
export type SpaceType = 'global' | 'personal' | 'collaboration';

/**
 * Space status enumeration.
 */
export type SpaceStatus = 'current' | 'archived';

/**
 * Space description structure.
 */
export interface SpaceDescription {
  /** Plain text description */
  plain?: {
    value: string;
    representation: 'plain';
  };
  /** View representation */
  view?: {
    value: string;
    representation: 'view';
  };
}

/**
 * Space icon structure.
 */
export interface SpaceIcon {
  /** Path to the icon */
  path: string;
  /** API links for the icon */
  apiDownloadLink?: string;
}

/**
 * Space-related links.
 */
export interface SpaceLinks {
  webui?: string;
  self?: string;
}

/**
 * Confluence page representation.
 */
export interface Page {
  /** Unique page identifier */
  id: string;
  /** Page status */
  status: PageStatus;
  /** Page title */
  title: string;
  /** Space ID the page belongs to */
  spaceId: string;
  /** Parent page ID (if applicable) */
  parentId?: string;
  /** Parent type */
  parentType?: ParentType;
  /** Page position among siblings */
  position?: number;
  /** Author account ID */
  authorId?: string;
  /** Owner account ID */
  ownerId?: string;
  /** Last owner account ID */
  lastOwnerId?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Page version information */
  version?: PageVersion;
  /** Page body content */
  body?: PageBody;
  /** Page labels */
  labels?: Label[];
  /** Links associated with the page */
  _links?: PageLinks;
}

/**
 * Page status enumeration.
 */
export type PageStatus = 'current' | 'archived' | 'deleted' | 'trashed' | 'draft';

/**
 * Parent type enumeration.
 */
export type ParentType = 'page' | 'whiteboard' | 'database' | 'folder';

/**
 * Page version information.
 */
export interface PageVersion {
  /** Version number */
  number: number;
  /** Version message */
  message?: string;
  /** Whether this is a minor edit */
  minorEdit?: boolean;
  /** Author of this version */
  authorId?: string;
  /** Creation timestamp of this version */
  createdAt?: string;
}

/**
 * Page body content container.
 */
export interface PageBody {
  /** Storage format (ADF) */
  storage?: PageBodyRepresentation;
  /** Atlas doc format */
  atlas_doc_format?: PageBodyRepresentation;
  /** View representation */
  view?: PageBodyRepresentation;
}

/**
 * Page body representation.
 */
export interface PageBodyRepresentation {
  /** Representation type */
  representation: BodyRepresentationType;
  /** Content value */
  value: string;
}

/**
 * Body representation type enumeration.
 */
export type BodyRepresentationType = 'storage' | 'atlas_doc_format' | 'view' | 'export_view' | 'styled_view' | 'editor';

/**
 * Page label structure.
 */
export interface Label {
  /** Label ID */
  id?: string;
  /** Label name */
  name: string;
  /** Label prefix */
  prefix?: string;
}

/**
 * Page-related links.
 */
export interface PageLinks {
  webui?: string;
  editui?: string;
  tinyui?: string;
  self?: string;
}

// ============================================================================
// Atlassian Document Format (ADF) Types
// ============================================================================

/**
 * Root ADF document structure.
 */
export interface ADFDocument {
  /** Document version (always 1) */
  version: 1;
  /** Document type */
  type: 'doc';
  /** Document content nodes */
  content: ADFNode[];
}

/**
 * Generic ADF node structure.
 */
export interface ADFNode {
  /** Node type */
  type: ADFNodeType;
  /** Node attributes */
  attrs?: Record<string, unknown>;
  /** Child content nodes */
  content?: ADFNode[];
  /** Text content (for text nodes) */
  text?: string;
  /** Text marks (formatting) */
  marks?: ADFMark[];
}

/**
 * ADF node type enumeration.
 */
export type ADFNodeType =
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
  | 'expand'
  | 'mediaGroup'
  | 'mediaSingle'
  | 'media'
  | 'mention'
  | 'emoji'
  | 'inlineCard'
  | 'blockCard'
  | 'taskList'
  | 'taskItem'
  | 'decisionList'
  | 'decisionItem'
  | 'status'
  | 'date'
  | 'extension'
  | 'inlineExtension'
  | 'bodiedExtension';

/**
 * ADF text mark (formatting).
 */
export interface ADFMark {
  /** Mark type */
  type: ADFMarkType;
  /** Mark attributes */
  attrs?: Record<string, unknown>;
}

/**
 * ADF mark type enumeration.
 */
export type ADFMarkType =
  | 'strong'
  | 'em'
  | 'strike'
  | 'underline'
  | 'code'
  | 'subsup'
  | 'textColor'
  | 'link'
  | 'annotation';

// ============================================================================
// Search Types
// ============================================================================

/**
 * Confluence Query Language (CQL) query structure.
 */
export interface CQLQuery {
  /** CQL query string */
  cql: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum results to return */
  limit?: number;
}

/**
 * Search result container.
 */
export interface SearchResult {
  /** Found pages */
  results: Page[];
  /** Links for pagination */
  _links?: PaginationLinks;
}

/**
 * Pagination links for cursor-based pagination.
 */
export interface PaginationLinks {
  /** Link to next page of results */
  next?: string;
  /** Base URL */
  base?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Options for creating a page.
 */
export interface CreatePageOptions {
  /** Space ID where the page will be created */
  spaceId: string;
  /** Page title */
  title: string;
  /** Page body (ADF document or storage format string) */
  body: ADFDocument | string;
  /** Parent page ID */
  parentId?: string;
  /** Page status */
  status?: PageStatus;
  /** Body format representation */
  representation?: BodyRepresentationType;
}

/**
 * Options for updating a page.
 */
export interface UpdatePageOptions {
  /** Page ID to update */
  id: string;
  /** New title (optional) */
  title?: string;
  /** New body content (optional) */
  body?: ADFDocument | string;
  /** Version message */
  versionMessage?: string;
  /** Current version number (required for updates) */
  version: number;
  /** Body format representation */
  representation?: BodyRepresentationType;
}

/**
 * Options for retrieving a page.
 */
export interface GetPageOptions {
  /** Fields to include in response */
  bodyFormat?: BodyRepresentationType;
  /** Whether to include version info */
  includeVersion?: boolean;
  /** Whether to include labels */
  includeLabels?: boolean;
}

/**
 * Options for searching pages.
 */
export interface SearchPagesOptions {
  /** CQL query string */
  cql: string;
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum results per page */
  limit?: number;
  /** Body format to include */
  bodyFormat?: BodyRepresentationType;
}

/**
 * Options for listing spaces.
 */
export interface ListSpacesOptions {
  /** Filter by space type */
  type?: SpaceType;
  /** Filter by space status */
  status?: SpaceStatus;
  /** Cursor for pagination */
  cursor?: string;
  /** Maximum results per page */
  limit?: number;
  /** Sort order */
  sort?: 'id' | '-id' | 'key' | '-key' | 'name' | '-name';
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  /** Results array */
  results: T[];
  /** Pagination links */
  _links?: PaginationLinks;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Options for syncing content to Confluence.
 */
export interface SyncOptions {
  /** Whether to create pages if they don't exist */
  createIfNotExists?: boolean;
  /** Whether to update existing pages */
  updateExisting?: boolean;
  /** Parent page ID for new pages */
  parentId?: string;
  /** Labels to apply to synced pages */
  labels?: string[];
  /** Whether to sync recursively */
  recursive?: boolean;
  /** File extensions to include */
  includeExtensions?: string[];
  /** Directories to exclude */
  excludeDirs?: string[];
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** Pages created during sync */
  created: PageSyncInfo[];
  /** Pages updated during sync */
  updated: PageSyncInfo[];
  /** Pages skipped (no changes) */
  skipped: PageSyncInfo[];
  /** Errors encountered */
  errors: SyncError[];
}

/**
 * Information about a synced page.
 */
export interface PageSyncInfo {
  /** Local file path */
  localPath: string;
  /** Confluence page ID */
  pageId: string;
  /** Page title */
  title: string;
  /** Web UI link */
  webUrl?: string;
}

/**
 * Error during sync operation.
 */
export interface SyncError {
  /** Local file path */
  localPath: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Confluence API error response.
 */
export interface ConfluenceError {
  /** Error code */
  code?: string;
  /** Error message */
  message: string;
  /** Status code */
  statusCode?: number;
  /** Additional error data */
  data?: Record<string, unknown>;
}

/**
 * Type guard to check if response is an error.
 */
export function isConfluenceError(obj: unknown): obj is ConfluenceError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'message' in obj &&
    typeof (obj as ConfluenceError).message === 'string'
  );
}
