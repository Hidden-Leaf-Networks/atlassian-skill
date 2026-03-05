/**
 * SDLC Orchestration Types
 *
 * Type definitions for cross-product workflow orchestration
 * connecting Jira, Bitbucket, and Confluence.
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Represents the type of work being done, determines branch prefix
 */
export type WorkType = 'feature' | 'bugfix' | 'hotfix' | 'release' | 'chore' | 'docs';

/**
 * Issue type mappings from Jira to work type
 */
export const ISSUE_TYPE_TO_WORK_TYPE: Record<string, WorkType> = {
  'Story': 'feature',
  'Feature': 'feature',
  'New Feature': 'feature',
  'Task': 'feature',
  'Bug': 'bugfix',
  'Defect': 'bugfix',
  'Hotfix': 'hotfix',
  'Critical Bug': 'hotfix',
  'Documentation': 'docs',
  'Chore': 'chore',
  'Technical Debt': 'chore',
  'Improvement': 'feature',
  'Sub-task': 'feature',
};

/**
 * Jira workflow transitions
 */
export type JiraTransition =
  | 'To Do'
  | 'In Progress'
  | 'In Review'
  | 'In QA'
  | 'Done'
  | 'Blocked'
  | 'Closed';

/**
 * Pipeline status from Bitbucket
 */
export type PipelineStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'STOPPED'
  | 'PAUSED';

/**
 * Deployment environment types
 */
export type DeploymentEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'test';

// ============================================================================
// Jira Types (from Phase 1)
// ============================================================================

export interface JiraIssue {
  key: string;
  id: string;
  self: string;
  fields: {
    summary: string;
    description: string | null;
    issuetype: {
      name: string;
      subtask: boolean;
    };
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    priority?: {
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
    };
    labels: string[];
    fixVersions: Array<{
      id: string;
      name: string;
      released: boolean;
      releaseDate?: string;
    }>;
    components: Array<{
      id: string;
      name: string;
    }>;
    created: string;
    updated: string;
    parent?: {
      key: string;
      fields: {
        summary: string;
      };
    };
    subtasks?: Array<{
      key: string;
      fields: {
        summary: string;
        status: {
          name: string;
        };
      };
    }>;
    [key: string]: unknown;
  };
}

export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  projectId: number;
  released: boolean;
  releaseDate?: string;
  startDate?: string;
  archived: boolean;
}

export interface JiraTransitionInfo {
  id: string;
  name: string;
  to: {
    name: string;
    statusCategory: {
      key: string;
    };
  };
}

// ============================================================================
// Bitbucket Types (from Phase 2)
// ============================================================================

export interface BitbucketBranch {
  name: string;
  target: {
    hash: string;
    date: string;
    message: string;
    author: {
      raw: string;
      user?: {
        display_name: string;
        account_id: string;
      };
    };
  };
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  source: {
    branch: {
      name: string;
    };
    repository: {
      full_name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
    repository: {
      full_name: string;
    };
  };
  author: {
    display_name: string;
    account_id: string;
  };
  reviewers: Array<{
    display_name: string;
    account_id: string;
    approved: boolean;
  }>;
  links: {
    html: {
      href: string;
    };
  };
  created_on: string;
  updated_on: string;
  merge_commit?: {
    hash: string;
  };
}

export interface BitbucketPipeline {
  uuid: string;
  build_number: number;
  state: {
    name: PipelineStatus;
    result?: {
      name: string;
    };
  };
  target: {
    type: string;
    ref_name: string;
    ref_type: string;
  };
  created_on: string;
  completed_on?: string;
  duration_in_seconds?: number;
}

export interface BitbucketDeployment {
  uuid: string;
  environment: {
    uuid: string;
    name: string;
    environment_type: {
      name: DeploymentEnvironment;
    };
  };
  release: {
    name: string;
    url: string;
  };
  state: {
    name: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'FAILED';
  };
  deployable: {
    type: string;
    uuid: string;
  };
}

// ============================================================================
// Confluence Types (from Phase 3)
// ============================================================================

export interface ConfluencePage {
  id: string;
  title: string;
  spaceKey: string;
  version: {
    number: number;
    when: string;
  };
  body?: {
    storage: {
      value: string;
      representation: string;
    };
  };
  _links: {
    webui: string;
  };
}

export interface SessionContext {
  sessionId: string;
  issueKey: string;
  branchName: string;
  startTime: string;
  summary?: string;
  filesChanged: string[];
  commits: string[];
}

// ============================================================================
// Workflow Context Types
// ============================================================================

/**
 * Context returned when starting a feature
 */
export interface FeatureContext {
  /** The Jira issue being worked on */
  issue: JiraIssue;

