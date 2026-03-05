/**
 * Jira-specific types for the Atlassian Skill
 */

import { AdfDocument, PaginatedResponse, PaginationOptions } from '../core/types.js';

// ============================================================================
// User Types
// ============================================================================

/**
 * Jira user reference
 */
export interface JiraUser {
  accountId: string;
  accountType: 'atlassian' | 'app' | 'customer';
  displayName: string;
  emailAddress?: string;
  avatarUrls?: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  active: boolean;
  timeZone?: string;
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Jira project
 */
export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  projectTypeKey: 'software' | 'service_desk' | 'business';
  simplified: boolean;
  style: 'classic' | 'next-gen';
  avatarUrls?: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  url?: string;
}

/**
 * Project search result
 */
export interface JiraProjectSearchResult extends PaginatedResponse<JiraProject> {
  self: string;
}

// ============================================================================
// Issue Types
// ============================================================================

/**
 * Jira issue type
 */
export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
  hierarchyLevel?: number;
}

/**
 * Jira priority
 */
export interface JiraPriority {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusColor?: string;
}

/**
 * Jira status
 */
export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusCategory: {
    id: number;
    key: 'new' | 'indeterminate' | 'done';
    name: string;
    colorName: string;
  };
}

/**
 * Jira resolution
 */
export interface JiraResolution {
  id: string;
  name: string;
  description?: string;
}

/**
 * Jira component
 */
export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  assigneeType?: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
}

/**
 * Jira version (fix version / affects version)
 */
export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  released: boolean;
  releaseDate?: string;
  startDate?: string;
  projectId: number;
}

/**
 * Jira issue link type
 */
export interface JiraIssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

/**
 * Jira issue link
 */
export interface JiraIssueLink {
  id: string;
  type: JiraIssueLinkType;
  inwardIssue?: JiraIssueReference;
  outwardIssue?: JiraIssueReference;
}

/**
 * Minimal issue reference (for links)
 */
export interface JiraIssueReference {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority?: JiraPriority;
    issuetype: JiraIssueType;
  };
}

/**
 * Issue changelog entry
 */
export interface JiraChangelogEntry {
  id: string;
  author: JiraUser;
  created: string;
  items: {
    field: string;
    fieldtype: string;
    fieldId?: string;
    from: string | null;
    fromString: string | null;
    to: string | null;
    toString: string | null;
  }[];
}

/**
 * Jira comment
 */
export interface JiraComment {
  id: string;
  author: JiraUser;
  body: AdfDocument;
  created: string;
  updated: string;
  updateAuthor?: JiraUser;
  visibility?: {
    type: 'group' | 'role';
    value: string;
  };
}

/**
 * Jira worklog entry
 */
export interface JiraWorklog {
  id: string;
  author: JiraUser;
  comment?: AdfDocument;
  created: string;
  updated: string;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
}

/**
 * Jira attachment
 */
export interface JiraAttachment {
  id: string;
  filename: string;
  author: JiraUser;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
}

/**
 * Full Jira issue
 */
export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  expand?: string;
  fields: JiraIssueFields;
  changelog?: {
    startAt: number;
    maxResults: number;
    total: number;
    histories: JiraChangelogEntry[];
  };
  renderedFields?: Record<string, unknown>;
  names?: Record<string, string>;
  schema?: Record<string, unknown>;
  transitions?: JiraTransition[];
  editmeta?: {
    fields: Record<string, JiraFieldMeta>;
  };
}

/**
 * Jira issue fields
 */
export interface JiraIssueFields {
  summary: string;
  description?: AdfDocument | null;
  issuetype: JiraIssueType;
  project: JiraProject;
  status: JiraStatus;
  priority?: JiraPriority;
  resolution?: JiraResolution | null;
  assignee?: JiraUser | null;
  reporter?: JiraUser;
  creator?: JiraUser;
  labels: string[];
  components: JiraComponent[];
  fixVersions: JiraVersion[];
  versions: JiraVersion[];
  created: string;
  updated: string;
  resolutiondate?: string | null;
  duedate?: string | null;
  timetracking?: {
    originalEstimate?: string;
    remainingEstimate?: string;
    timeSpent?: string;
    originalEstimateSeconds?: number;
    remainingEstimateSeconds?: number;
    timeSpentSeconds?: number;
  };
  issuelinks?: JiraIssueLink[];
  subtasks?: JiraIssueReference[];
  parent?: JiraIssueReference;
  comment?: {
    comments: JiraComment[];
    maxResults: number;
    total: number;
    startAt: number;
  };
  worklog?: {
    worklogs: JiraWorklog[];
    maxResults: number;
    total: number;
    startAt: number;
  };
  attachment?: JiraAttachment[];
  // Custom fields are typed as unknown
  [key: `customfield_${string}`]: unknown;
}

/**
 * Field metadata for editing
 */
export interface JiraFieldMeta {
  required: boolean;
  schema: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    customId?: number;
  };
  name: string;
  key: string;
  autoCompleteUrl?: string;
  hasDefaultValue: boolean;
  operations: string[];
  allowedValues?: unknown[];
  defaultValue?: unknown;
}

// ============================================================================
// Transition Types
// ============================================================================

/**
 * Jira workflow transition
 */
