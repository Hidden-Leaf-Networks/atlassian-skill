/**
 * Workflow Manager — Configure board statuses, workflows, and columns.
 *
 * Separate concern from BoardSync: this manages the *configuration*
 * (what statuses exist, what transitions are allowed, what columns show),
 * while BoardSync handles *operational sync* (moving issues to correct columns).
 *
 * Supports workflow presets (e.g., HLN SDLC, Kanban, Scrum) that can be
 * applied to any project.
 */

import { JiraClient } from '../jira/client.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export type StatusCategoryKey = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface WorkflowStatus {
  /** Status name (e.g., "In Development") */
  name: string;
  /** Category: TODO (blue-gray), IN_PROGRESS (yellow), DONE (green) */
  category: StatusCategoryKey;
  /** Description of what this status means */
  description?: string;
}

export interface WorkflowPreset {
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Ordered list of statuses */
  statuses: WorkflowStatus[];
  /** Label-to-status mapping for BoardSync integration */
  labelMapping: Record<string, string>;
}

export interface StatusInfo {
  id: string;
  name: string;
  category: string;
}

export interface WorkflowInfo {
  name: string;
  entityId: string;
  statuses: StatusInfo[];
  transitions: Array<{
    id: string;
    name: string;
    type: string;
    to: string;
  }>;
}

export interface ApplyPresetResult {
  success: boolean;
  /** Statuses that were created */
  createdStatuses: StatusInfo[];
  /** Statuses that already existed */
  existingStatuses: StatusInfo[];
  /** Whether the workflow was updated */
  workflowUpdated: boolean;
  /** Whether the workflow is locked (409 from Jira) */
  workflowLocked: boolean;
  /** Errors encountered */
  errors: string[];
  /** Human-readable summary */
  summary: string;
}

export class WorkflowLockError extends Error {
  constructor(projectKey: string) {
    super(
      `Workflow for project ${projectKey} is locked by Jira ("Other workflow updates are in progress"). ` +
      `This is a known Jira Cloud platform bug that can occur after workflow API calls on simplified workflows. ` +
      `Resolution: Open the Jira board settings UI and manually configure the board columns, ` +
      `or contact Atlassian support to clear the lock.`,
    );
    this.name = 'WorkflowLockError';
  }
}

// =============================================================================
// Workflow Presets
// =============================================================================

/**
 * HLN SDLC Workflow — Full development lifecycle.
 * Todo -> In Planning -> In Development -> Development Complete ->
 * Ready for QA -> In QA -> Verified in QA -> Done
 */
export const HLN_SDLC_PRESET: WorkflowPreset = {
  name: 'HLN SDLC Workflow',
  description: 'Full software development lifecycle with planning and QA stages',
  statuses: [
    { name: 'Todo', category: 'TODO', description: 'Work has not started' },
    { name: 'In Planning', category: 'IN_PROGRESS', description: 'Work is being planned and scoped' },
    { name: 'In Development', category: 'IN_PROGRESS', description: 'Code is being written' },
    { name: 'Development Complete', category: 'IN_PROGRESS', description: 'Code complete, awaiting QA' },
    { name: 'Ready for QA', category: 'IN_PROGRESS', description: 'Ready for quality assurance testing' },
    { name: 'In QA', category: 'IN_PROGRESS', description: 'Being tested by QA' },
    { name: 'Verified in QA', category: 'IN_PROGRESS', description: 'QA verified, ready for release' },
    { name: 'Done', category: 'DONE', description: 'Work is complete' },
  ],
  labelMapping: {
    'todo': 'Todo',
    'planning': 'In Planning',
    'in-development': 'In Development',
    'dev-complete': 'Development Complete',
    'ready-for-qa': 'Ready for QA',
    'in-qa': 'In QA',
    'qa-verified': 'Verified in QA',
    'done': 'Done',
  },
};

/**
 * Simple Kanban — Default Jira simplified workflow.
 * Backlog -> Selected for Development -> In Progress -> Done
 */