  /** Generated branch name */
  branchName: string;

  /** Branch creation status */
  branchCreated: boolean;

  /** Jira transition status */
  transitioned: boolean;

  /** Previous status before transition */
  previousStatus: string;

  /** New status after transition */
  currentStatus: string;

  /** Labels applied */
  labelsApplied: string[];

  /** Session tracking info */
  session: SessionContext;

  /** Repository information */
  repository: {
    workspace: string;
    slug: string;
  };

  /** Timestamp */
  startedAt: string;
}

/**
 * Result of completing a feature
 */
export interface CompletionResult {
  /** The Jira issue */
  issue: JiraIssue;

  /** Created pull request */
  pullRequest: BitbucketPullRequest;

  /** PR URL for easy access */
  pullRequestUrl: string;

  /** Session summary used for PR */
  sessionSummary: string;

  /** Generated changelog/description */
  generatedDescription: string;

  /** Jira transition result */
  jiraTransitioned: boolean;

  /** New Jira status */
  jiraStatus: string;

  /** Link added to Jira */
  jiraLinkAdded: boolean;

  /** Confluence archive page (if created) */
  confluenceArchive?: {
    pageId: string;
    pageUrl: string;
  };

  /** Docs sync result (if applicable) */
  docsSynced: boolean;

  /** Completion timestamp */
  completedAt: string;
}

/**
 * Release workflow result
 */
export interface ReleaseResult {
  /** Version being released */
  version: string;

  /** Issues included in release */
  issues: JiraIssue[];

  /** Generated changelog */
  changelog: string;

  /** Release branch name */
  releaseBranch: string;

  /** Release PR */
  pullRequest: BitbucketPullRequest;

  /** Pipeline triggered for deployment */
  deploymentPipeline?: BitbucketPipeline;

  /** Jira version release status */
  jiraVersionReleased: boolean;

  /** Confluence release notes page */
  releaseNotesPage?: {
    pageId: string;
    pageUrl: string;
  };

  /** Release timestamp */
  releasedAt: string;
}

// ============================================================================
// Workflow Configuration
// ============================================================================

/**
 * Workflow configuration options
 */
export interface WorkflowConfig {
  /** Repository configuration */
  repository: {
    workspace: string;
    slug: string;
    defaultBranch: string;
  };

  /** Jira project configuration */
  jira: {
    projectKey: string;

    /** Status names for transitions */
    statuses: {
      toDo: string;
      inProgress: string;
      inReview: string;
      done: string;
    };

    /** Custom field mappings */
    customFields?: Record<string, string>;
  };

  /** Confluence configuration */
  confluence: {
    spaceKey: string;
    releaseNotesParentPageId?: string;
    sessionArchiveParentPageId?: string;
  };

  /** Branch naming configuration */
  branchNaming: {
    /** Max length for branch name */
    maxLength: number;

    /** Separator between parts */
    separator: string;

    /** Include issue type prefix */
    includeTypePrefix: boolean;
  };

  /** PR configuration */
  pullRequest: {
    /** Default reviewers to add */
    defaultReviewers?: string[];

    /** Target branch for features */
    featureTargetBranch: string;

    /** Target branch for releases */
    releaseTargetBranch: string;
  };

  /** Labels to apply */
  labels: {
    inDevelopment: string;
    inReview: string;
    released: string;
  };