export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
  hasScreen: boolean;
  isGlobal: boolean;
  isInitial: boolean;
  isConditional: boolean;
  fields?: Record<string, JiraFieldMeta>;
}

// ============================================================================
// Sprint/Agile Types
// ============================================================================

/**
 * Jira board
 */
export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  self: string;
  location?: {
    projectId: number;
    displayName: string;
    projectName: string;
    projectKey: string;
    projectTypeKey: string;
    avatarURI: string;
    name: string;
  };
}

/**
 * Jira sprint
 */
export interface JiraSprint {
  id: number;
  self: string;
  state: 'future' | 'active' | 'closed';
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId: number;
  goal?: string;
}

/**
 * Sprint issues response
 */
export interface JiraSprintIssuesResponse {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * JQL search options
 */
export interface JiraSearchOptions extends PaginationOptions {
  /** JQL query string */
  jql: string;
  /** Fields to return (use minimal set for efficiency) */
  fields?: string[];
  /** Expand additional data */
  expand?: ('changelog' | 'renderedFields' | 'names' | 'schema' | 'transitions' | 'editmeta' | 'operations')[];
  /** Validate JQL */
  validateQuery?: 'strict' | 'warn' | 'none';
  /** Field IDs in response instead of names */
  fieldsByKeys?: boolean;
}

/**
 * Search results
 */
export interface JiraSearchResults {
  expand: string;
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
  warningMessages?: string[];
  names?: Record<string, string>;
  schema?: Record<string, unknown>;
}

// ============================================================================
// Create/Update Types
// ============================================================================

/**
 * Issue creation input
 */
export interface JiraIssueCreateInput {
  /** Project key or ID */
  project: string | { key: string } | { id: string };
  /** Issue type name or ID */
  issuetype: string | { name: string } | { id: string };
  /** Issue summary */
  summary: string;
  /** Issue description in ADF format */
  description?: AdfDocument;
  /** Assignee account ID */
  assignee?: string | { accountId: string };
  /** Reporter account ID */
  reporter?: string | { accountId: string };
  /** Priority name or ID */
  priority?: string | { name: string } | { id: string };
  /** Labels */
  labels?: string[];
  /** Components */
  components?: (string | { name: string } | { id: string })[];
  /** Fix versions */
  fixVersions?: (string | { name: string } | { id: string })[];
  /** Due date (YYYY-MM-DD) */
  duedate?: string;
  /** Parent issue key (for subtasks) */
  parent?: string | { key: string };
  /** Custom fields */
  customFields?: Record<string, unknown>;
}

/**
 * Issue update input
 */
export interface JiraIssueUpdateInput {
  /** Update summary */
  summary?: string;
  /** Update description */
  description?: AdfDocument;
  /** Update assignee */
  assignee?: string | { accountId: string } | null;
  /** Update priority */
  priority?: string | { name: string } | { id: string };
  /** Update labels (replaces all) */
  labels?: string[];
  /** Add labels */
  addLabels?: string[];
  /** Remove labels */
  removeLabels?: string[];
  /** Update components */
  components?: (string | { name: string } | { id: string })[];
  /** Update fix versions */
  fixVersions?: (string | { name: string } | { id: string })[];
  /** Update due date */
  duedate?: string | null;
  /** Update custom fields */
  customFields?: Record<string, unknown>;
}

/**
 * Comment creation input
 */
export interface JiraCommentInput {
  /** Comment body in ADF format */
  body: AdfDocument;
  /** Visibility restriction */
  visibility?: {
    type: 'group' | 'role';
    value: string;
  };
}

/**
 * Transition execution input
 */
export interface JiraTransitionInput {
  /** Transition ID */
  transitionId: string;
  /** Fields to set during transition */
  fields?: Record<string, unknown>;
  /** Update fields (add/remove) */
  update?: Record<string, { add?: unknown; remove?: unknown; set?: unknown }[]>;
  /** Comment to add with transition */
  comment?: JiraCommentInput;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Issue creation response
 */
export interface JiraIssueCreateResponse {
  id: string;
  key: string;
  self: string;
}

/**
 * Transitions response
 */
export interface JiraTransitionsResponse {
  expand: string;
  transitions: JiraTransition[];
}

/**
 * Comments response
 */
export interface JiraCommentsResponse {
  startAt: number;
  maxResults: number;
  total: number;
  comments: JiraComment[];
}

// ============================================================================
// Minimal Field Sets for Efficiency
// ============================================================================

/**
 * Minimal fields for list views
 */
export const JIRA_LIST_FIELDS = [
  'summary',
  'status',
  'assignee',
  'priority',
  'issuetype',
  'created',
  'updated',
  'labels',
] as const;

/**
 * Standard fields for detail views
 */
export const JIRA_DETAIL_FIELDS = [
  ...JIRA_LIST_FIELDS,
  'description',
  'reporter',
  'project',
  'components',
  'fixVersions',
  'resolution',
  'resolutiondate',
  'duedate',
  'timetracking',
  'parent',
  'subtasks',
] as const;

/**
 * Extended fields including comments
 */
export const JIRA_EXTENDED_FIELDS = [
  ...JIRA_DETAIL_FIELDS,
  'comment',
  'attachment',
  'issuelinks',
] as const;