export const SIMPLE_KANBAN_PRESET: WorkflowPreset = {
  name: 'Simple Kanban',
  description: 'Default Jira Kanban workflow with 4 columns',
  statuses: [
    { name: 'Backlog', category: 'TODO', description: 'In the backlog' },
    { name: 'Selected for Development', category: 'TODO', description: 'Selected for upcoming work' },
    { name: 'In Progress', category: 'IN_PROGRESS', description: 'Work is in progress' },
    { name: 'Done', category: 'DONE', description: 'Work is complete' },
  ],
  labelMapping: {
    'next': 'Selected for Development',
    'in-progress': 'In Progress',
    'done': 'Done',
  },
};

/**
 * Dev + Review — Development with code review stage.
 * Todo -> In Progress -> In Review -> Done
 */
export const DEV_REVIEW_PRESET: WorkflowPreset = {
  name: 'Dev + Review',
  description: 'Development workflow with code review stage',
  statuses: [
    { name: 'Todo', category: 'TODO', description: 'Work has not started' },
    { name: 'In Progress', category: 'IN_PROGRESS', description: 'Work is in progress' },
    { name: 'In Review', category: 'IN_PROGRESS', description: 'Code review in progress' },
    { name: 'Done', category: 'DONE', description: 'Work is complete' },
  ],
  labelMapping: {
    'in-progress': 'In Progress',
    'in-review': 'In Review',
    'done': 'Done',
  },
};

/** All available presets */
export const WORKFLOW_PRESETS: Record<string, WorkflowPreset> = {
  'hln-sdlc': HLN_SDLC_PRESET,
  'simple-kanban': SIMPLE_KANBAN_PRESET,
  'dev-review': DEV_REVIEW_PRESET,
};

// =============================================================================
// WorkflowManager Class
// =============================================================================

export class WorkflowManager {
  private readonly jiraClient: JiraClient;
  private readonly logger: Logger;