  /** Auto-sync settings */
  autoSync: {
    /** Sync README changes to Confluence */
    syncReadmeToConfluence: boolean;

    /** Archive sessions automatically */
    archiveSessions: boolean;

    /** Update Jira on PR events */
    updateJiraOnPREvents: boolean;
  };
}

/**
 * Default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  repository: {
    workspace: '',
    slug: '',
    defaultBranch: 'main',
  },
  jira: {
    projectKey: '',
    statuses: {
      toDo: 'To Do',
      inProgress: 'In Progress',
      inReview: 'In Review',
      done: 'Done',
    },
  },
  confluence: {
    spaceKey: '',
  },
  branchNaming: {
    maxLength: 80,
    separator: '-',
    includeTypePrefix: true,
  },
  pullRequest: {
    featureTargetBranch: 'develop',
    releaseTargetBranch: 'main',
  },
  labels: {
    inDevelopment: 'in-development',
    inReview: 'in-review',
    released: 'released',
  },
  autoSync: {
    syncReadmeToConfluence: true,
    archiveSessions: true,
    updateJiraOnPREvents: true,
  },
};

// ============================================================================
// Workflow State
// ============================================================================

/**
 * Current state of a workflow
 */
export interface WorkflowState {
  /** Workflow type */
  type: 'feature' | 'bugfix' | 'hotfix' | 'release';

  /** Current phase */
  phase:
    | 'not_started'
    | 'branch_created'
    | 'in_development'
    | 'pr_created'
    | 'in_review'
    | 'merged'
    | 'deployed'
    | 'completed';

  /** Associated issue key */
  issueKey: string;

  /** Branch name */
  branchName?: string;

  /** PR ID if created */
  pullRequestId?: number;

  /** Pipeline UUID if running */
  pipelineUuid?: string;

  /** Started at */
  startedAt: string;

  /** Last updated */
  updatedAt: string;

