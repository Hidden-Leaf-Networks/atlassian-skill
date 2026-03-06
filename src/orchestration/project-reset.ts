/**
 * Project Reset — Snapshot, delete, and recreate a Jira project.
 *
 * Useful when a project's workflow or board is in an unrecoverable state
 * (e.g., persistent workflow locks). Captures all issue data, deletes the
 * project, recreates it fresh, optionally applies a workflow preset, and
 * restores all issues with their hierarchy and labels.
 */

import { JiraClient } from '../jira/client.js';
import { JiraIssue, JiraIssueCreateInput } from '../jira/types.js';
import { AdfDocument } from '../core/types.js';
import { WorkflowManager } from './workflow-manager.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface IssueSnapshot {
  /** Original issue key (e.g., ATLSK-1) */
  originalKey: string;
  summary: string;
  issueType: string;
  status: string;
  labels: string[];
  description?: AdfDocument;
  /** Original parent key (for hierarchy restoration) */
  parentKey?: string;
  /** Priority name */
  priority?: string;
  /** Comments (body ADF) */
  comments: AdfDocument[];
}

export interface ProjectSnapshot {
  projectKey: string;
  projectName: string;
  projectDescription?: string;
  projectType: 'software' | 'service_desk' | 'business';
  leadAccountId: string;
  issues: IssueSnapshot[];
  capturedAt: string;
}

export interface ResetOptions {
  /** Workflow preset to apply after recreation (e.g., 'hln-sdlc') */
  workflowPreset?: string;
  /** Whether to restore comments (default: false — slower) */
  restoreComments?: boolean;
  /** Whether to transition issues to their original status (default: true) */
  restoreStatuses?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

export interface ResetResult {
  success: boolean;
  snapshot: ProjectSnapshot;
  /** Map of old issue key -> new issue key */
  keyMapping: Record<string, string>;
  /** Whether the workflow preset was applied */
  workflowApplied: boolean;
  /** Issues that failed to recreate */
  errors: Array<{ originalKey: string; error: string }>;
  summary: string;
}

// =============================================================================
// ProjectReset Class
// =============================================================================

export class ProjectReset {
  private readonly jiraClient: JiraClient;
  private readonly logger: Logger;

  constructor(jiraClient: JiraClient, logger?: Logger) {
    this.jiraClient = jiraClient;
    this.logger = logger ?? createLoggerFromEnv('project-reset');
  }

