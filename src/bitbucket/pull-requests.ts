/**
 * Bitbucket Pull Request Operations
 *
 * Provides methods for managing pull requests, including creation, updates,
 * reviews, merging, and comments.
 *
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/
 */

import { BitbucketClient } from './client';
import {
  PullRequest,
  CreatePullRequestRequest,
  UpdatePullRequestRequest,
  MergePullRequestRequest,
  MergeStrategy,
  Comment,
  CreateCommentRequest,
  InlineLocation,
  ApprovalResponse,
  PaginatedResponse,
  PaginationOptions,
  DiffResponse,
  DiffStatEntry,
  PullRequestReviewer,
} from './types';

/**
 * Pull Request operations for Bitbucket Cloud
 *
 * Handles PR lifecycle management including creation, review workflow,
 * merging, and commenting.
 *
 * @example
 * ```typescript
 * const prs = new PullRequestOperations(client);
 *
 * // Create a new pull request
 * const pr = await prs.createPullRequest('acme', 'my-repo', {
 *   title: 'Add new feature',
 *   source: { branch: { name: 'feature/new-feature' } },
 *   destination: { branch: { name: 'main' } },
 *   description: 'This PR adds a new feature...',
 *   reviewers: [{ uuid: '{user-uuid}' }]
 * });
 * ```
 */
export class PullRequestOperations {
  private readonly client: BitbucketClient;

  /**
   * Creates a new PullRequestOperations instance
   *
   * @param client - Configured BitbucketClient instance
   */
  constructor(client: BitbucketClient) {
    this.client = client;
  }

