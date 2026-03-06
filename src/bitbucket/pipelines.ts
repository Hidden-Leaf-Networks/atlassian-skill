/**
 * Bitbucket Pipelines Operations
 *
 * Provides methods for managing Bitbucket Pipelines CI/CD, including
 * triggering builds, monitoring status, and managing pipeline steps.
 *
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pipelines/
 */

import { BitbucketClient } from './client';
import {
  Pipeline,
  PipelineStep,
  PipelineVariable,
  TriggerPipelineRequest,
  StopPipelineResponse,
  PaginatedResponse,
  PaginationOptions,
  WaitForPipelineOptions,
  PipelineStateType,
} from './types';

/**
 * Default options for waiting on pipeline completion
 */
const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds
const DEFAULT_TIMEOUT = 3600000; // 1 hour

/**
 * Terminal pipeline states that indicate completion
 */
const TERMINAL_STATES: PipelineStateType[] = ['COMPLETED', 'HALTED'];

/**
 * Pipeline operations for Bitbucket Cloud
 *
 * Handles CI/CD pipeline management including triggering builds,
 * monitoring status, and retrieving build logs.
 *
 * @example
 * ```typescript
 * const pipelines = new PipelineOperations(client);
 *
 * // Trigger a pipeline on a branch
 * const pipeline = await pipelines.triggerPipeline('acme', 'my-repo', {
 *   target: {
 *     type: 'pipeline_ref_target',
 *     ref_type: 'branch',
 *     ref_name: 'main'
 *   }
 * });
 *
 * // Wait for completion
 * const result = await pipelines.waitForPipeline('acme', 'my-repo', pipeline.uuid);
 * ```
 */
export class PipelineOperations {
  private readonly client: BitbucketClient;

  /**
   * Creates a new PipelineOperations instance
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
   * Builds the pipeline path
   */
  private getPipelinePath(
    workspace: string,
    repoSlug: string,
    uuid: string
  ): string {
    return `${this.getRepoPath(workspace, repoSlug)}/pipelines/${encodeURIComponent(uuid)}`;
  }

  // ===========================================================================
  // Pipeline Trigger Operations
  // ===========================================================================

