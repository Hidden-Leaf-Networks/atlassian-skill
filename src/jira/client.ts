/**
 * Jira Cloud API Client
 * Extends AtlassianClient with Jira-specific operations
 */

import { AtlassianClient, createClientFromEnv } from '../core/client.js';
import { AtlassianClientConfig, PaginationOptions } from '../core/types.js';
import {
  JiraIssue,
  JiraProject,
  JiraBoard,
  JiraSprint,
  JiraSearchResults,
  JiraSearchOptions,
  JiraIssueCreateInput,
  JiraProjectCreateInput,
  JiraIssueCreateResponse,
  JiraIssueUpdateInput,
  JiraTransition,
  JiraTransitionsResponse,
  JiraTransitionInput,
  JiraComment,
  JiraCommentsResponse,
  JiraCommentInput,
  JiraUser,
  JiraProjectSearchResult,
  JiraSprintIssuesResponse,
  JIRA_LIST_FIELDS,
  JIRA_DETAIL_FIELDS,
} from './types.js';

// ============================================================================
// Jira API Client
// ============================================================================

/**
 * Jira Cloud API client
 * Provides high-level methods for Jira operations
 */
export class JiraClient extends AtlassianClient {
  // REST API v3 base path
  private readonly apiPath = '/rest/api/3';
  // Agile API base path
  private readonly agilePath = '/rest/agile/1.0';

  constructor(config: AtlassianClientConfig) {
    super(config);
  }

  // ==========================================================================
  // Issue Operations
  // ==========================================================================

  /**
   * Get a single issue by key or ID
   */
  async getIssue(
    issueIdOrKey: string,
    options?: {
      fields?: string[];
      expand?: string[];
    }
  ): Promise<JiraIssue> {
    const params: Record<string, string> = {};

    if (options?.fields) {
      params.fields = options.fields.join(',');
    } else {
      params.fields = JIRA_DETAIL_FIELDS.join(',');
    }

    if (options?.expand) {
      params.expand = options.expand.join(',');
    }

    const response = await this.get<JiraIssue>(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      params
    );

    return response.data;
  }

  /**
   * Search issues using JQL
   */
  async searchIssues(options: JiraSearchOptions): Promise<JiraSearchResults> {
    const body: Record<string, unknown> = {
      jql: options.jql,
      fields: options.fields || [...JIRA_LIST_FIELDS],
      nextPageToken: options.startAt ? String(options.startAt) : undefined,
      maxResults: Math.min(options.maxResults || 50, 100),
    };

    // Clean undefined values
    for (const key of Object.keys(body)) {
      if (body[key] === undefined) delete body[key];
    }

    const response = await this.post<{ issues: JiraIssue[]; isLast?: boolean; nextPageToken?: string }>(
      `${this.apiPath}/search/jql`,
      body
    );

    // Normalize response to match JiraSearchResults shape
    const data = response.data;
    return {
      expand: '',
      startAt: options.startAt || 0,
      maxResults: options.maxResults || 50,
      total: data.isLast ? data.issues.length : data.issues.length + 1, // Approximate when not last page
      issues: data.issues as JiraIssue[],
    };
  }

  /**
   * Create a new issue
   */
  async createIssue(input: JiraIssueCreateInput): Promise<JiraIssueCreateResponse> {
    const fields = this.buildIssueFields(input);

    const response = await this.post<JiraIssueCreateResponse>(
      `${this.apiPath}/issue`,
      { fields }
    );

    return response.data;
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    issueIdOrKey: string,
    input: JiraIssueUpdateInput
  ): Promise<void> {
    const { fields, update } = this.buildIssueUpdate(input);

    await this.put(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      { fields, update }
    );
  }

  /**
   * Delete an issue
   */
  async deleteIssue(
    issueIdOrKey: string,
    options?: { deleteSubtasks?: boolean }
  ): Promise<void> {
    await this.delete(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      { deleteSubtasks: options?.deleteSubtasks }
    );
  }

  /**
   * Assign an issue to a user
   */
  async assignIssue(issueIdOrKey: string, accountId: string | null): Promise<void> {
    await this.put(
      `${this.apiPath}/issue/${issueIdOrKey}/assignee`,
      { accountId }
    );
  }

