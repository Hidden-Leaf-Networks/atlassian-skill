/**
 * Bitbucket Repository Operations
 *
 * Provides methods for managing repositories, branches, and related operations.
 *
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/
 */

import { BitbucketClient } from './client';
import {
  Repository,
  Branch,
  CreateBranchRequest,
  PaginatedResponse,
  PaginationOptions,
  DiffResponse,
  DiffStatEntry,
} from './types';

/**
 * Repository operations for Bitbucket Cloud
 *
 * Handles repository management, branch operations, and diff retrieval.
 *
 * @example
 * ```typescript
 * const repos = new RepositoryOperations(client);
 *
 * // Get repository details
 * const repo = await repos.getRepository('my-workspace', 'my-repo');
 *
 * // List all branches
 * const branches = await repos.listBranches('my-workspace', 'my-repo');
 * ```
 */
export class RepositoryOperations {
  private readonly client: BitbucketClient;

  /**
   * Creates a new RepositoryOperations instance
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

  // ===========================================================================
  // Repository Operations
  // ===========================================================================

  /**
   * Retrieves a repository by workspace and slug
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @returns The repository details
   *
   * @example
   * ```typescript
   * const repo = await repos.getRepository('acme', 'my-project');
   * console.log(`Repository: ${repo.full_name}`);
   * console.log(`Default branch: ${repo.mainbranch?.name}`);
   * ```
   */
  async getRepository(workspace: string, repoSlug: string): Promise<Repository> {
    const path = this.getRepoPath(workspace, repoSlug);
    return this.client.get<Repository>(path);
  }

  /**
   * Lists repositories in a workspace
   *
   * @param workspace - The workspace ID or slug
   * @param options - Pagination and filtering options
   * @returns Paginated list of repositories
   *
   * @example
   * ```typescript
   * // List all repositories with custom pagination
   * const response = await repos.listRepositories('my-workspace', {
   *   pagelen: 50,
   *   sort: '-updated_on'
   * });
   * ```
   */
  async listRepositories(
    workspace: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Repository>> {
    const path = `/repositories/${encodeURIComponent(workspace)}`;
    return this.client.getPage<Repository>(path, options);
  }

  /**
   * Lists all repositories in a workspace (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param options - Filtering options
   * @returns All repositories in the workspace
   */
  async listAllRepositories(
    workspace: string,
    options: Omit<PaginationOptions, 'page'> = {}
  ): Promise<Repository[]> {
    const path = `/repositories/${encodeURIComponent(workspace)}`;
    return this.client.getAllPages<Repository>(path, options);
  }

  // ===========================================================================
  // Branch Operations
  // ===========================================================================

  /**
   * Lists branches in a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination and filtering options
   * @returns Paginated list of branches
   *
   * @example
   * ```typescript
   * // List branches sorted by name
   * const branches = await repos.listBranches('acme', 'my-project', {
   *   sort: 'name',
   *   pagelen: 100
   * });
   * ```
   */
  async listBranches(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Branch>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/branches`;
    return this.client.getPage<Branch>(path, options);
  }

  /**
   * Lists all branches in a repository (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Filtering options
   * @returns All branches in the repository
   */
  async listAllBranches(
    workspace: string,
    repoSlug: string,
    options: Omit<PaginationOptions, 'page'> = {}
  ): Promise<Branch[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/branches`;
    return this.client.getAllPages<Branch>(path, options);
  }

  /**
   * Gets a specific branch by name
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param branchName - The branch name
   * @returns The branch details
   *
   * @example
   * ```typescript
   * const branch = await repos.getBranch('acme', 'my-project', 'develop');
   * console.log(`Latest commit: ${branch.target.hash}`);
   * ```
   */
  async getBranch(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): Promise<Branch> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/branches/${encodeURIComponent(branchName)}`;
    return this.client.get<Branch>(path);
  }

  /**
   * Creates a new branch
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param name - The name for the new branch
   * @param target - The commit hash to create the branch from
   * @returns The created branch
   *
   * @example
   * ```typescript
   * // Create a feature branch from main
   * const mainBranch = await repos.getBranch('acme', 'my-project', 'main');
   * const newBranch = await repos.createBranch(
   *   'acme',
   *   'my-project',
   *   'feature/new-feature',
   *   mainBranch.target.hash
   * );
   * ```
   */
  async createBranch(
    workspace: string,
    repoSlug: string,
    name: string,
    target: string
  ): Promise<Branch> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/branches`;
    const payload: CreateBranchRequest = {
      name,
      target: {
        hash: target,
      },
    };
    return this.client.post<Branch>(path, payload);
  }