  /**
   * Capture a full snapshot of a project's issues.
   * This is the non-destructive first step — call this before reset.
   */
  async snapshot(projectKey: string, options?: { includeComments?: boolean }): Promise<ProjectSnapshot> {
    this.logger.info(`Snapshotting project ${projectKey}`);

    // Get project metadata
    const project = await this.jiraClient.getProject(projectKey);

    // Fetch all issues
    const issues = await this.fetchAllIssues(projectKey);
    this.logger.info(`Found ${issues.length} issues`);

    const snapshots: IssueSnapshot[] = [];

    for (const issue of issues) {
      const snap: IssueSnapshot = {
        originalKey: issue.key,
        summary: issue.fields.summary,
        issueType: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        labels: (issue.fields as any).labels || [],
        description: issue.fields.description || undefined,
        parentKey: (issue.fields as any).parent?.key,
        priority: issue.fields.priority?.name,
        comments: [],
      };

      if (options?.includeComments) {
        try {
          const response = await this.jiraClient.getComments(issue.key);
          snap.comments = response.comments
            .filter(c => c.body)
            .map(c => c.body);
        } catch {
          // Comments fetch can fail, not critical
        }
      }

      snapshots.push(snap);
    }

    return {
      projectKey: project.key,
      projectName: project.name,
      projectDescription: (project as any).description,
      projectType: (project as any).projectTypeKey || 'software',
      leadAccountId: (project as any).lead?.accountId || '',
      issues: snapshots,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Full project reset: snapshot -> delete -> recreate -> restore issues.
   *
   * WARNING: This is destructive. The project and all issues will be deleted
   * and recreated. Issue keys will change. Attachments and worklogs are lost.
   */
  async reset(projectKey: string, options: ResetOptions = {}): Promise<ResetResult> {
    const progress = options.onProgress || ((msg: string) => this.logger.info(msg));

    // Step 1: Snapshot
    progress(`Step 1/5: Snapshotting ${projectKey}...`);
    const snap = await this.snapshot(projectKey, {
      includeComments: options.restoreComments,
    });
    progress(`  Captured ${snap.issues.length} issues`);

    // Step 2: Get current user for project lead (in case original lead is gone)
    let leadAccountId = snap.leadAccountId;
    if (!leadAccountId) {
      const currentUser = await this.jiraClient.getCurrentUser();
      leadAccountId = currentUser.accountId;
    }

    // Step 3: Delete project
    progress(`Step 2/5: Deleting project ${projectKey}...`);
    await this.jiraClient.deleteProject(projectKey);
    progress(`  Project deleted`);

    // Brief pause to let Jira process the deletion
    await this.wait(3000);

    // Step 4: Recreate project
    progress(`Step 3/5: Recreating project ${projectKey}...`);
    await this.jiraClient.createProject({
      key: snap.projectKey,
      name: snap.projectName,
      description: snap.projectDescription,
      projectTypeKey: snap.projectType,
      leadAccountId,
    });
    progress(`  Project recreated`);

    // Brief pause for project setup
    await this.wait(2000);

    // Step 5: Apply workflow preset
    let workflowApplied = false;
    if (options.workflowPreset) {
      progress(`Step 4/5: Applying workflow preset "${options.workflowPreset}"...`);
      try {
        const wfm = new WorkflowManager(this.jiraClient, this.logger);
        const result = await wfm.applyPreset(snap.projectKey, options.workflowPreset);
        workflowApplied = result.workflowUpdated;
        if (result.workflowLocked) {
          progress(`  WARNING: Workflow locked again. Statuses exist but board needs manual config.`);
        } else if (workflowApplied) {
          progress(`  Workflow preset applied successfully`);
        } else {
          progress(`  Workflow preset partially applied: ${result.errors.join('; ')}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        progress(`  Workflow preset failed: ${msg}`);
      }
    } else {
      progress(`Step 4/5: Skipping workflow preset (none specified)`);
    }

    // Step 6: Restore issues
    progress(`Step 5/5: Restoring ${snap.issues.length} issues...`);
    const { keyMapping, errors } = await this.restoreIssues(
      snap,
      options.restoreStatuses !== false,
      options.restoreComments || false,
      progress,
    );

    // Build summary
    const restored = Object.keys(keyMapping).length;
    const lines = [
      `Project ${snap.projectKey} reset complete:`,
      `  Issues restored: ${restored}/${snap.issues.length}`,
      `  Workflow preset: ${workflowApplied ? 'applied' : options.workflowPreset ? 'failed/partial' : 'none'}`,
    ];
    if (errors.length > 0) {
      lines.push(`  Errors: ${errors.length}`);
    }

    return {
      success: errors.length === 0,
      snapshot: snap,
      keyMapping,
      workflowApplied,
      errors,
      summary: lines.join('\n'),
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async fetchAllIssues(projectKey: string): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    const pageSize = 100;

    for (;;) {
      const results = await this.jiraClient.searchIssues({
        jql: `project = ${projectKey} ORDER BY key ASC`,
        maxResults: pageSize,
        startAt: allIssues.length,
        fields: ['summary', 'status', 'issuetype', 'labels', 'parent', 'description', 'priority', 'comment'],
      });

      allIssues.push(...results.issues);
      if (results.issues.length < pageSize) break;
    }

    return allIssues;
  }

  private async restoreIssues(
    snap: ProjectSnapshot,
    restoreStatuses: boolean,
    restoreComments: boolean,
    progress: (msg: string) => void,
  ): Promise<{ keyMapping: Record<string, string>; errors: ResetResult['errors'] }> {
    const keyMapping: Record<string, string> = {};
    const errors: ResetResult['errors'] = [];

    // Separate epics from non-epics — epics must be created first for parent linking
    const epics = snap.issues.filter(i => i.issueType === 'Epic');
    const nonEpics = snap.issues.filter(i => i.issueType !== 'Epic');

    // Phase 1: Create epics
    for (const issue of epics) {
      try {
        const newKey = await this.createIssueFromSnapshot(snap.projectKey, issue);
        keyMapping[issue.originalKey] = newKey;
        progress(`  ${issue.originalKey} -> ${newKey} (${issue.issueType})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ originalKey: issue.originalKey, error: msg });
        progress(`  ${issue.originalKey} FAILED: ${msg}`);
      }
    }

    // Phase 2: Create non-epics (with parent mapping)
    for (const issue of nonEpics) {
      try {
        // Remap parent key to new key
        const parentKey = issue.parentKey ? keyMapping[issue.parentKey] : undefined;
        const newKey = await this.createIssueFromSnapshot(snap.projectKey, issue, parentKey);
        keyMapping[issue.originalKey] = newKey;
        progress(`  ${issue.originalKey} -> ${newKey} (${issue.issueType}${parentKey ? ` child of ${parentKey}` : ''})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ originalKey: issue.originalKey, error: msg });
        progress(`  ${issue.originalKey} FAILED: ${msg}`);
      }
    }

    // Phase 3: Transition issues to original status
    if (restoreStatuses) {
      progress(`  Restoring statuses...`);
      for (const issue of snap.issues) {
        const newKey = keyMapping[issue.originalKey];
        if (!newKey) continue;

        try {
          await this.transitionToStatus(newKey, issue.status);
        } catch {
          // Status transition failures are non-critical
        }
      }
    }

    // Phase 4: Restore comments
    if (restoreComments) {
      progress(`  Restoring comments...`);
      for (const issue of snap.issues) {
        const newKey = keyMapping[issue.originalKey];
        if (!newKey || issue.comments.length === 0) continue;

        for (const comment of issue.comments) {
          try {
            await this.jiraClient.addComment(newKey, { body: comment });
          } catch {
            // Comment restoration failures are non-critical
          }
        }
      }
    }

    return { keyMapping, errors };
  }

  private async createIssueFromSnapshot(
    projectKey: string,
    issue: IssueSnapshot,
    parentKey?: string,
  ): Promise<string> {
    const input: JiraIssueCreateInput = {
      project: projectKey,
      issuetype: issue.issueType,
      summary: issue.summary,
      labels: issue.labels,
    };

    if (issue.description) {
      input.description = issue.description;
    }

    if (issue.priority) {
      input.priority = { name: issue.priority };
    }

    if (parentKey) {
      input.parent = { key: parentKey };
    }

    const result = await this.jiraClient.createIssue(input);
    return result.key;
  }

  private async transitionToStatus(issueKey: string, targetStatus: string): Promise<void> {
    const transitions = await this.jiraClient.getTransitions(issueKey);
    const match = transitions.find(t =>
      t.to.name.toLowerCase() === targetStatus.toLowerCase() ||
      t.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (match) {
      await this.jiraClient.transitionIssue(issueKey, { transitionId: match.id });
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createProjectReset(jiraClient: JiraClient, logger?: Logger): ProjectReset {
  return new ProjectReset(jiraClient, logger);
}