  constructor(jiraClient: JiraClient, logger?: Logger) {
    this.jiraClient = jiraClient;
    this.logger = logger ?? createLoggerFromEnv('workflow-manager');
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  /**
   * Get the current workflow configuration for a project.
   */
  async getProjectWorkflow(projectKey: string): Promise<WorkflowInfo> {
    // Get workflow scheme to find the workflow name
    const project = await this.jiraClient.getProject(projectKey);
    const schemeResponse = await (this.jiraClient as any).get(
      '/rest/api/3/workflowscheme/project',
      { projectId: project.id },
    );

    const scheme = schemeResponse.data?.values?.[0];
    if (!scheme) {
      throw new Error(`No workflow scheme found for project ${projectKey}`);
    }

    const workflowName = scheme.workflowScheme.defaultWorkflow;

    // Get workflow details with statuses and transitions
    const wfResponse = await (this.jiraClient as any).get(
      '/rest/api/3/workflow/search',
      { workflowName, expand: 'statuses,transitions' },
    );

    const workflow = wfResponse.data?.values?.[0];
    if (!workflow) {
      throw new Error(`Workflow "${workflowName}" not found`);
    }

    return {
      name: workflow.id.name,
      entityId: workflow.id.entityId,
      statuses: (workflow.statuses || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.properties?.statusCategory || 'unknown',
      })),
      transitions: (workflow.transitions || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        to: t.to,
      })),
    };
  }

  /**
   * Get all statuses available in the Jira instance.
   * Uses the paginated search endpoint which includes globally-scoped statuses.
   */
  async listStatuses(): Promise<StatusInfo[]> {
    const allStatuses: StatusInfo[] = [];
    let startAt = 0;
    const maxResults = 200;

    for (;;) {
      const response = await (this.jiraClient as any).get('/rest/api/3/statuses/search', {
        startAt,
        maxResults,
      });

      const values = response.data.values || [];
      for (const s of values) {
        allStatuses.push({
          id: s.id,
          name: s.name,
          category: s.statusCategory || s.statusCategory?.key || 'unknown',
        });
      }

      if (response.data.isLast || values.length < maxResults) break;
      startAt += values.length;
    }

    return allStatuses;
  }

  /**
   * Get statuses currently available for a project.
   */
  async getProjectStatuses(projectKey: string): Promise<Record<string, StatusInfo[]>> {
    const response = await (this.jiraClient as any).get(
      `/rest/api/3/project/${projectKey}/statuses`,
    );

    const result: Record<string, StatusInfo[]> = {};
    for (const issueType of response.data) {
      result[issueType.name] = issueType.statuses.map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.statusCategory?.key || 'unknown',
      }));
    }
    return result;
  }

  /**
   * Get board columns configuration.
   */
  async getBoardColumns(boardId: number): Promise<Array<{ name: string; statusIds: string[] }>> {
    const response = await (this.jiraClient as any).get(
      `/rest/agile/1.0/board/${boardId}/configuration`,
    );

    return (response.data.columnConfig?.columns || []).map((col: any) => ({
      name: col.name,
      statusIds: (col.statuses || []).map((s: any) => s.id),
    }));
  }

  // ---------------------------------------------------------------------------
  // Write Operations
  // ---------------------------------------------------------------------------

  /**
   * Create statuses that don't already exist in the Jira instance.
   * Returns all status IDs (both created and pre-existing).
   */
  async ensureStatuses(
    statuses: WorkflowStatus[],
  ): Promise<{ created: StatusInfo[]; existing: StatusInfo[] }> {
    const allExisting = await this.listStatuses();

    // Build a map of name -> all matching statuses (there can be duplicates)
    const existingByName = new Map<string, StatusInfo[]>();
    for (const s of allExisting) {
      const list = existingByName.get(s.name) || [];
      list.push(s);
      existingByName.set(s.name, list);
    }

    const toCreate: WorkflowStatus[] = [];
    const existing: StatusInfo[] = [];

    for (const status of statuses) {
      const matches = existingByName.get(status.name);
      if (matches && matches.length > 0) {
        // Prefer a status with a matching category, otherwise take the first
        const categoryMatch = matches.find(m =>
          m.category === status.category.toLowerCase() ||
          (status.category === 'TODO' && m.category === 'new') ||
          (status.category === 'IN_PROGRESS' && m.category === 'indeterminate') ||
          (status.category === 'DONE' && m.category === 'done'),
        );
        const match = categoryMatch || matches[0];
        existing.push(match);
        this.logger.info(`Status "${status.name}" already exists (ID: ${match.id})`);
      } else {
        toCreate.push(status);
      }
    }

    const created: StatusInfo[] = [];

    if (toCreate.length > 0) {
      this.logger.info(`Creating ${toCreate.length} new statuses`);

      // Try to create all at once; if some already exist, create one-by-one
      try {
        const response = await (this.jiraClient as any).post('/rest/api/3/statuses', {
          statuses: toCreate.map(s => ({
            name: s.name,
            statusCategory: s.category,
            description: s.description || '',
          })),
          scope: { type: 'GLOBAL' },
        });

        for (const s of response.data) {
          created.push({ id: s.id, name: s.name, category: s.statusCategory });
          this.logger.info(`Created status "${s.name}" (ID: ${s.id})`);
        }
      } catch {
        // Bulk create failed — try individually, some may already exist
        this.logger.info('Bulk create failed, trying individually');
        for (const status of toCreate) {
          try {
            const response = await (this.jiraClient as any).post('/rest/api/3/statuses', {
              statuses: [{ name: status.name, statusCategory: status.category, description: status.description || '' }],
              scope: { type: 'GLOBAL' },
            });
            const s = response.data[0];
            created.push({ id: s.id, name: s.name, category: s.statusCategory });
            this.logger.info(`Created status "${s.name}" (ID: ${s.id})`);
          } catch {
            // Status already exists — search for it in the refreshed list
            const refreshed = await this.listStatuses();
            const found = refreshed.find(r => r.name === status.name);
            if (found) {
              existing.push(found);
              this.logger.info(`Status "${status.name}" found after retry (ID: ${found.id})`);
            } else {
              throw new Error(`Cannot create or find status "${status.name}"`);
            }
          }
        }
      }
    }

    return { created, existing };
  }

  /**
   * Update a project's workflow to use the specified statuses.
   * Creates global transitions (any status -> any status).
   */
  async updateWorkflow(
    projectKey: string,
    statuses: StatusInfo[],
  ): Promise<boolean> {
    const workflowInfo = await this.getProjectWorkflow(projectKey);

    // Find the initial (Todo) status — first TODO-category status
    const initialStatus = statuses.find(s =>
      s.category === 'new' || s.category === 'TODO',
    ) || statuses[0];

    // Build transitions
    const globalPF = [
      { type: 'UpdateIssueFieldFunction', configuration: { fieldId: 'resolution', fieldValue: '' } },
      { type: 'UpdateIssueStatusFunction' },
      { type: 'CreateCommentFunction' },
      { type: 'GenerateChangeHistoryFunction' },
      { type: 'IssueReindexFunction' },
      { type: 'FireIssueEventFunction', configuration: { event: { id: '13', name: 'issue_generic' } } },
    ];

    const donePF = [
      { type: 'UpdateIssueFieldFunction', configuration: { fieldId: 'resolution', fieldValue: '10000' } },
      { type: 'UpdateIssueStatusFunction' },
      { type: 'CreateCommentFunction' },
      { type: 'GenerateChangeHistoryFunction' },
      { type: 'IssueReindexFunction' },
      { type: 'FireIssueEventFunction', configuration: { event: { id: '13', name: 'issue_generic' } } },
    ];

    const transitions: any[] = [{
      id: '1',
      name: 'Create',
      description: '',
      from: [],
      to: { statusReference: initialStatus.id },
      type: 'INITIAL',
      rules: {
        validators: [{ type: 'PermissionValidator', configuration: { permissionKey: 'CREATE_ISSUES' } }],
        postFunctions: [
          { type: 'IssueCreateFunction' },
          { type: 'IssueReindexFunction' },
          { type: 'FireIssueEventFunction', configuration: { event: { id: '1', name: 'issue_created' } } },
        ],
      },
    }];

    let tid = 11;
    for (const s of statuses) {
      const isDone = s.category === 'done' || s.category === 'DONE';
      transitions.push({
        id: String(tid),
        name: s.name,
        description: '',
        from: [],
        to: { statusReference: s.id },
        type: 'GLOBAL',
        rules: {
          validators: [],
          postFunctions: isDone ? donePF : globalPF,
        },
      });
      tid += 10;
    }

    this.logger.info(`Updating workflow "${workflowInfo.name}" with ${statuses.length} statuses`);

    try {
      await (this.jiraClient as any).post('/rest/api/3/workflows/update', {
        statuses: statuses.map(s => ({
          id: s.id,
          name: s.name,
          statusReference: s.id,
          statusCategory: s.category === 'new' ? 'TODO' : s.category === 'done' ? 'DONE' :
            s.category === 'indeterminate' ? 'IN_PROGRESS' : s.category,
        })),
        workflows: [{
          version: { versionNumber: 1, id: workflowInfo.entityId },
          id: workflowInfo.entityId,
          statuses: statuses.map(s => ({
            statusReference: s.id,
            properties: { 'jira.issue.editable': 'true' },
          })),
          transitions,
        }],
      });

      this.logger.info('Workflow updated successfully');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to update workflow: ${msg}`);

      // Detect the persistent 409 workflow lock
      if (msg.includes('Other workflow updates are in progress')) {
        throw new WorkflowLockError(projectKey);
      }

      throw new Error(`Failed to update workflow: ${msg}`);
    }
  }

  /**
   * Check if a project's workflow is locked (409 from Jira).
   * Returns true if the workflow cannot be modified via API.
   */
  async isWorkflowLocked(projectKey: string): Promise<boolean> {
    try {
      const workflowInfo = await this.getProjectWorkflow(projectKey);
      // Attempt a no-op update with the existing statuses to test the lock
      const statuses = workflowInfo.statuses;
      if (statuses.length === 0) return false;

      await (this.jiraClient as any).post('/rest/api/3/workflows/update', {
        statuses: statuses.map(s => ({
          id: s.id, name: s.name, statusReference: s.id, statusCategory: s.category,
        })),
        workflows: [{
          version: { versionNumber: 1, id: workflowInfo.entityId },
          id: workflowInfo.entityId,
          statuses: statuses.map(s => ({
            statusReference: s.id,
            properties: { 'jira.issue.editable': 'true' },
          })),
          transitions: workflowInfo.transitions.map(t => ({
            id: t.id, name: t.name, description: '', from: [],
            to: { statusReference: t.to }, type: t.type.toUpperCase(),
            rules: { validators: [], postFunctions: [] },
          })),
        }],
      });
      return false; // If it succeeds, not locked
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return msg.includes('Other workflow updates are in progress');
    }
  }

  // ---------------------------------------------------------------------------
  // Preset Operations
  // ---------------------------------------------------------------------------

  /**
   * Apply a workflow preset to a project.
   * Creates missing statuses and updates the project's workflow.
   */
  async applyPreset(
    projectKey: string,
    presetName: string,
  ): Promise<ApplyPresetResult> {
    const preset = WORKFLOW_PRESETS[presetName];
    if (!preset) {
      const available = Object.keys(WORKFLOW_PRESETS).join(', ');
      throw new Error(`Unknown preset "${presetName}". Available: ${available}`);
    }

    return this.applyWorkflowPreset(projectKey, preset);
  }

  /**
   * Apply a custom workflow preset to a project.
   */
  async applyWorkflowPreset(
    projectKey: string,
    preset: WorkflowPreset,
  ): Promise<ApplyPresetResult> {
    this.logger.info(`Applying "${preset.name}" preset to project ${projectKey}`);

    const errors: string[] = [];

    // Step 1: Ensure all statuses exist
    let createdStatuses: StatusInfo[] = [];
    let existingStatuses: StatusInfo[] = [];

    try {
      const result = await this.ensureStatuses(preset.statuses);
      createdStatuses = result.created;
      existingStatuses = result.existing;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Status creation failed: ${msg}`);
      return {
        success: false,
        createdStatuses: [],
        existingStatuses: [],
        workflowUpdated: false,
        workflowLocked: false,
        errors,
        summary: `Failed to apply "${preset.name}" preset: ${msg}`,
      };
    }

    // Step 2: Update the workflow
    const allStatuses = [...existingStatuses, ...createdStatuses];
    let workflowUpdated = false;
    let workflowLocked = false;

    try {
      workflowUpdated = await this.updateWorkflow(projectKey, allStatuses);
    } catch (err) {
      if (err instanceof WorkflowLockError) {
        workflowLocked = true;
        errors.push(err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Workflow update failed: ${msg}`);
      }
    }

    // Step 3: Build summary
    const lines: string[] = [
      `Applied "${preset.name}" to ${projectKey}:`,
    ];

    if (createdStatuses.length > 0) {
      lines.push(`  Created ${createdStatuses.length} statuses: ${createdStatuses.map(s => s.name).join(', ')}`);
    }

    if (existingStatuses.length > 0) {
      lines.push(`  Reused ${existingStatuses.length} existing statuses: ${existingStatuses.map(s => s.name).join(', ')}`);
    }

    if (workflowUpdated) {
      lines.push('  Workflow updated successfully');
    } else if (workflowLocked) {
      lines.push('  WARNING: Workflow is locked by Jira (known platform bug).');
      lines.push('  Statuses are ready — configure board columns manually in Jira board settings.');
      lines.push(`  Column order: ${preset.statuses.map(s => s.name).join(' -> ')}`);
    } else if (errors.length > 0) {
      lines.push(`  Workflow update failed: ${errors[errors.length - 1]}`);
    }

    if (!workflowLocked) {
      lines.push(`  Board columns: ${preset.statuses.map(s => s.name).join(' -> ')}`);
    }

    return {
      success: errors.length === 0,
      createdStatuses,
      existingStatuses,
      workflowUpdated,
      workflowLocked,
      errors,
      summary: lines.join('\n'),
    };
  }

  /**
   * Get the label mapping for BoardSync integration from a preset.
   */
  getPresetLabelMapping(presetName: string): Record<string, string> {
    const preset = WORKFLOW_PRESETS[presetName];
    if (!preset) {
      throw new Error(`Unknown preset "${presetName}"`);
    }
    return { ...preset.labelMapping };
  }

  /**
   * List available presets.
   */
  listPresets(): Array<{ key: string; name: string; description: string; statuses: string[] }> {
    return Object.entries(WORKFLOW_PRESETS).map(([key, preset]) => ({
      key,
      name: preset.name,
      description: preset.description,
      statuses: preset.statuses.map(s => s.name),
    }));
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createWorkflowManager(
  jiraClient: JiraClient,
  logger?: Logger,
): WorkflowManager {
  return new WorkflowManager(jiraClient, logger);
}