  /**
   * Triggers a new pipeline build
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param payload - Pipeline trigger configuration
   * @returns The triggered pipeline
   *
   * @example
   * ```typescript
   * // Trigger pipeline on a branch
   * const pipeline = await pipelines.triggerPipeline('acme', 'my-repo', {
   *   target: {
   *     type: 'pipeline_ref_target',
   *     ref_type: 'branch',
   *     ref_name: 'develop'
   *   }
   * });
   *
   * // Trigger custom pipeline with variables
   * const customPipeline = await pipelines.triggerPipeline('acme', 'my-repo', {
   *   target: {
   *     type: 'pipeline_ref_target',
   *     ref_type: 'branch',
   *     ref_name: 'main',
   *     selector: {
   *       type: 'custom',
   *       pattern: 'deploy-to-staging'
   *     }
   *   },
   *   variables: [
   *     { key: 'DEPLOY_ENV', value: 'staging', secured: false },
   *     { key: 'API_KEY', value: 'secret', secured: true }
   *   ]
   * });
   *
   * // Trigger pipeline on a specific commit
   * const commitPipeline = await pipelines.triggerPipeline('acme', 'my-repo', {
   *   target: {
   *     type: 'pipeline_commit_target',
   *     commit: {
   *       type: 'commit',
   *       hash: 'abc123def456'
   *     }
   *   }
   * });
   * ```
   */
  async triggerPipeline(
    workspace: string,
    repoSlug: string,
    payload: TriggerPipelineRequest
  ): Promise<Pipeline> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines`;
    return this.client.post<Pipeline>(path, payload);
  }

  /**
   * Convenience method to trigger a pipeline on a branch
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param branchName - The branch name
   * @param variables - Optional pipeline variables
   * @returns The triggered pipeline
   */
  async triggerBranchPipeline(
    workspace: string,
    repoSlug: string,
    branchName: string,
    variables?: PipelineVariable[]
  ): Promise<Pipeline> {
    return this.triggerPipeline(workspace, repoSlug, {
      target: {
        type: 'pipeline_ref_target',
        ref_type: 'branch',
        ref_name: branchName,
      },
      variables,
    });
  }

  /**
   * Convenience method to trigger a custom pipeline
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param branchName - The branch name
   * @param pipelineName - The custom pipeline name (as defined in bitbucket-pipelines.yml)
   * @param variables - Optional pipeline variables
   * @returns The triggered pipeline
   */
  async triggerCustomPipeline(
    workspace: string,
    repoSlug: string,
    branchName: string,
    pipelineName: string,
    variables?: PipelineVariable[]
  ): Promise<Pipeline> {
    return this.triggerPipeline(workspace, repoSlug, {
      target: {
        type: 'pipeline_ref_target',
        ref_type: 'branch',
        ref_name: branchName,
        selector: {
          type: 'custom',
          pattern: pipelineName,
        },
      },
      variables,
    });
  }

  // ===========================================================================
  // Pipeline Status Operations
  // ===========================================================================

  /**
   * Gets the status of a pipeline
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param uuid - The pipeline UUID
   * @returns The pipeline details
   *
   * @example
   * ```typescript
   * const pipeline = await pipelines.getPipelineStatus('acme', 'my-repo', '{uuid}');
   * console.log(`State: ${pipeline.state.name}`);
   * if (pipeline.state.result) {
   *   console.log(`Result: ${pipeline.state.result.name}`);
   * }
   * ```
   */
  async getPipelineStatus(
    workspace: string,
    repoSlug: string,
    uuid: string
  ): Promise<Pipeline> {
    const path = this.getPipelinePath(workspace, repoSlug, uuid);
    return this.client.get<Pipeline>(path);
  }

  /**
   * Lists pipelines for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination and filtering options
   * @returns Paginated list of pipelines
   *
   * @example
   * ```typescript
   * // List recent pipelines
   * const pipelines = await ops.listPipelines('acme', 'my-repo', {
   *   sort: '-created_on',
   *   pagelen: 20
   * });
   *
   * // List pipelines for a specific branch
   * const branchPipelines = await ops.listPipelines('acme', 'my-repo', {
   *   q: 'target.ref_name="main"'
   * });
   * ```
   */
  async listPipelines(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Pipeline>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines`;
    return this.client.getPage<Pipeline>(path, options);
  }

  /**
   * Gets the most recent pipeline for a branch
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param branchName - The branch name
   * @returns The most recent pipeline or null if none found
   */
  async getLatestPipelineForBranch(
    workspace: string,
    repoSlug: string,
    branchName: string
  ): Promise<Pipeline | null> {
    const response = await this.listPipelines(workspace, repoSlug, {
      q: `target.ref_name="${branchName}"`,
      sort: '-created_on',
      pagelen: 1,
    });

    return response.values.length > 0 ? response.values[0] : null;
  }

  // ===========================================================================
  // Pipeline Step Operations
  // ===========================================================================

  /**
   * Gets the steps of a pipeline
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param uuid - The pipeline UUID
   * @param options - Pagination options
   * @returns Paginated list of pipeline steps
   *
   * @example
   * ```typescript
   * const steps = await pipelines.getPipelineSteps('acme', 'my-repo', '{uuid}');
   * steps.values.forEach(step => {
   *   console.log(`${step.name}: ${step.state.name}`);
   *   if (step.duration_in_seconds) {
   *     console.log(`Duration: ${step.duration_in_seconds}s`);
   *   }
   * });
   * ```
   */
  async getPipelineSteps(
    workspace: string,
    repoSlug: string,
    uuid: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<PipelineStep>> {
    const path = `${this.getPipelinePath(workspace, repoSlug, uuid)}/steps`;
    return this.client.getPage<PipelineStep>(path, options);
  }

  /**
   * Gets all steps of a pipeline (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param uuid - The pipeline UUID
   * @returns All pipeline steps
   */
  async getAllPipelineSteps(
    workspace: string,
    repoSlug: string,
    uuid: string
  ): Promise<PipelineStep[]> {
    const path = `${this.getPipelinePath(workspace, repoSlug, uuid)}/steps`;
    return this.client.getAllPages<PipelineStep>(path);
  }

  /**
   * Gets a specific step of a pipeline
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param pipelineUuid - The pipeline UUID
   * @param stepUuid - The step UUID
   * @returns The pipeline step
   */
  async getPipelineStep(
    workspace: string,
    repoSlug: string,
    pipelineUuid: string,
    stepUuid: string
  ): Promise<PipelineStep> {
    const path = `${this.getPipelinePath(workspace, repoSlug, pipelineUuid)}/steps/${encodeURIComponent(stepUuid)}`;
    return this.client.get<PipelineStep>(path);
  }

  /**
   * Gets the log for a pipeline step
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param pipelineUuid - The pipeline UUID
   * @param stepUuid - The step UUID
   * @returns The log content as text
   */
  async getStepLog(
    workspace: string,
    repoSlug: string,
    pipelineUuid: string,
    stepUuid: string
  ): Promise<string> {
    const path = `${this.getPipelinePath(workspace, repoSlug, pipelineUuid)}/steps/${encodeURIComponent(stepUuid)}/log`;
    return this.client.request<string>(path, {
      method: 'GET',
      responseType: 'text',
      headers: {
        Accept: 'text/plain',
      },
    });
  }

  // ===========================================================================
  // Pipeline Control Operations
  // ===========================================================================

  /**
   * Stops a running pipeline
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param uuid - The pipeline UUID
   * @returns The stopped pipeline response
   *
   * @example
   * ```typescript
   * const stopped = await pipelines.stopPipeline('acme', 'my-repo', '{uuid}');
   * console.log(`Pipeline ${stopped.uuid} stopped`);
   * ```
   */
  async stopPipeline(
    workspace: string,
    repoSlug: string,
    uuid: string
  ): Promise<StopPipelineResponse> {
    const path = `${this.getPipelinePath(workspace, repoSlug, uuid)}/stopPipeline`;
    return this.client.post<StopPipelineResponse>(path);
  }

  // ===========================================================================
  // Pipeline Wait Operations
  // ===========================================================================

  /**
   * Waits for a pipeline to complete
   *
   * Polls the pipeline status at regular intervals until it reaches a
   * terminal state (COMPLETED or HALTED) or the timeout is reached.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param uuid - The pipeline UUID
   * @param options - Wait options (poll interval, timeout, callbacks)
   * @returns The completed pipeline
   * @throws Error if timeout is reached before completion
   *
   * @example
   * ```typescript
   * // Simple wait with defaults (10s poll, 1hr timeout)
   * const completed = await pipelines.waitForPipeline('acme', 'my-repo', '{uuid}');
   *
   * // Custom options with status callback
   * const result = await pipelines.waitForPipeline('acme', 'my-repo', '{uuid}', {
   *   pollInterval: 5000, // 5 seconds
   *   timeout: 1800000,   // 30 minutes
   *   onStatusChange: (pipeline) => {
   *     console.log(`Status: ${pipeline.state.name}`);
   *   }
   * });
   *
   * if (result.state.result?.name === 'SUCCESSFUL') {
   *   console.log('Pipeline succeeded!');
   * } else {
   *   console.log(`Pipeline failed: ${result.state.result?.name}`);
   * }
   * ```
   */
  async waitForPipeline(
    workspace: string,
    repoSlug: string,
    uuid: string,
    options: WaitForPipelineOptions = {}
  ): Promise<Pipeline> {
    const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const startTime = Date.now();

    let lastState: PipelineStateType | null = null;

    for (;;) {
      const pipeline = await this.getPipelineStatus(workspace, repoSlug, uuid);
      const currentState = pipeline.state.name;

      // Call callback if state changed
      if (options.onStatusChange && currentState !== lastState) {
        options.onStatusChange(pipeline);
        lastState = currentState;
      }

      // Check if pipeline is in terminal state
      if (TERMINAL_STATES.includes(currentState)) {
        return pipeline;
      }

      // Check timeout
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        throw new PipelineTimeoutError(
          `Pipeline ${uuid} did not complete within ${timeout}ms`,
          pipeline
        );
      }

      // Wait before next poll
      await this.sleep(pollInterval);
    }
  }

  /**
   * Triggers a pipeline and waits for completion
   *
   * Convenience method that combines triggerPipeline and waitForPipeline.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param payload - Pipeline trigger configuration
   * @param waitOptions - Wait options
   * @returns The completed pipeline
   */
  async triggerAndWait(
    workspace: string,
    repoSlug: string,
    payload: TriggerPipelineRequest,
    waitOptions: WaitForPipelineOptions = {}
  ): Promise<Pipeline> {
    const pipeline = await this.triggerPipeline(workspace, repoSlug, payload);
    return this.waitForPipeline(workspace, repoSlug, pipeline.uuid, waitOptions);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Pipeline Variable Operations
  // ===========================================================================

  /**
   * Lists repository-level pipeline variables
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination options
   * @returns Paginated list of variables
   */
  async listRepositoryVariables(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<PipelineVariable>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines_config/variables`;
    return this.client.getPage<PipelineVariable>(path, options);
  }

  /**
   * Creates or updates a repository-level pipeline variable
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param key - Variable key
   * @param value - Variable value
   * @param secured - Whether the variable is secured (hidden in logs)
   * @returns The created/updated variable
   */
  async setRepositoryVariable(
    workspace: string,
    repoSlug: string,
    key: string,
    value: string,
    secured: boolean = false
  ): Promise<PipelineVariable> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines_config/variables`;

    // Check if variable exists
    const existing = await this.getRepositoryVariable(workspace, repoSlug, key);

    if (existing) {
      // Update existing variable
      const updatePath = `${path}/${encodeURIComponent(existing.uuid!)}`;
      return this.client.put<PipelineVariable>(updatePath, {
        key,
        value,
        secured,
      });
    }

    // Create new variable
    return this.client.post<PipelineVariable>(path, {
      key,
      value,
      secured,
    });
  }

  /**
   * Gets a specific repository variable by key
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param key - Variable key
   * @returns The variable or null if not found
   */
  async getRepositoryVariable(
    workspace: string,
    repoSlug: string,
    key: string
  ): Promise<PipelineVariable | null> {
    try {
      const response = await this.listRepositoryVariables(workspace, repoSlug, {
        q: `key="${key}"`,
        pagelen: 1,
      });

      return response.values.length > 0 ? response.values[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Deletes a repository-level pipeline variable
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param variableUuid - The variable UUID
   */
  async deleteRepositoryVariable(
    workspace: string,
    repoSlug: string,
    variableUuid: string
  ): Promise<void> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines_config/variables/${encodeURIComponent(variableUuid)}`;
    await this.client.delete(path);
  }

  // ===========================================================================
  // Pipeline Configuration
  // ===========================================================================

  /**
   * Gets the pipeline configuration for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @returns Pipeline configuration
   */
  async getPipelineConfig(
    workspace: string,
    repoSlug: string
  ): Promise<{ enabled: boolean }> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines_config`;
    return this.client.get<{ enabled: boolean }>(path);
  }

  /**
   * Enables or disables pipelines for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param enabled - Whether pipelines should be enabled
   * @returns Updated configuration
   */
  async setPipelineConfig(
    workspace: string,
    repoSlug: string,
    enabled: boolean
  ): Promise<{ enabled: boolean }> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/pipelines_config`;
    return this.client.put<{ enabled: boolean }>(path, { enabled });
  }
}

/**
 * Error thrown when a pipeline timeout is reached
 */
export class PipelineTimeoutError extends Error {
  public readonly pipeline: Pipeline;

  constructor(message: string, pipeline: Pipeline) {
    super(message);
    this.name = 'PipelineTimeoutError';
    this.pipeline = pipeline;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PipelineTimeoutError);
    }
  }
}

/**
 * Factory function to create PipelineOperations instance
 *
 * @param client - Configured BitbucketClient instance
 * @returns PipelineOperations instance
 */
export function createPipelineOperations(
  client: BitbucketClient
): PipelineOperations {
  return new PipelineOperations(client);
}