  // ==========================================================================
  // Transition Operations
  // ==========================================================================

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueIdOrKey: string): Promise<JiraTransition[]> {
    const response = await this.get<JiraTransitionsResponse>(
      `${this.apiPath}/issue/${issueIdOrKey}/transitions`,
      { expand: 'transitions.fields' }
    );

    return response.data.transitions;
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(
    issueIdOrKey: string,
    input: JiraTransitionInput
  ): Promise<void> {
    const body: Record<string, unknown> = {
      transition: { id: input.transitionId },
    };

    if (input.fields) {
      body.fields = input.fields;
    }

    if (input.update) {
      body.update = input.update;
    }

    if (input.comment) {
      body.update = {
        ...body.update as object,
        comment: [{ add: input.comment }],
      };
    }

    await this.post(
      `${this.apiPath}/issue/${issueIdOrKey}/transitions`,
      body
    );
  }

  // ==========================================================================
  // Comment Operations
  // ==========================================================================

  /**
   * Get comments on an issue
   */
  async getComments(
    issueIdOrKey: string,
    options?: PaginationOptions
  ): Promise<JiraCommentsResponse> {
    const response = await this.get<JiraCommentsResponse>(
      `${this.apiPath}/issue/${issueIdOrKey}/comment`,
      {
        startAt: options?.startAt,
        maxResults: options?.maxResults,
      }
    );

    return response.data;
  }

  /**
   * Add a comment to an issue
   */
  async addComment(
    issueIdOrKey: string,
    input: JiraCommentInput
  ): Promise<JiraComment> {
    const response = await this.post<JiraComment>(
      `${this.apiPath}/issue/${issueIdOrKey}/comment`,
      input
    );

    return response.data;
  }

  /**
   * Update a comment
   */
  async updateComment(
    issueIdOrKey: string,
    commentId: string,
    input: JiraCommentInput
  ): Promise<JiraComment> {
    const response = await this.put<JiraComment>(
      `${this.apiPath}/issue/${issueIdOrKey}/comment/${commentId}`,
      input
    );

    return response.data;
  }

  /**
   * Delete a comment
   */
  async deleteComment(issueIdOrKey: string, commentId: string): Promise<void> {
    await this.delete(
      `${this.apiPath}/issue/${issueIdOrKey}/comment/${commentId}`
    );
  }

  // ==========================================================================
  // Label Operations
  // ==========================================================================

  /**
   * Add labels to an issue
   */
  async addLabels(issueIdOrKey: string, labels: string[]): Promise<void> {
    await this.put(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      {
        update: {
          labels: labels.map(label => ({ add: label })),
        },
      }
    );
  }

  /**
   * Remove labels from an issue
   */
  async removeLabels(issueIdOrKey: string, labels: string[]): Promise<void> {
    await this.put(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      {
        update: {
          labels: labels.map(label => ({ remove: label })),
        },
      }
    );
  }

  /**
   * Set labels on an issue (replaces all existing)
   */
  async setLabels(issueIdOrKey: string, labels: string[]): Promise<void> {
    await this.put(
      `${this.apiPath}/issue/${issueIdOrKey}`,
      {
        fields: { labels },
      }
    );
  }

  // ==========================================================================
  // Project Operations
  // ==========================================================================

  /**
   * Get a project by key or ID
   */
  async getProject(projectIdOrKey: string): Promise<JiraProject> {
    const response = await this.get<JiraProject>(
      `${this.apiPath}/project/${projectIdOrKey}`
    );

    return response.data;
  }

  /**
   * Create a new project
   */
  /**
   * Delete a project and all its issues
   */
  async deleteProject(projectIdOrKey: string, options?: { enableUndo?: boolean }): Promise<void> {
    await this.delete(
      `${this.apiPath}/project/${projectIdOrKey}`,
      { enableUndo: options?.enableUndo ?? false }
    );
  }

  async createProject(input: JiraProjectCreateInput): Promise<JiraProject> {
    const response = await this.post<JiraProject>(
      `${this.apiPath}/project`,
      {
        key: input.key,
        name: input.name,
        description: input.description,
        projectTypeKey: input.projectTypeKey,
        projectTemplateKey: input.projectTemplateKey || 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
        leadAccountId: input.leadAccountId,
      }
    );

    return response.data;
  }

  /**
   * List all projects
   */
  async listProjects(options?: PaginationOptions): Promise<JiraProjectSearchResult> {
    const response = await this.get<JiraProjectSearchResult>(
      `${this.apiPath}/project/search`,
      {
        startAt: options?.startAt,
        maxResults: options?.maxResults,
      }
    );

    return response.data;
  }

  // ==========================================================================
  // Board Operations (Agile)
  // ==========================================================================

  /**
   * Get a board by ID
   */
  async getBoard(boardId: number): Promise<JiraBoard> {
    const response = await this.get<JiraBoard>(
      `${this.agilePath}/board/${boardId}`
    );

    return response.data;
  }

  /**
   * List all boards
   */
  async listBoards(options?: {
    projectKeyOrId?: string;
    type?: 'scrum' | 'kanban' | 'simple';
    startAt?: number;
    maxResults?: number;
  }): Promise<{ values: JiraBoard[]; total: number }> {
    const response = await this.get<{ values: JiraBoard[]; total: number }>(
      `${this.agilePath}/board`,
      {
        projectKeyOrId: options?.projectKeyOrId,
        type: options?.type,
        startAt: options?.startAt,
        maxResults: options?.maxResults,
      }
    );

    return response.data;
  }

  // ==========================================================================
  // Sprint Operations (Agile)
  // ==========================================================================

  /**
   * Get a sprint by ID
   */
  async getSprint(sprintId: number): Promise<JiraSprint> {
    const response = await this.get<JiraSprint>(
      `${this.agilePath}/sprint/${sprintId}`
    );

    return response.data;
  }

  /**
   * List sprints for a board
   */
  async listSprints(
    boardId: number,
    options?: {
      state?: 'future' | 'active' | 'closed';
      startAt?: number;
      maxResults?: number;
    }
  ): Promise<{ values: JiraSprint[]; total: number }> {
    const response = await this.get<{ values: JiraSprint[]; total: number }>(
      `${this.agilePath}/board/${boardId}/sprint`,
      {
        state: options?.state,
        startAt: options?.startAt,
        maxResults: options?.maxResults,
      }
    );

    return response.data;
  }

  /**
   * Get issues in a sprint
   */
  async getSprintIssues(
    sprintId: number,
    options?: {
      fields?: string[];
      startAt?: number;
      maxResults?: number;
    }
  ): Promise<JiraSprintIssuesResponse> {
    const response = await this.get<JiraSprintIssuesResponse>(
      `${this.agilePath}/sprint/${sprintId}/issue`,
      {
        fields: (options?.fields || JIRA_LIST_FIELDS).join(','),
        startAt: options?.startAt,
        maxResults: options?.maxResults,
      }
    );

    return response.data;
  }

  /**
   * Move issues to a sprint
   */
  async moveIssuesToSprint(
    sprintId: number,
    issueKeys: string[]
  ): Promise<void> {
    await this.post(
      `${this.agilePath}/sprint/${sprintId}/issue`,
      { issues: issueKeys }
    );
  }

  // ==========================================================================
  // User Operations
  // ==========================================================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<JiraUser> {
    const response = await this.get<JiraUser>(
      `${this.apiPath}/myself`
    );

    return response.data;
  }

  /**
   * Search for users
   */
  async searchUsers(
    query: string,
    options?: { maxResults?: number }
  ): Promise<JiraUser[]> {
    const response = await this.get<JiraUser[]>(
      `${this.apiPath}/user/search`,
      {
        query,
        maxResults: options?.maxResults || 50,
      }
    );

    return response.data;
  }

  /**
   * Get assignable users for a project
   */
  async getAssignableUsers(
    projectKey: string,
    options?: { query?: string; maxResults?: number }
  ): Promise<JiraUser[]> {
    const response = await this.get<JiraUser[]>(
      `${this.apiPath}/user/assignable/search`,
      {
        project: projectKey,
        query: options?.query,
        maxResults: options?.maxResults || 50,
      }
    );

    return response.data;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build issue fields from create input
   */
  private buildIssueFields(input: JiraIssueCreateInput): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      summary: input.summary,
    };

    // Project
    if (typeof input.project === 'string') {
      fields.project = { key: input.project };
    } else {
      fields.project = input.project;
    }

    // Issue type
    if (typeof input.issuetype === 'string') {
      fields.issuetype = { name: input.issuetype };
    } else {
      fields.issuetype = input.issuetype;
    }

    // Description
    if (input.description) {
      fields.description = input.description;
    }

    // Assignee
    if (input.assignee) {
      if (typeof input.assignee === 'string') {
        fields.assignee = { accountId: input.assignee };
      } else {
        fields.assignee = input.assignee;
      }
    }

    // Reporter
    if (input.reporter) {
      if (typeof input.reporter === 'string') {
        fields.reporter = { accountId: input.reporter };
      } else {
        fields.reporter = input.reporter;
      }
    }

    // Priority
    if (input.priority) {
      if (typeof input.priority === 'string') {
        fields.priority = { name: input.priority };
      } else {
        fields.priority = input.priority;
      }
    }

    // Labels
    if (input.labels) {
      fields.labels = input.labels;
    }

    // Components
    if (input.components) {
      fields.components = input.components.map(c =>
        typeof c === 'string' ? { name: c } : c
      );
    }

    // Fix versions
    if (input.fixVersions) {
      fields.fixVersions = input.fixVersions.map(v =>
        typeof v === 'string' ? { name: v } : v
      );
    }

    // Due date
    if (input.duedate) {
      fields.duedate = input.duedate;
    }

    // Parent (for subtasks)
    if (input.parent) {
      if (typeof input.parent === 'string') {
        fields.parent = { key: input.parent };
      } else {
        fields.parent = input.parent;
      }
    }

    // Custom fields
    if (input.customFields) {
      Object.assign(fields, input.customFields);
    }

    return fields;
  }

  /**
   * Build update payload from update input
   */
  private buildIssueUpdate(input: JiraIssueUpdateInput): {
    fields: Record<string, unknown>;
    update: Record<string, unknown[]>;
  } {
    const fields: Record<string, unknown> = {};
    const update: Record<string, unknown[]> = {};

    // Direct field updates
    if (input.summary !== undefined) {
      fields.summary = input.summary;
    }

    if (input.description !== undefined) {
      fields.description = input.description;
    }

    if (input.assignee !== undefined) {
      if (input.assignee === null) {
        fields.assignee = null;
      } else if (typeof input.assignee === 'string') {
        fields.assignee = { accountId: input.assignee };
      } else {
        fields.assignee = input.assignee;
      }
    }

    if (input.priority !== undefined) {
      if (typeof input.priority === 'string') {
        fields.priority = { name: input.priority };
      } else {
        fields.priority = input.priority;
      }
    }

    if (input.duedate !== undefined) {
      fields.duedate = input.duedate;
    }

    // Label operations
    if (input.labels !== undefined) {
      fields.labels = input.labels;
    } else {
      if (input.addLabels?.length) {
        update.labels = [
          ...(update.labels || []),
          ...input.addLabels.map(l => ({ add: l })),
        ];
      }
      if (input.removeLabels?.length) {
        update.labels = [
          ...(update.labels || []),
          ...input.removeLabels.map(l => ({ remove: l })),
        ];
      }
    }

    // Components
    if (input.components !== undefined) {
      fields.components = input.components.map(c =>
        typeof c === 'string' ? { name: c } : c
      );
    }

    // Fix versions
    if (input.fixVersions !== undefined) {
      fields.fixVersions = input.fixVersions.map(v =>
        typeof v === 'string' ? { name: v } : v
      );
    }

    // Custom fields
    if (input.customFields) {
      Object.assign(fields, input.customFields);
    }

    return { fields, update };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Jira client from environment variables
 */
export function createJiraClientFromEnv(): JiraClient {
  const baseClient = createClientFromEnv();

  return new JiraClient({
    cloudId: baseClient.getCloudId(),
    siteUrl: baseClient.getSiteUrl(),
    auth: (baseClient as unknown as { auth: AtlassianClientConfig['auth'] }).auth,
  });
}
