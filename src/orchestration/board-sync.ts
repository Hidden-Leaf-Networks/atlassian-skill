/**
 * Board Sync — Review codebase state and sync Jira board status.
 *
 * One-shot operation: analyzes issue labels/metadata and transitions
 * issues to the correct board column. Designed to be called as a
 * single skill command: "sync the board" / "update issue statuses".
 */

import { JiraClient } from '../jira/client.js';
import { JiraIssue } from '../jira/types.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export interface BoardSyncConfig {
  projectKey: string;
  /** Map of label -> target status name */
  labelToStatus: Record<string, string>;
  /** Map of status name -> transition ID (board-specific) */
  statusTransitions: Record<string, string>;
  /** Labels that indicate an issue should stay in backlog */
  backlogLabels?: string[];
}

export interface BoardSyncResult {
  totalIssues: number;
  transitioned: Array<{
    key: string;
    summary: string;
    from: string;
    to: string;
  }>;
  skipped: number;
  errors: Array<{ key: string; error: string }>;
  summary: string;
}

// =============================================================================
// Default Kanban config
// =============================================================================

const DEFAULT_KANBAN_CONFIG: Omit<BoardSyncConfig, 'projectKey'> = {
  labelToStatus: {
    done: 'Done',
    'in-progress': 'In Progress',
    next: 'Selected for Development',
  },
  statusTransitions: {
    'Backlog': '11',
    'Selected for Development': '21',
    'In Progress': '31',
    'Done': '41',
  },
  backlogLabels: ['future', 'icebox'],
};

// =============================================================================
// BoardSync Class
// =============================================================================

export class BoardSync {
  private readonly jiraClient: JiraClient;
  private readonly config: BoardSyncConfig;
  private readonly logger: Logger;

  constructor(jiraClient: JiraClient, config: BoardSyncConfig, logger?: Logger) {
    this.jiraClient = jiraClient;
    this.config = {
      ...DEFAULT_KANBAN_CONFIG,
      ...config,
      labelToStatus: { ...DEFAULT_KANBAN_CONFIG.labelToStatus, ...config.labelToStatus },
      statusTransitions: { ...DEFAULT_KANBAN_CONFIG.statusTransitions, ...config.statusTransitions },
    };
    this.logger = logger ?? createLoggerFromEnv('board-sync');
  }

  /**
   * Sync all issues in the project — transition to correct status based on labels.
   */
  async sync(): Promise<BoardSyncResult> {
    this.logger.info(`Syncing board for project ${this.config.projectKey}`);

    const issues = await this.fetchAllIssues();
    const transitioned: BoardSyncResult['transitioned'] = [];
    const errors: BoardSyncResult['errors'] = [];
    let skipped = 0;

    for (const issue of issues) {
      const labels: string[] = issue.fields.labels || [];
      const currentStatus = issue.fields.status.name;
      const targetStatus = this.resolveTargetStatus(labels);

      if (!targetStatus || currentStatus === targetStatus) {
        skipped++;
        continue;
      }

      const transitionId = this.config.statusTransitions[targetStatus];
      if (!transitionId) {
        this.logger.warn(`No transition ID for status "${targetStatus}" (${issue.key})`);
        skipped++;
        continue;
      }

      try {
        await this.jiraClient.transitionIssue(issue.key, { transitionId });
        transitioned.push({
          key: issue.key,
          summary: issue.fields.summary,
          from: currentStatus,
          to: targetStatus,
        });
        this.logger.info(`${issue.key}: ${currentStatus} -> ${targetStatus}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ key: issue.key, error: message });
        this.logger.error(`Failed to transition ${issue.key}: ${message}`);
      }
    }

    const summary = this.buildSummary(issues.length, transitioned, skipped, errors);

    return {
      totalIssues: issues.length,
      transitioned,
      skipped,
      errors,
      summary,
    };
  }

  /**
   * Detect the board's available transitions by inspecting a sample issue.
   * Useful for auto-configuring statusTransitions.
   */
  async detectTransitions(): Promise<Record<string, string>> {
    const issues = await this.jiraClient.searchIssues({
      jql: `project = ${this.config.projectKey} ORDER BY key ASC`,
      maxResults: 1,
    });

    if (issues.issues.length === 0) {
      return {};
    }

    const transitions = await this.jiraClient.getTransitions(issues.issues[0].key);
    const result: Record<string, string> = {};

    for (const t of transitions) {
      result[t.to.name] = t.id;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async fetchAllIssues(): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const results = await this.jiraClient.searchIssues({
        jql: `project = ${this.config.projectKey} ORDER BY key ASC`,
        maxResults: pageSize,
        startAt: allIssues.length,
        fields: ['summary', 'status', 'issuetype', 'labels', 'parent'],
      });

      allIssues.push(...results.issues);
      hasMore = results.issues.length >= pageSize;
    }

    return allIssues;
  }

  private resolveTargetStatus(labels: string[]): string | null {
    // Check labels in priority order (done > in-progress > next)
    for (const [label, status] of Object.entries(this.config.labelToStatus)) {
      if (labels.includes(label)) {
        return status;
      }
    }

    // Backlog labels stay put
    if (this.config.backlogLabels?.some(l => labels.includes(l))) {
      return null;
    }

    return null;
  }

  private buildSummary(
    total: number,
    transitioned: BoardSyncResult['transitioned'],
    skipped: number,
    errors: BoardSyncResult['errors'],
  ): string {
    const lines: string[] = [
      `Board sync for ${this.config.projectKey}: ${total} issues`,
    ];

    if (transitioned.length > 0) {
      const byTarget = new Map<string, number>();
      for (const t of transitioned) {
        byTarget.set(t.to, (byTarget.get(t.to) ?? 0) + 1);
      }
      for (const [status, count] of byTarget) {
        lines.push(`  -> ${status}: ${count} issues`);
      }
    }

    lines.push(`  Skipped (already correct): ${skipped}`);

    if (errors.length > 0) {
      lines.push(`  Errors: ${errors.length}`);
    }

    return lines.join('\n');
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a BoardSync with auto-detected transitions.
 */
export async function createBoardSync(
  jiraClient: JiraClient,
  projectKey: string,
  labelOverrides?: Record<string, string>,
): Promise<BoardSync> {
  const sync = new BoardSync(jiraClient, {
    projectKey,
    labelToStatus: labelOverrides ?? {},
    statusTransitions: {},
  });

  // Auto-detect transitions from the board
  const transitions = await sync.detectTransitions();

  return new BoardSync(jiraClient, {
    projectKey,
    labelToStatus: labelOverrides ?? {},
    statusTransitions: transitions,
  });
}