  /**
   * Deletes a branch
   *
   * Note: The main/default branch cannot be deleted.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param branchName - The name of the branch to delete
   *
   * @example
   * ```typescript
   * // Delete a merged feature branch
   * await repos.deleteBranch('acme', 'my-project', 'feature/completed-feature');
   * ```
   */
  async deleteBranch(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): Promise<void> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/branches/${encodeURIComponent(branchName)}`;
    await this.client.delete(path);
  }

  // ===========================================================================
  // Diff Operations
  // ===========================================================================

  /**
   * Gets the diff for a commit spec
   *
   * The spec can be a commit hash, a range (hash1..hash2), or a branch name.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param spec - The commit spec (hash, range, or branch)
   * @returns The raw diff content
   *
   * @example
   * ```typescript
   * // Get diff for a specific commit
   * const diff = await repos.getDiff('acme', 'my-project', 'abc123');
   *
   * // Get diff between two commits
   * const rangeDiff = await repos.getDiff('acme', 'my-project', 'abc123..def456');
   *
   * // Get diff for a branch compared to main
   * const branchDiff = await repos.getDiff('acme', 'my-project', 'main..feature');
   * ```
   */
  async getDiff(
    workspace: string,
    repoSlug: string,
    spec: string
  ): Promise<DiffResponse> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/diff/${encodeURIComponent(spec)}`;
    return this.client.getDiff(path);
  }

  /**
   * Gets diff statistics for a commit spec
   *
   * Returns information about which files were changed and how many lines
   * were added/removed.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param spec - The commit spec (hash, range, or branch)
   * @param options - Pagination options
   * @returns Paginated list of diff statistics per file
   *
   * @example
   * ```typescript
   * const stats = await repos.getDiffStat('acme', 'my-project', 'abc123');
   * stats.values.forEach(file => {
   *   console.log(`${file.new?.path}: +${file.lines_added} -${file.lines_removed}`);
   * });
   * ```
   */
  async getDiffStat(
    workspace: string,
    repoSlug: string,
    spec: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<DiffStatEntry>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/diffstat/${encodeURIComponent(spec)}`;
    return this.client.getPage<DiffStatEntry>(path, options);
  }

  /**
   * Gets all diff statistics for a commit spec (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param spec - The commit spec
   * @returns All diff statistics
   */
  async getAllDiffStat(
    workspace: string,
    repoSlug: string,
    spec: string
  ): Promise<DiffStatEntry[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/diffstat/${encodeURIComponent(spec)}`;
    return this.client.getAllPages<DiffStatEntry>(path);
  }

  // ===========================================================================
  // Commit Operations
  // ===========================================================================

  /**
   * Gets a specific commit by hash
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param commitHash - The commit hash (full or abbreviated)
   * @returns The commit details
   */
  async getCommit(
    workspace: string,
    repoSlug: string,
    commitHash: string
  ): Promise<Branch['target']> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/commit/${encodeURIComponent(commitHash)}`;
    return this.client.get<Branch['target']>(path);
  }

  // ===========================================================================
  // Tag Operations
  // ===========================================================================

  /**
   * Lists tags in a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination options
   * @returns Paginated list of tags
   */
  async listTags(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Branch>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/tags`;
    return this.client.getPage<Branch>(path, options);
  }

  /**
   * Creates a new tag
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param name - The tag name
   * @param target - The commit hash to tag
   * @returns The created tag
   */
  async createTag(
    workspace: string,
    repoSlug: string,
    name: string,
    target: string
  ): Promise<Branch> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/tags`;
    const payload = {
      name,
      target: {
        hash: target,
      },
    };
    return this.client.post<Branch>(path, payload);
  }

  /**
   * Deletes a tag
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param tagName - The tag name to delete
   */
  async deleteTag(
    workspace: string,
    repoSlug: string,
    tagName: string
  ): Promise<void> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/refs/tags/${encodeURIComponent(tagName)}`;
    await this.client.delete(path);
  }
}

/**
 * Factory function to create RepositoryOperations instance
 *
 * @param client - Configured BitbucketClient instance
 * @returns RepositoryOperations instance
 */
export function createRepositoryOperations(
  client: BitbucketClient
): RepositoryOperations {
  return new RepositoryOperations(client);
}
