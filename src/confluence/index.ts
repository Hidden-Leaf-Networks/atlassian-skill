/**
 * @fileoverview Confluence integration module exports.
 * @module confluence
 */

// Client
export {
  ConfluenceClient,
  ConfluenceClientConfig,
  createConfluenceClientFromEnv,
} from './client.js';

// Types
export type {
  // Core entities
  Space,
  SpaceType,
  SpaceStatus,
  SpaceDescription,
  SpaceIcon,
  SpaceLinks,
  Page,
  PageStatus,
  ParentType,
  PageVersion,
  PageBody,
  PageBodyRepresentation,
  BodyRepresentationType,
  Label,
  PageLinks,

  // ADF types
  ADFDocument,
  ADFNode,
  ADFNodeType,
  ADFMark,
  ADFMarkType,

  // Search types
  CQLQuery,
  SearchResult,
  PaginationLinks,

  // Request/Response types
  CreatePageOptions,
  UpdatePageOptions,
  GetPageOptions,
  SearchPagesOptions,
  ListSpacesOptions,
  PaginatedResponse,

  // Sync types
  SyncOptions,
  SyncResult,
  PageSyncInfo,
  SyncError,

  // Error types
  ConfluenceError,
} from './types.js';

export { isConfluenceError } from './types.js';

// Pages
export {
  PageService,
  CreatePageParams,
  UpdatePageParams,
  SearchPagesParams,
  PageTreeNode,
  createPageService,
} from './pages.js';

// Spaces
export {
  SpaceService,
  ListSpacesParams,
  GetSpacePagesParams,
  SpacePageTreeNode,
  SpaceStats,
  SpaceWithAccess,
  createSpaceService,
} from './spaces.js';

// Sync
export {
  MarkdownToADFConverter,
  DocumentationSyncService,
  createSyncService,
  createMarkdownConverter,
} from './sync.js';
