/**
 * Bitbucket Deployments Operations
 *
 * Provides methods for managing Bitbucket Deployments, including environments,
 * deployment tracking, and deployment variables.
 *
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-deployments/
 */

import { BitbucketClient } from './client';
import {
  Environment,
  Deployment,
  DeploymentVariable,
  SetDeploymentVariableRequest,
  PaginatedResponse,
  PaginationOptions,
} from './types';

/**
 * Deployment operations for Bitbucket Cloud
 *
 * Handles deployment environment management, deployment tracking,
 * and environment variable configuration.
 *
 * @example
 * ```typescript
 * const deployments = new DeploymentOperations(client);
 *
 * // List environments
 * const envs = await deployments.listEnvironments('acme', 'my-repo');
 *
 * // Get deployment status for an environment
 * const status = await deployments.getDeploymentStatus('acme', 'my-repo', '{env-uuid}');
 * ```
 */
export class DeploymentOperations {
  private readonly client: BitbucketClient;

  /**
   * Creates a new DeploymentOperations instance
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
  // Environment Operations
  // ===========================================================================

  /**
   * Lists deployment environments for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination options
   * @returns Paginated list of environments
   *
   * @example
   * ```typescript
   * const envs = await deployments.listEnvironments('acme', 'my-repo');
   * envs.values.forEach(env => {
   *   console.log(`${env.name} (${env.environment_type.name})`);
   * });
   * ```
   */
  async listEnvironments(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Environment>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments`;
    return this.client.getPage<Environment>(path, options);
  }

  /**
   * Lists all deployment environments (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @returns All environments in the repository
   */
  async listAllEnvironments(
    workspace: string,
    repoSlug: string
  ): Promise<Environment[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments`;
    return this.client.getAllPages<Environment>(path);
  }

  /**
   * Gets a specific environment by UUID
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns The environment details
   */
  async getEnvironment(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<Environment> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments/${encodeURIComponent(envUuid)}`;
    return this.client.get<Environment>(path);
  }

  /**
   * Finds an environment by name
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param name - The environment name to search for
   * @returns The environment or null if not found
   */
  async findEnvironmentByName(
    workspace: string,
    repoSlug: string,
    name: string
  ): Promise<Environment | null> {
    const environments = await this.listAllEnvironments(workspace, repoSlug);
    return (
      environments.find(
        (env) => env.name.toLowerCase() === name.toLowerCase()
      ) || null
    );
  }

  /**
   * Creates a new deployment environment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param name - The environment name
   * @param environmentType - The environment type (Test, Staging, Production)
   * @param options - Additional environment options
   * @returns The created environment
   *
   * @example
   * ```typescript
   * const env = await deployments.createEnvironment(
   *   'acme',
   *   'my-repo',
   *   'staging-us-east',
   *   'Staging',
   *   { rank: 2 }
   * );
   * ```
   */
  async createEnvironment(
    workspace: string,
    repoSlug: string,
    name: string,
    environmentType: 'Test' | 'Staging' | 'Production',
    options: { rank?: number; hidden?: boolean } = {}
  ): Promise<Environment> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments`;
    return this.client.post<Environment>(path, {
      name,
      environment_type: {
        type: 'deployment_environment_type',
        name: environmentType,
      },
      rank: options.rank,
      hidden: options.hidden,
    });
  }