  /** Metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Event Types for Triggers
// ============================================================================

/**
 * Base event type
 */
export interface WorkflowEvent {
  type: string;
  timestamp: string;
  source: 'jira' | 'bitbucket' | 'confluence' | 'internal';
  metadata?: Record<string, unknown>;
}

/**
 * Branch created event
 */
export interface BranchCreatedEvent extends WorkflowEvent {
  type: 'branch:created';
  source: 'bitbucket';
  payload: {
    branchName: string;
    repository: {
      workspace: string;
      slug: string;
    };
    commit: {
      hash: string;
      message: string;
    };
    creator?: {
      accountId: string;
      displayName: string;
    };
  };
}

/**
 * PR created event
 */
export interface PRCreatedEvent extends WorkflowEvent {
  type: 'pr:created';
  source: 'bitbucket';
  payload: {
    pullRequest: BitbucketPullRequest;
    repository: {
      workspace: string;
      slug: string;
    };
  };
}

/**
 * PR merged event
 */
export interface PRMergedEvent extends WorkflowEvent {
  type: 'pr:merged';
  source: 'bitbucket';
  payload: {
    pullRequest: BitbucketPullRequest;
    mergeCommit: {
      hash: string;
    };
    repository: {
      workspace: string;
      slug: string;
    };
  };
}

/**
 * PR declined event
 */
export interface PRDeclinedEvent extends WorkflowEvent {
  type: 'pr:declined';
  source: 'bitbucket';
  payload: {
    pullRequest: BitbucketPullRequest;
    reason?: string;
    repository: {
      workspace: string;
      slug: string;
    };
  };
}

/**
 * Pipeline completed event
 */
export interface PipelineCompletedEvent extends WorkflowEvent {
  type: 'pipeline:completed';
  source: 'bitbucket';
  payload: {
    pipeline: BitbucketPipeline;
    repository: {
      workspace: string;
      slug: string;
    };
  };
}

/**
 * Deployment completed event
 */
export interface DeploymentCompletedEvent extends WorkflowEvent {
  type: 'deployment:completed';
  source: 'bitbucket';
  payload: {
    deployment: BitbucketDeployment;
    repository: {
      workspace: string;
      slug: string;
    };
  };
}

/**
 * Jira issue updated event
 */
export interface JiraIssueUpdatedEvent extends WorkflowEvent {
  type: 'jira:issue:updated';
  source: 'jira';
  payload: {
    issue: JiraIssue;
    changelog: {
      field: string;
      fromString: string | null;
      toString: string;
    }[];
  };
}

/**
 * Union type of all workflow events
 */
export type AnyWorkflowEvent =
  | BranchCreatedEvent
  | PRCreatedEvent
  | PRMergedEvent
  | PRDeclinedEvent
  | PipelineCompletedEvent
  | DeploymentCompletedEvent
  | JiraIssueUpdatedEvent;

// ============================================================================
// Service Interfaces
// ============================================================================

/**
 * Interface for Jira service (from Phase 1)
 */
export interface IJiraService {
  getIssue(issueKey: string): Promise<JiraIssue>;
  searchIssues(jql: string): Promise<JiraIssue[]>;
  transitionIssue(issueKey: string, transitionName: string): Promise<void>;
  addLabel(issueKey: string, label: string): Promise<void>;
  removeLabel(issueKey: string, label: string): Promise<void>;
  addComment(issueKey: string, body: string): Promise<void>;
  addRemoteLink(issueKey: string, url: string, title: string): Promise<void>;
  getIssuesByVersion(versionName: string): Promise<JiraIssue[]>;
  releaseVersion(versionId: string): Promise<void>;
  getTransitions(issueKey: string): Promise<JiraTransitionInfo[]>;
}

/**
 * Interface for Bitbucket service (from Phase 2)
 */
export interface IBitbucketService {
  createBranch(workspace: string, slug: string, branchName: string, fromBranch?: string): Promise<BitbucketBranch>;
  getBranch(workspace: string, slug: string, branchName: string): Promise<BitbucketBranch | null>;
  deleteBranch(workspace: string, slug: string, branchName: string): Promise<void>;
  createPullRequest(
    workspace: string,
    slug: string,
    title: string,
    sourceBranch: string,
    destinationBranch: string,
    description?: string,
    reviewers?: string[]
  ): Promise<BitbucketPullRequest>;
  getPullRequest(workspace: string, slug: string, prId: number): Promise<BitbucketPullRequest>;
  mergePullRequest(workspace: string, slug: string, prId: number): Promise<BitbucketPullRequest>;
  getPipeline(workspace: string, slug: string, pipelineUuid: string): Promise<BitbucketPipeline>;
  triggerPipeline(workspace: string, slug: string, branch: string, variables?: Record<string, string>): Promise<BitbucketPipeline>;
  getDiff(workspace: string, slug: string, sourceBranch: string, destinationBranch?: string): Promise<string>;
}

/**
 * Interface for Confluence service (from Phase 3)
 */
export interface IConfluenceService {
  createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<ConfluencePage>;
  updatePage(pageId: string, title: string, content: string, version: number): Promise<ConfluencePage>;
  getPage(pageId: string): Promise<ConfluencePage>;
  findPageByTitle(spaceKey: string, title: string): Promise<ConfluencePage | null>;
  archiveSession(session: SessionContext): Promise<ConfluencePage>;
}

/**
 * Interface for session manager
 */
export interface ISessionManager {
  getCurrentSession(): SessionContext | null;
  startSession(issueKey: string, branchName: string): SessionContext;
  endSession(): SessionContext | null;
  getSummary(): string;
  addFile(filePath: string): void;
  addCommit(commitHash: string): void;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Workflow-specific error
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: WorkflowErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export type WorkflowErrorCode =
  | 'ISSUE_NOT_FOUND'
  | 'BRANCH_ALREADY_EXISTS'
  | 'BRANCH_CREATION_FAILED'
  | 'TRANSITION_FAILED'
  | 'PR_CREATION_FAILED'
  | 'INVALID_BRANCH_NAME'
  | 'VERSION_NOT_FOUND'
  | 'RELEASE_FAILED'
  | 'SYNC_FAILED'
  | 'CONFLUENCE_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_STATE'
  | 'PERMISSION_DENIED';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes selected properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
