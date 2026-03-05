/**
 * Bitbucket Cloud API Types
 *
 * Type definitions for the Bitbucket Cloud REST API v2.0
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Bitbucket link representation
 */
export interface BitbucketLink {
  href: string;
  name?: string;
}

/**
 * Standard links object used across Bitbucket resources
 */
export interface BitbucketLinks {
  self?: BitbucketLink;
  html?: BitbucketLink;
  avatar?: BitbucketLink;
  commits?: BitbucketLink;
  clone?: BitbucketLink[];
  [key: string]: BitbucketLink | BitbucketLink[] | undefined;
}

/**
 * Bitbucket account representation (user or team)
 */
export interface BitbucketAccount {
  uuid: string;
  account_id?: string;
  username?: string;
  display_name: string;
  nickname?: string;
  type: 'user' | 'team';
  links: BitbucketLinks;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  size?: number;
  page?: number;
  pagelen: number;
  next?: string;
  previous?: string;
  values: T[];
}

/**
 * Bitbucket API error response
 */
export interface BitbucketError {
  type: 'error';
  error: {
    message: string;
    detail?: string;
    data?: Record<string, unknown>;
  };
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Repository project reference
 */
export interface Project {
  type: 'project';
  uuid: string;
  key: string;
  name: string;
  links: BitbucketLinks;
}

/**
 * Repository representation
 */
export interface Repository {
  type: 'repository';
  uuid: string;
  full_name: string;
  name: string;
  slug: string;
  description: string;
  scm: 'git' | 'hg';
  is_private: boolean;
  owner: BitbucketAccount;
  workspace: Workspace;
  project?: Project;
  created_on: string;
  updated_on: string;
  size: number;
  language: string;
  has_issues: boolean;
  has_wiki: boolean;
  fork_policy: 'allow_forks' | 'no_public_forks' | 'no_forks';
  mainbranch?: BranchRef;
  links: BitbucketLinks;
}

/**
 * Workspace representation
 */
export interface Workspace {
  type: 'workspace';
  uuid: string;
  name: string;
  slug: string;
  links: BitbucketLinks;
}

// ============================================================================
// Branch Types
// ============================================================================

/**
 * Branch reference (minimal)
 */
export interface BranchRef {
  name: string;
  type?: 'branch' | 'named_branch';
}

/**
 * Commit hash reference
 */
export interface CommitRef {
  hash: string;
  type?: 'commit';
}

/**
 * Branch target (commit)
 */
export interface BranchTarget {
  hash: string;
  type: 'commit';
  date?: string;
  message?: string;
  author?: {
    type: 'author';
    raw: string;
    user?: BitbucketAccount;
  };
  parents?: CommitRef[];
  links?: BitbucketLinks;
}

/**
 * Full branch representation
 */
export interface Branch {
  type: 'branch' | 'named_branch';
  name: string;
  target: BranchTarget;
  links: BitbucketLinks;
  default_merge_strategy?: string;
  merge_strategies?: string[];
}

/**
 * Request payload for creating a branch
 */
export interface CreateBranchRequest {
  name: string;
  target: {
    hash: string;
  };
}

// ============================================================================
// Pull Request Types
// ============================================================================

/**
 * Pull request state
 */
export type PullRequestState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

/**
 * Pull request source/destination reference
 */
export interface PullRequestRef {
  branch: BranchRef;
  commit?: CommitRef;
  repository?: Repository;
}

/**
 * Pull request participant
 */
export interface PullRequestParticipant {
  type: 'participant';
  user: BitbucketAccount;
  role: 'PARTICIPANT' | 'REVIEWER';
  approved: boolean;
  state: 'approved' | 'changes_requested' | null;
  participated_on?: string;
}

/**
 * Pull request reviewer
 */
export interface PullRequestReviewer {
  uuid?: string;
  account_id?: string;
  username?: string;
}

/**
 * Full pull request representation
 */
export interface PullRequest {
  type: 'pullrequest';
  id: number;
  title: string;
  description: string;
  state: PullRequestState;
  author: BitbucketAccount;
  source: PullRequestRef;
  destination: PullRequestRef;
  merge_commit?: CommitRef;
  close_source_branch: boolean;
  closed_by?: BitbucketAccount;
  reason?: string;
  created_on: string;
  updated_on: string;
  comment_count: number;
  task_count: number;
  reviewers: BitbucketAccount[];
  participants: PullRequestParticipant[];
  links: BitbucketLinks;
}

/**
 * Request payload for creating a pull request
 */
export interface CreatePullRequestRequest {
  title: string;
  source: {
    branch: {
      name: string;
    };
    repository?: {
      full_name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  description?: string;
  close_source_branch?: boolean;
  reviewers?: PullRequestReviewer[];
}

/**
 * Request payload for updating a pull request
 */
export interface UpdatePullRequestRequest {
  title?: string;
  description?: string;
  destination?: {
    branch: {
      name: string;
    };
  };
  reviewers?: PullRequestReviewer[];
  close_source_branch?: boolean;
}

/**
 * Merge strategy options
 */
export type MergeStrategy = 'merge_commit' | 'squash' | 'fast_forward';

/**
 * Request payload for merging a pull request
 */
export interface MergePullRequestRequest {
  type?: 'pullrequest';
  message?: string;
  close_source_branch?: boolean;
  merge_strategy?: MergeStrategy;
}

// ============================================================================
// Comment Types
// ============================================================================

/**
 * Comment content
 */
export interface CommentContent {
  raw: string;
  markup?: 'markdown' | 'creole' | 'plaintext';
  html?: string;
}

/**
 * Inline comment location
 */
export interface InlineLocation {
  path: string;
  from?: number | null;
  to?: number | null;
}

/**
 * Pull request comment
 */
export interface Comment {
  type: 'pullrequest_comment';
  id: number;
  content: CommentContent;
  user: BitbucketAccount;
  inline?: InlineLocation;
  parent?: { id: number };
  created_on: string;
  updated_on: string;
  deleted: boolean;
  pending: boolean;
  pullrequest?: { id: number };
  links: BitbucketLinks;
}

/**
 * Request payload for creating a comment
 */
export interface CreateCommentRequest {
  content: {
    raw: string;
  };
  inline?: InlineLocation;
  parent?: { id: number };
}

// ============================================================================
// Pipeline Types
// ============================================================================

/**
 * Pipeline state
 */
export type PipelineStateType =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PAUSED'
  | 'HALTED';

/**
 * Pipeline result (when completed)
 */
export type PipelineResultType =
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'ERROR'
  | 'STOPPED'
  | 'EXPIRED';

/**
 * Pipeline state representation
 */
export interface PipelineState {
  type: 'pipeline_state_pending' | 'pipeline_state_in_progress' | 'pipeline_state_completed' | 'pipeline_state_paused' | 'pipeline_state_halted';
  name: PipelineStateType;
  result?: {
    type: string;
    name: PipelineResultType;
  };
  stage?: {
    type: string;
    name: string;
  };
}

/**
 * Pipeline target (branch, commit, etc.)
 */
export interface PipelineTarget {
  type: 'pipeline_ref_target' | 'pipeline_commit_target' | 'pipeline_pullrequest_target';
  ref_type?: 'branch' | 'tag' | 'named_branch' | 'bookmark';
  ref_name?: string;
  commit?: {
    type: 'commit';
    hash: string;
    message?: string;
  };
  selector?: {
    type: 'custom' | 'branches' | 'tags' | 'pull-requests' | 'default';
    pattern?: string;
  };
}

/**
 * Pipeline trigger
 */
export interface PipelineTrigger {
  type: 'pipeline_trigger_manual' | 'pipeline_trigger_push' | 'pipeline_trigger_pull_request' | 'pipeline_trigger_schedule';
  name?: string;
}

/**
 * Pipeline creator
 */
export interface PipelineCreator {
  type: 'user' | 'account';
  uuid?: string;
  display_name?: string;
  account_id?: string;
  links?: BitbucketLinks;
}

/**
 * Full pipeline representation
 */
export interface Pipeline {
  type: 'pipeline';
  uuid: string;
  build_number: number;
  state: PipelineState;
  target: PipelineTarget;
  trigger: PipelineTrigger;
  creator?: PipelineCreator;
  repository: Repository;
  created_on: string;
  completed_on?: string;
  run_number?: number;
  duration_in_seconds?: number;
  build_seconds_used?: number;
  first_successful?: boolean;
  expired?: boolean;
  has_variables?: boolean;
  links: BitbucketLinks;
}

/**
 * Pipeline step state
 */
export interface PipelineStepState {
  type: string;
  name: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'HALTED';
  result?: {
    type: string;
    name: 'SUCCESSFUL' | 'FAILED' | 'ERROR' | 'STOPPED' | 'EXPIRED' | 'NOT_RUN';
  };
}

/**
 * Pipeline step
 */
export interface PipelineStep {
  type: 'pipeline_step';
  uuid: string;
  name: string;
  state: PipelineStepState;
  script_commands?: Array<{
    name: string;
    command: string;
  }>;
  started_on?: string;
  completed_on?: string;
  duration_in_seconds?: number;
  build_seconds_used?: number;
  run_number?: number;
  max_time?: number;
  image?: {
    name: string;
  };
  setup_commands?: Array<{
    name: string;
    command: string;
  }>;
  teardown_commands?: Array<{
    name: string;
    command: string;
  }>;
  pipeline: { uuid: string };
  links: BitbucketLinks;
}

/**
 * Pipeline variable
 */
export interface PipelineVariable {
  type: 'pipeline_variable';
  uuid?: string;
  key: string;
  value?: string;
  secured: boolean;
}

/**
 * Request payload for triggering a pipeline
 */
export interface TriggerPipelineRequest {
  target: {
    type: 'pipeline_ref_target' | 'pipeline_commit_target';
    ref_type?: 'branch' | 'tag' | 'named_branch' | 'bookmark';
    ref_name?: string;
    commit?: {
      type: 'commit';
      hash: string;
    };
    selector?: {
      type: 'custom' | 'branches' | 'tags' | 'pull-requests' | 'default';
      pattern?: string;
    };
  };
  variables?: PipelineVariable[];
}

// ============================================================================
// Deployment Types
// ============================================================================

/**
 * Deployment environment type
 */
export type EnvironmentType = 'Test' | 'Staging' | 'Production';

/**
 * Environment lock
 */
export interface EnvironmentLock {
  type: 'deployment_environment_lock_configuration_open' | 'deployment_environment_lock_configuration_prevent_all';
  name: 'OPEN' | 'LOCKED';
}

/**
 * Deployment environment
 */
export interface Environment {
  type: 'deployment_environment';
  uuid: string;
  name: string;
  slug?: string;
  environment_type: {
    type: 'deployment_environment_type';
    name: EnvironmentType;
    rank?: number;
  };
  lock?: EnvironmentLock;
  restrictions?: {
    type: 'deployment_restrictions_configuration';
    admin_only?: boolean;
  };
  hidden?: boolean;
  rank?: number;
  category?: {
    name: string;
  };
}

/**
 * Deployment state
 */
export interface DeploymentState {
  type: 'deployment_state_completed' | 'deployment_state_in_progress' | 'deployment_state_undeployed';
  name: 'COMPLETED' | 'IN_PROGRESS' | 'UNDEPLOYED';
  status?: {
    type: string;
    name: 'SUCCESSFUL' | 'FAILED' | 'STOPPED';
  };
}

/**
 * Deployment release
 */
export interface DeploymentRelease {
  type: 'deployment_release';
  uuid?: string;
  name: string;
  url?: string;
  commit?: {
    type: 'commit';
    hash: string;
    message?: string;
  };
  created_on?: string;
}

/**
 * Deployment representation
 */
export interface Deployment {
  type: 'deployment';
  uuid: string;
  state: DeploymentState;
  environment: Environment;
  release?: DeploymentRelease;
  step?: PipelineStep;
  deployable?: {
    type: string;
    uuid: string;
    key: string;
    name: string;
    pipeline: { uuid: string };
    commit?: {
      type: 'commit';
      hash: string;
    };
  };
  last_update_time?: string;
}

/**
 * Deployment environment variable
 */
export interface DeploymentVariable {
  type: 'deployment_variable';
  uuid?: string;
  key: string;
  value?: string;
  secured: boolean;
}

/**
 * Request payload for setting a deployment variable
 */
export interface SetDeploymentVariableRequest {
  key: string;
  value: string;
  secured?: boolean;
}

// ============================================================================
// Diff Types
// ============================================================================

/**
 * Diff stat entry
 */
export interface DiffStatEntry {
  type: 'diffstat';
  status: 'added' | 'removed' | 'modified' | 'renamed';
  lines_added: number;
  lines_removed: number;
  old?: {
    path: string;
    type: 'commit_file';
    escaped_path?: string;
  };
  new?: {
    path: string;
    type: 'commit_file';
    escaped_path?: string;
  };
}

/**
 * Diff response (raw text)
 */
export type DiffResponse = string;

// ============================================================================
// Client Configuration Types
// ============================================================================

/**
 * Bitbucket authentication configuration
 */
export interface BitbucketAuthConfig {
  /** OAuth 2.0 access token */
  accessToken?: string;
  /** App password (legacy authentication) */
  appPassword?: string;
  /** Username for app password authentication */
  username?: string;
  /** OAuth 2.0 refresh token */
  refreshToken?: string;
  /** OAuth 2.0 client ID for token refresh */
  clientId?: string;
  /** OAuth 2.0 client secret for token refresh */
  clientSecret?: string;
}

/**
 * Bitbucket client configuration
 */
export interface BitbucketClientConfig {
  /** Authentication configuration */
  auth: BitbucketAuthConfig;
  /** Base URL for the Bitbucket API (default: https://api.bitbucket.org/2.0) */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
  /** Custom user agent string */
  userAgent?: string;
}

/**
 * Options for paginated requests
 */
export interface PaginationOptions {
  /** Page number to fetch (1-indexed) */
  page?: number;
  /** Number of items per page (max 100) */
  pagelen?: number;
  /** Sorting specification (e.g., '-created_on' for descending) */
  sort?: string;
  /** Query filter (Bitbucket query language) */
  q?: string;
}

/**
 * Options for waiting on pipeline completion
 */
export interface WaitForPipelineOptions {
  /** Polling interval in milliseconds (default: 10000) */
  pollInterval?: number;
  /** Maximum time to wait in milliseconds (default: 3600000 = 1 hour) */
  timeout?: number;
  /** Optional callback for status updates */
  onStatusChange?: (pipeline: Pipeline) => void;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Approval response
 */
export interface ApprovalResponse {
  type: 'participant';
  user: BitbucketAccount;
  role: 'REVIEWER';
  approved: boolean;
  state: 'approved' | null;
  participated_on: string;
}

/**
 * Stop pipeline response
 */
export interface StopPipelineResponse {
  type: 'pipeline';
  uuid: string;
  state: PipelineState;
}