  /**
   * Builds the base repository path
   */
  private getRepoPath(workspace: string, repoSlug: string): string {
    return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}`;
  }

  /**
   * Builds the pull request path
   */
  private getPRPath(workspace: string, repoSlug: string, prId: number): string {
    return `${this.getRepoPath(workspace, repoSlug)}/pullrequests/${prId}`;
  }

  // ===========================================================================
  // Pull Request CRUD Operations
  // ===========================================================================

  /**
   * Creates a new pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param payload - Pull request creation payload
   * @returns The created pull request
   *
   * @example
   * ```typescript
   * const pr = await prs.createPullRequest('acme', 'my-repo', {
   *   title: 'JIRA-123: Implement new feature',
   *   source: {
   *     branch: { name: 'feature/jira-123' }
   *   },
   *   destination: {
   *     branch: { name: 'develop' }
   *   },
   *   description: '## Summary\n\nThis PR implements...',
   *   close_source_branch: true,
   *   reviewers: [
   *     { uuid: '{user1-uuid}' },
   *     { account_id: 'account-id' }
   *   ]
   * });
   * ```
   */
  async createPullRequest(
    workspace: string,
    repoSlug: string,
    payload: CreatePullRequestRequest
  ): Promise<PullRequest> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pullrequests`;
    return this.client.post<PullRequest>(path, payload);
  }

  /**
   * Retrieves a pull request by ID
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns The pull request details
   *
   * @example
   * ```typescript
   * const pr = await prs.getPullRequest('acme', 'my-repo', 123);
   * console.log(`PR #${pr.id}: ${pr.title}`);
   * console.log(`State: ${pr.state}`);
   * console.log(`Author: ${pr.author.display_name}`);
   * ```
   */
  async getPullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<PullRequest> {
    const path = this.getPRPath(workspace, repoSlug, prId);
    return this.client.get<PullRequest>(path);
  }

  /**
   * Updates an existing pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param changes - The changes to apply
   * @returns The updated pull request
   *
   * @example
   * ```typescript
   * // Update title and description
   * const updated = await prs.updatePullRequest('acme', 'my-repo', 123, {
   *   title: 'Updated: JIRA-123 Implementation',
   *   description: '## Updated Summary\n\nRevised implementation...'
   * });
   *
   * // Add reviewers
   * await prs.updatePullRequest('acme', 'my-repo', 123, {
   *   reviewers: [
   *     { uuid: '{reviewer-uuid}' }
   *   ]
   * });
   * ```
   */
  async updatePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number,
    changes: UpdatePullRequestRequest
  ): Promise<PullRequest> {
    const path = this.getPRPath(workspace, repoSlug, prId);
    return this.client.put<PullRequest>(path, changes);
  }

  /**
   * Declines a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns The declined pull request
   *
   * @example
   * ```typescript
   * const declined = await prs.declinePullRequest('acme', 'my-repo', 123);
   * console.log(`PR state: ${declined.state}`); // 'DECLINED'
   * ```
   */
  async declinePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<PullRequest> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/decline`;
    return this.client.post<PullRequest>(path);
  }

  /**
   * Lists pull requests for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination and filtering options
   * @returns Paginated list of pull requests
   *
   * @example
   * ```typescript
   * // List open PRs
   * const openPRs = await prs.listPullRequests('acme', 'my-repo', {
   *   q: 'state="OPEN"',
   *   sort: '-created_on'
   * });
   *
   * // List PRs by author
   * const myPRs = await prs.listPullRequests('acme', 'my-repo', {
   *   q: 'author.uuid="{my-uuid}" AND state="OPEN"'
   * });
   * ```
   */
  async listPullRequests(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<PullRequest>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pullrequests`;
    return this.client.getPage<PullRequest>(path, options);
  }

  /**
   * Lists all pull requests for a repository (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Filtering options
   * @returns All pull requests matching the criteria
   */
  async listAllPullRequests(
    workspace: string,
    repoSlug: string,
    options: Omit<PaginationOptions, 'page'> = {}
  ): Promise<PullRequest[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pullrequests`;
    return this.client.getAllPages<PullRequest>(path, options);
  }

  // ===========================================================================
  // Review Operations
  // ===========================================================================

  /**
   * Approves a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns The approval response
   *
   * @example
   * ```typescript
   * const approval = await prs.approvePullRequest('acme', 'my-repo', 123);
   * console.log(`Approved by: ${approval.user.display_name}`);
   * ```
   */
  async approvePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<ApprovalResponse> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/approve`;
    return this.client.post<ApprovalResponse>(path);
  }

  /**
   * Removes approval from a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   */
  async unaprovePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<void> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/approve`;
    await this.client.delete(path);
  }

  /**
   * Requests changes on a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns The participant response
   */
  async requestChanges(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<ApprovalResponse> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/request-changes`;
    return this.client.post<ApprovalResponse>(path);
  }

  /**
   * Removes request for changes
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   */
  async removeRequestChanges(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<void> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/request-changes`;
    await this.client.delete(path);
  }

  /**
   * Adds reviewers to a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param reviewers - List of reviewers to add
   * @returns The updated pull request
   */
  async addReviewers(
    workspace: string,
    repoSlug: string,
    prId: number,
    reviewers: PullRequestReviewer[]
  ): Promise<PullRequest> {
    // Get current PR to preserve existing reviewers
    const currentPR = await this.getPullRequest(workspace, repoSlug, prId);
    const existingReviewers = currentPR.reviewers.map((r) => ({
      uuid: r.uuid,
    }));

    const allReviewers = [...existingReviewers, ...reviewers];

    return this.updatePullRequest(workspace, repoSlug, prId, {
      reviewers: allReviewers,
    });
  }

  // ===========================================================================
  // Merge Operations
  // ===========================================================================

  /**
   * Merges a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param options - Merge options
   * @returns The merged pull request
   *
   * @example
   * ```typescript
   * // Simple merge
   * const merged = await prs.mergePullRequest('acme', 'my-repo', 123);
   *
   * // Squash merge with custom message
   * const squashed = await prs.mergePullRequest('acme', 'my-repo', 123, {
   *   merge_strategy: 'squash',
   *   message: 'feat: Add new feature (#123)',
   *   close_source_branch: true
   * });
   * ```
   */
  async mergePullRequest(
    workspace: string,
    repoSlug: string,
    prId: number,
    options: MergePullRequestRequest = {}
  ): Promise<PullRequest> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/merge`;
    return this.client.post<PullRequest>(path, options);
  }

  /**
   * Checks if a pull request can be merged
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns Merge check results
   */
  async canMerge(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<{ can_merge: boolean; reason?: string }> {
    // Bitbucket doesn't have a dedicated endpoint, but we can check PR state
    const pr = await this.getPullRequest(workspace, repoSlug, prId);

    if (pr.state !== 'OPEN') {
      return {
        can_merge: false,
        reason: `Pull request is ${pr.state.toLowerCase()}`,
      };
    }

    // Additional checks could be added here based on PR properties
    return { can_merge: true };
  }

  /**
   * Gets available merge strategies for a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns Available merge strategies
   */
  async getMergeStrategies(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<MergeStrategy[]> {
    const pr = await this.getPullRequest(workspace, repoSlug, prId);

    // Default strategies if not specified in destination branch
    const defaultStrategies: MergeStrategy[] = [
      'merge_commit',
      'squash',
      'fast_forward',
    ];

    // Return from destination branch config if available
    // Note: This would require fetching branch restrictions
    return defaultStrategies;
  }

  // ===========================================================================
  // Comment Operations
  // ===========================================================================

  /**
   * Adds a comment to a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param content - The comment content (raw text/markdown)
   * @param inline - Optional inline location for code comments
   * @returns The created comment
   *
   * @example
   * ```typescript
   * // Add a general comment
   * const comment = await prs.addPRComment(
   *   'acme',
   *   'my-repo',
   *   123,
   *   'LGTM! Great work on this feature.'
   * );
   *
   * // Add an inline comment on a specific file and line
   * const inlineComment = await prs.addPRComment(
   *   'acme',
   *   'my-repo',
   *   123,
   *   'Consider using a constant here.',
   *   { path: 'src/utils.ts', to: 42 }
   * );
   * ```
   */
  async addPRComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    content: string,
    inline?: InlineLocation
  ): Promise<Comment> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments`;
    const payload: CreateCommentRequest = {
      content: {
        raw: content,
      },
    };

    if (inline) {
      payload.inline = inline;
    }

    return this.client.post<Comment>(path, payload);
  }

  /**
   * Adds a reply to an existing comment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param parentId - The ID of the comment to reply to
   * @param content - The reply content
   * @returns The created reply comment
   */
  async replyToComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    parentId: number,
    content: string
  ): Promise<Comment> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments`;
    const payload: CreateCommentRequest = {
      content: {
        raw: content,
      },
      parent: {
        id: parentId,
      },
    };

    return this.client.post<Comment>(path, payload);
  }

  /**
   * Lists comments on a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param options - Pagination options
   * @returns Paginated list of comments
   */
  async listComments(
    workspace: string,
    repoSlug: string,
    prId: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Comment>> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments`;
    return this.client.getPage<Comment>(path, options);
  }

  /**
   * Lists all comments on a pull request (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns All comments on the pull request
   */
  async listAllComments(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<Comment[]> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments`;
    return this.client.getAllPages<Comment>(path);
  }

  /**
   * Gets a specific comment by ID
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param commentId - The comment ID
   * @returns The comment
   */
  async getComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    commentId: number
  ): Promise<Comment> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments/${commentId}`;
    return this.client.get<Comment>(path);
  }

  /**
   * Updates a comment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param commentId - The comment ID
   * @param content - The new comment content
   * @returns The updated comment
   */
  async updateComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    commentId: number,
    content: string
  ): Promise<Comment> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments/${commentId}`;
    return this.client.put<Comment>(path, {
      content: {
        raw: content,
      },
    });
  }

  /**
   * Deletes a comment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param commentId - The comment ID
   */
  async deleteComment(
    workspace: string,
    repoSlug: string,
    prId: number,
    commentId: number
  ): Promise<void> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/comments/${commentId}`;
    await this.client.delete(path);
  }

  // ===========================================================================
  // Diff Operations
  // ===========================================================================

  /**
   * Gets the diff for a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns The raw diff content
   *
   * @example
   * ```typescript
   * const diff = await prs.getPRDiff('acme', 'my-repo', 123);
   * console.log(diff); // Raw unified diff output
   * ```
   */
  async getPRDiff(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<DiffResponse> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/diff`;
    return this.client.getDiff(path);
  }

  /**
   * Gets diff statistics for a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param options - Pagination options
   * @returns Paginated diff statistics
   */
  async getPRDiffStat(
    workspace: string,
    repoSlug: string,
    prId: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<DiffStatEntry>> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/diffstat`;
    return this.client.getPage<DiffStatEntry>(path, options);
  }

  /**
   * Gets all diff statistics for a pull request (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @returns All diff statistics
   */
  async getAllPRDiffStat(
    workspace: string,
    repoSlug: string,
    prId: number
  ): Promise<DiffStatEntry[]> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/diffstat`;
    return this.client.getAllPages<DiffStatEntry>(path);
  }

  // ===========================================================================
  // Activity Operations
  // ===========================================================================

  /**
   * Gets activity log for a pull request
   *
   * Returns a chronological list of activities including comments,
   * approvals, updates, and status changes.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param options - Pagination options
   * @returns Paginated activity log
   */
  async getActivity(
    workspace: string,
    repoSlug: string,
    prId: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/activity`;
    return this.client.getPage<Record<string, unknown>>(path, options);
  }

  /**
   * Gets commits for a pull request
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param prId - The pull request ID
   * @param options - Pagination options
   * @returns Paginated list of commits in the PR
   */
  async getCommits(
    workspace: string,
    repoSlug: string,
    prId: number,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const path = `${this.getPRPath(workspace, repoSlug, prId)}/commits`;
    return this.client.getPage<Record<string, unknown>>(path, options);
  }
}

/**
 * Factory function to create PullRequestOperations instance
 *
 * @param client - Configured BitbucketClient instance
 * @returns PullRequestOperations instance
 */
export function createPullRequestOperations(
  client: BitbucketClient
): PullRequestOperations {
  return new PullRequestOperations(client);
}