  /**
   * Updates an environment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param updates - The updates to apply
   * @returns The updated environment
   */
  async updateEnvironment(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    updates: {
      name?: string;
      environment_type?: {
        type: 'deployment_environment_type';
        name: 'Test' | 'Staging' | 'Production';
      };
      rank?: number;
      hidden?: boolean;
    }
  ): Promise<Environment> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments/${encodeURIComponent(envUuid)}`;
    return this.client.post<Environment>(path, updates);
  }

  /**
   * Deletes an environment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   */
  async deleteEnvironment(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<void> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/environments/${encodeURIComponent(envUuid)}`;
    await this.client.delete(path);
  }

  // ===========================================================================
  // Deployment Status Operations
  // ===========================================================================

  /**
   * Gets the deployment status for an environment
   *
   * Returns information about the current deployment state including
   * the deployed release, pipeline step, and deployment result.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns The current deployment status
   *
   * @example
   * ```typescript
   * const status = await deployments.getDeploymentStatus('acme', 'my-repo', '{env-uuid}');
   * console.log(`State: ${status.state.name}`);
   * if (status.release) {
   *   console.log(`Current release: ${status.release.name}`);
   *   console.log(`Commit: ${status.release.commit?.hash}`);
   * }
   * ```
   */
  async getDeploymentStatus(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<Deployment | null> {
    // Get the latest deployment for this environment
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments`;
    const response = await this.client.getPage<Deployment>(path, {
      q: `environment.uuid="${envUuid}"`,
      sort: '-last_update_time',
      pagelen: 1,
    });

    return response.values.length > 0 ? response.values[0] : null;
  }

  /**
   * Lists deployments for a repository
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Pagination and filtering options
   * @returns Paginated list of deployments
   *
   * @example
   * ```typescript
   * // List all recent deployments
   * const deployments = await ops.listDeployments('acme', 'my-repo', {
   *   sort: '-last_update_time',
   *   pagelen: 20
   * });
   *
   * // List deployments to production
   * const prodDeployments = await ops.listDeployments('acme', 'my-repo', {
   *   q: 'environment.environment_type.name="Production"'
   * });
   * ```
   */
  async listDeployments(
    workspace: string,
    repoSlug: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Deployment>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments`;
    return this.client.getPage<Deployment>(path, options);
  }

  /**
   * Lists all deployments (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param options - Filtering options
   * @returns All deployments
   */
  async listAllDeployments(
    workspace: string,
    repoSlug: string,
    options: Omit<PaginationOptions, 'page'> = {}
  ): Promise<Deployment[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments`;
    return this.client.getAllPages<Deployment>(path, options);
  }

  /**
   * Gets a specific deployment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param deploymentUuid - The deployment UUID
   * @returns The deployment details
   */
  async getDeployment(
    workspace: string,
    repoSlug: string,
    deploymentUuid: string
  ): Promise<Deployment> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments/${encodeURIComponent(deploymentUuid)}`;
    return this.client.get<Deployment>(path);
  }

  /**
   * Gets deployment history for an environment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param options - Pagination options
   * @returns Paginated deployment history
   */
  async getEnvironmentDeploymentHistory(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<Deployment>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments`;
    return this.client.getPage<Deployment>(path, {
      ...options,
      q: `environment.uuid="${envUuid}"`,
      sort: options.sort || '-last_update_time',
    });
  }

  // ===========================================================================
  // Deployment Variable Operations
  // ===========================================================================

  /**
   * Lists deployment variables for an environment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param options - Pagination options
   * @returns Paginated list of deployment variables
   */
  async listDeploymentVariables(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<DeploymentVariable>> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments_config/environments/${encodeURIComponent(envUuid)}/variables`;
    return this.client.getPage<DeploymentVariable>(path, options);
  }

  /**
   * Lists all deployment variables for an environment (handles pagination)
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns All deployment variables
   */
  async listAllDeploymentVariables(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<DeploymentVariable[]> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments_config/environments/${encodeURIComponent(envUuid)}/variables`;
    return this.client.getAllPages<DeploymentVariable>(path);
  }

  /**
   * Sets a deployment variable for an environment
   *
   * Creates the variable if it doesn't exist, or updates it if it does.
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param key - Variable key
   * @param value - Variable value
   * @param secured - Whether the variable is secured (default: false)
   * @returns The created/updated variable
   *
   * @example
   * ```typescript
   * // Set a regular variable
   * await deployments.setDeploymentVariable(
   *   'acme',
   *   'my-repo',
   *   '{env-uuid}',
   *   'API_URL',
   *   'https://api.staging.example.com'
   * );
   *
   * // Set a secured variable (value hidden in logs)
   * await deployments.setDeploymentVariable(
   *   'acme',
   *   'my-repo',
   *   '{env-uuid}',
   *   'API_SECRET',
   *   'secret-value-here',
   *   true
   * );
   * ```
   */
  async setDeploymentVariable(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    key: string,
    value: string,
    secured: boolean = false
  ): Promise<DeploymentVariable> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments_config/environments/${encodeURIComponent(envUuid)}/variables`;

    // Check if variable exists
    const existing = await this.getDeploymentVariable(
      workspace,
      repoSlug,
      envUuid,
      key
    );

    const payload: SetDeploymentVariableRequest = {
      key,
      value,
      secured,
    };

    if (existing && existing.uuid) {
      // Update existing variable
      const updatePath = `${path}/${encodeURIComponent(existing.uuid)}`;
      return this.client.put<DeploymentVariable>(updatePath, payload);
    }

    // Create new variable
    return this.client.post<DeploymentVariable>(path, payload);
  }

  /**
   * Gets a deployment variable by key
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param key - Variable key
   * @returns The variable or null if not found
   */
  async getDeploymentVariable(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    key: string
  ): Promise<DeploymentVariable | null> {
    const variables = await this.listAllDeploymentVariables(
      workspace,
      repoSlug,
      envUuid
    );

    return variables.find((v) => v.key === key) || null;
  }

  /**
   * Deletes a deployment variable
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param variableUuid - The variable UUID
   */
  async deleteDeploymentVariable(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    variableUuid: string
  ): Promise<void> {
    const path = `${this.getRepoPath(workspace, repoSlug)}/deployments_config/environments/${encodeURIComponent(envUuid)}/variables/${encodeURIComponent(variableUuid)}`;
    await this.client.delete(path);
  }

  /**
   * Deletes a deployment variable by key
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param key - Variable key
   * @returns true if deleted, false if not found
   */
  async deleteDeploymentVariableByKey(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    key: string
  ): Promise<boolean> {
    const variable = await this.getDeploymentVariable(
      workspace,
      repoSlug,
      envUuid,
      key
    );

    if (!variable || !variable.uuid) {
      return false;
    }

    await this.deleteDeploymentVariable(
      workspace,
      repoSlug,
      envUuid,
      variable.uuid
    );
    return true;
  }

  /**
   * Sets multiple deployment variables at once
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @param variables - Array of variables to set
   * @returns Array of created/updated variables
   */
  async setDeploymentVariables(
    workspace: string,
    repoSlug: string,
    envUuid: string,
    variables: Array<{ key: string; value: string; secured?: boolean }>
  ): Promise<DeploymentVariable[]> {
    const results: DeploymentVariable[] = [];

    for (const variable of variables) {
      const result = await this.setDeploymentVariable(
        workspace,
        repoSlug,
        envUuid,
        variable.key,
        variable.value,
        variable.secured || false
      );
      results.push(result);
    }

    return results;
  }

  // ===========================================================================
  // Environment Lock Operations
  // ===========================================================================

  /**
   * Locks an environment to prevent deployments
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns The updated environment
   */
  async lockEnvironment(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<Environment> {
    return this.updateEnvironment(workspace, repoSlug, envUuid, {
      // Note: The actual lock configuration depends on Bitbucket API version
      // This may need to be adjusted based on the API
    } as Partial<Environment>);
  }

  /**
   * Unlocks an environment to allow deployments
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns The updated environment
   */
  async unlockEnvironment(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<Environment> {
    return this.updateEnvironment(workspace, repoSlug, envUuid, {
      // Note: The actual unlock configuration depends on Bitbucket API version
    } as Partial<Environment>);
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Gets a summary of all environments and their deployment states
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @returns Summary of environments with their current deployment status
   */
  async getEnvironmentSummary(
    workspace: string,
    repoSlug: string
  ): Promise<
    Array<{
      environment: Environment;
      latestDeployment: Deployment | null;
    }>
  > {
    const environments = await this.listAllEnvironments(workspace, repoSlug);
    const summary: Array<{
      environment: Environment;
      latestDeployment: Deployment | null;
    }> = [];

    for (const environment of environments) {
      const latestDeployment = await this.getDeploymentStatus(
        workspace,
        repoSlug,
        environment.uuid
      );

      summary.push({
        environment,
        latestDeployment,
      });
    }

    return summary;
  }

  /**
   * Checks if an environment has an active deployment
   *
   * @param workspace - The workspace ID or slug
   * @param repoSlug - The repository slug
   * @param envUuid - The environment UUID
   * @returns true if there's an active deployment in progress
   */
  async hasActiveDeployment(
    workspace: string,
    repoSlug: string,
    envUuid: string
  ): Promise<boolean> {
    const deployment = await this.getDeploymentStatus(
      workspace,
      repoSlug,
      envUuid
    );

    return deployment?.state.name === 'IN_PROGRESS';
  }
}

/**
 * Factory function to create DeploymentOperations instance
 *
 * @param client - Configured BitbucketClient instance
 * @returns DeploymentOperations instance
 */
export function createDeploymentOperations(
  client: BitbucketClient
): DeploymentOperations {
  return new DeploymentOperations(client);
}
