/**
 * Plan-to-Jira Orchestrator
 *
 * Takes structured plans (from conversations/planning sessions)
 * and creates corresponding Jira issue structure including epics,
 * stories, tasks, subtasks, and their relationships.
 */

import { JiraClient, createJiraClientFromEnv } from '../jira/client.js';
import { JiraIssueCreateInput, JiraIssueCreateResponse } from '../jira/types.js';
import { AdfBuilder } from '../core/adf-builder.js';
import { AdfDocument } from '../core/types.js';
import { Logger, createLoggerFromEnv } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A single item in a plan, representing an issue to create in Jira.
 */
export interface PlanItem {
  title: string;
  description?: string;
  type: 'epic' | 'story' | 'task' | 'bug' | 'subtask';
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
  labels?: string[];
  storyPoints?: number;
  acceptanceCriteria?: string[];
  children?: PlanItem[];
  dependencies?: string[];
}

/**
 * Input for executing a plan against a Jira project.
 */
export interface PlanInput {
  title: string;
  description?: string;
  projectKey: string;
  items: PlanItem[];
  labels?: string[];
  sprintId?: number;
  linkToParent?: string;
  dryRun?: boolean;
}

/**
 * Result of executing a plan.
 */
export interface PlanExecutionResult {
  success: boolean;
  epicKey?: string;
  createdIssues: Array<{
    key: string;
    summary: string;
    type: string;
    parentKey?: string;
    url: string;
  }>;
  totalIssuesCreated: number;
  errors: Array<{ item: string; error: string }>;
  dryRun: boolean;
  summary: string;
}

// =============================================================================
// Internal helpers
// =============================================================================

const PLAN_ITEM_TYPE_TO_JIRA: Record<PlanItem['type'], string> = {
  epic: 'Epic',
  story: 'Story',
  task: 'Task',
  bug: 'Bug',
  subtask: 'Sub-task',
};

const PRIORITY_ALIASES: Record<string, PlanItem['priority']> = {
  P1: 'Highest',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
  P5: 'Lowest',
};

// =============================================================================
// PlanExecutor
// =============================================================================

/**
 * Orchestrates creating a tree of Jira issues from a structured plan.
 */
export class PlanExecutor {
  private readonly jiraClient: JiraClient;
  private readonly siteUrl: string;
  private readonly logger: Logger;

  constructor(
    jiraClient: JiraClient,
    config: { siteUrl: string },
    logger?: Logger,
  ) {
    this.jiraClient = jiraClient;
    this.siteUrl = config.siteUrl.replace(/\/$/, '');
    this.logger = logger ?? createLoggerFromEnv('plan-executor');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Execute a plan: create all Jira issues described by the input.
   *
   * 1. Creates epics first.
   * 2. Creates stories/tasks linked to their parent epic.
   * 3. Creates subtasks under their parent stories.
   * 4. Applies labels to every created issue.
   * 5. Builds rich ADF descriptions (including acceptance-criteria checklists).
   * 6. Adds issue links for declared dependencies.
   */
  async executePlan(input: PlanInput): Promise<PlanExecutionResult> {
    if (input.dryRun) {
      return this.previewPlan(input);
    }

    this.logger.info('Executing plan', { title: input.title, projectKey: input.projectKey });

    const createdIssues: PlanExecutionResult['createdIssues'] = [];
    const errors: PlanExecutionResult['errors'] = [];
    // Maps item title -> created issue key (used for dependency linking)
    const titleToKey = new Map<string, string>();
    // Process each top-level item
    for (const item of input.items) {
      try {
        await this.createItemTree(
          item,
          input.projectKey,
          input.labels ?? [],
          input.linkToParent,
          createdIssues,
          errors,
          titleToKey,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to create item: ${item.title}`, err instanceof Error ? err : undefined);
        errors.push({ item: item.title, error: message });
      }
    }

    // Determine epic key (first epic created, if any)
    const epicKey = createdIssues.find(i => i.type === 'Epic')?.key;

    // Move to sprint if requested
    if (input.sprintId && createdIssues.length > 0) {
      try {
        const keys = createdIssues.map(i => i.key);
        await this.jiraClient.moveIssuesToSprint(input.sprintId, keys);
        this.logger.info('Moved issues to sprint', { sprintId: input.sprintId, count: keys.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to move issues to sprint ${input.sprintId}: ${message}`);
        errors.push({ item: '[sprint assignment]', error: message });
      }
    }

    // Link dependencies
    await this.linkDependencies(input.items, titleToKey, errors);

    const success = errors.length === 0;
    const summary = this.buildSummary(input, createdIssues, errors, false);

    this.logger.info('Plan execution complete', {
      success,
      created: createdIssues.length,
      errors: errors.length,
    });

    return {
      success,
      epicKey,
      createdIssues,
      totalIssuesCreated: createdIssues.length,
      errors,
      dryRun: false,
      summary,
    };
  }

  /**
   * Preview a plan without creating anything (dry-run).
   */
  async previewPlan(input: PlanInput): Promise<PlanExecutionResult> {
    this.logger.info('Previewing plan (dry run)', { title: input.title });

    const previewIssues: PlanExecutionResult['createdIssues'] = [];
    let counter = 1;

    const walk = (items: PlanItem[], parentKey?: string): void => {
      for (const item of items) {
        const fakeKey = `${input.projectKey}-PREVIEW-${counter++}`;
        previewIssues.push({
          key: fakeKey,
          summary: item.title,
          type: PLAN_ITEM_TYPE_TO_JIRA[item.type],
          parentKey,
          url: `${this.siteUrl}/browse/${fakeKey}`,
        });

        if (item.children?.length) {
          walk(item.children, fakeKey);
        }
      }
    };

    walk(input.items);

    const epicKey = previewIssues.find(i => i.type === 'Epic')?.key;
    const summary = this.buildSummary(input, previewIssues, [], true);

    return {
      success: true,
      epicKey,
      createdIssues: previewIssues,
      totalIssuesCreated: previewIssues.length,
      errors: [],
      dryRun: true,
      summary,
    };
  }

  // ---------------------------------------------------------------------------
  // Static parsers
  // ---------------------------------------------------------------------------

  /**
   * Parse a markdown plan into a PlanInput structure.
   *
   * Conventions:
   *  - `##` headings become epics
   *  - `###` headings become stories
   *  - Bullet items (`- ` / `* `) become tasks or subtasks depending on nesting
   *  - `[P1]`..`[P5]` set priority
   *  - `(3 pts)` or `(SP: 5)` set story points
   *  - Lines starting with `AC:` or `- [ ]` are treated as acceptance criteria
   */
  static parsePlanFromMarkdown(markdown: string, projectKey: string): PlanInput {
    const lines = markdown.split('\n');
    const items: PlanItem[] = [];
    let currentEpic: PlanItem | null = null;
    let currentStory: PlanItem | null = null;
    let planTitle = 'Imported Plan';
    let planDescription: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Top-level heading as plan title
      const h1 = trimmed.match(/^#\s+(.+)$/);
      if (h1) {
        planTitle = h1[1].trim();
        continue;
      }

      // Epic (##)
      const h2 = trimmed.match(/^##\s+(.+)$/);
      if (h2) {
        currentEpic = PlanExecutor.parseTitleLine(h2[1], 'epic');
        items.push(currentEpic);
        currentStory = null;
        continue;
      }

      // Story (###)
      const h3 = trimmed.match(/^###\s+(.+)$/);
      if (h3) {
        currentStory = PlanExecutor.parseTitleLine(h3[1], 'story');
        if (currentEpic) {
          if (!currentEpic.children) currentEpic.children = [];
          currentEpic.children.push(currentStory);
        } else {
          items.push(currentStory);
        }
        continue;
      }

      // Acceptance criteria
      if (trimmed.startsWith('AC:') || trimmed.match(/^-\s*\[[ x]\]\s*/)) {
        const acText = trimmed
          .replace(/^AC:\s*/, '')
          .replace(/^-\s*\[[ x]\]\s*/, '')
          .trim();
        const target = currentStory ?? currentEpic;
        if (target && acText) {
          if (!target.acceptanceCriteria) target.acceptanceCriteria = [];
          target.acceptanceCriteria.push(acText);
        }
        continue;
      }

      // Bullet points -> tasks or subtasks
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        const indent = line.search(/\S/);
        const isSubtask = indent >= 4 && currentStory != null;

        const parsed = PlanExecutor.parseTitleLine(
          bulletMatch[1],
          isSubtask ? 'subtask' : 'task',
        );

        if (isSubtask && currentStory) {
          if (!currentStory.children) currentStory.children = [];
          currentStory.children.push(parsed);
        } else if (currentEpic) {
          if (!currentEpic.children) currentEpic.children = [];
          currentEpic.children.push(parsed);
        } else {
          items.push(parsed);
        }
        continue;
      }

      // Anything else before the first heading is the plan description
      if (!currentEpic && !currentStory && items.length === 0) {
        planDescription = planDescription
          ? `${planDescription}\n${trimmed}`
          : trimmed;
      }
    }

    return {
      title: planTitle,
      description: planDescription,
      projectKey,
      items,
    };
  }

  /**
   * Extract action items from free-form conversation text.
   *
   * Looks for patterns such as:
   *  - "we need to ..."
   *  - "TODO: ..."
   *  - "action item: ..."
   *  - "let's create ..."
   */
  static extractActionItems(conversationText: string, _projectKey: string): PlanItem[] {
    const items: PlanItem[] = [];

    const patterns: Array<{ regex: RegExp; groupIndex: number }> = [
      { regex: /(?:^|\n)\s*(?:TODO|todo|Todo):\s*(.+)/g, groupIndex: 1 },
      { regex: /(?:^|\n)\s*(?:action item|Action Item|ACTION ITEM):\s*(.+)/gi, groupIndex: 1 },
      { regex: /(?:we need to|We need to)\s+(.+?)(?:\.|$)/gm, groupIndex: 1 },
      { regex: /(?:let's create|Let's create)\s+(.+?)(?:\.|$)/gm, groupIndex: 1 },
      { regex: /(?:should|must|need to)\s+(add|fix|build|implement|create|update|remove|refactor)\s+(.+?)(?:\.|$)/gim, groupIndex: 0 },
    ];

    const seenTitles = new Set<string>();

    for (const { regex } of patterns) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(conversationText)) !== null) {
        // Use the last non-undefined capturing group or the full match
        let raw = '';
        for (let g = match.length - 1; g >= 1; g--) {
          if (match[g]) {
            raw = match[g];
            break;
          }
        }
        if (!raw) raw = match[0];

        const title = raw.trim().replace(/^\W+/, '');
        if (!title || title.length < 5 || seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());

        const type = PlanExecutor.inferTypeFromText(title);
        items.push({
          title: title.charAt(0).toUpperCase() + title.slice(1),
          type,
          priority: 'Medium',
        });
      }
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // Private: issue creation helpers
  // ---------------------------------------------------------------------------

  /**
   * Recursively create an item and its children.
   */
  private async createItemTree(
    item: PlanItem,
    projectKey: string,
    globalLabels: string[],
    parentKey: string | undefined,
    createdIssues: PlanExecutionResult['createdIssues'],
    errors: PlanExecutionResult['errors'],
    titleToKey: Map<string, string>,
  ): Promise<string | undefined> {
    const mergedLabels = [...new Set([...(item.labels ?? []), ...globalLabels])];
    const description = this.buildDescription(item);

    const issueInput: JiraIssueCreateInput = {
      project: projectKey,
      issuetype: PLAN_ITEM_TYPE_TO_JIRA[item.type],
      summary: item.title,
      description,
      labels: mergedLabels.length > 0 ? mergedLabels : undefined,
      priority: item.priority,
    };

    // Link to parent epic/story
    if (parentKey && (item.type === 'subtask' || item.type === 'story' || item.type === 'task')) {
      issueInput.parent = parentKey;
    }

    // Story points via custom field
    if (item.storyPoints !== undefined) {
      issueInput.customFields = { customfield_10016: item.storyPoints };
    }

    let response: JiraIssueCreateResponse;
    try {
      response = await this.jiraClient.createIssue(issueInput);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to create "${item.title}"`, err instanceof Error ? err : undefined);
      errors.push({ item: item.title, error: message });
      return undefined;
    }

    const issueKey = response.key;
    titleToKey.set(item.title, issueKey);

    createdIssues.push({
      key: issueKey,
      summary: item.title,
      type: PLAN_ITEM_TYPE_TO_JIRA[item.type],
      parentKey,
      url: `${this.siteUrl}/browse/${issueKey}`,
    });

    this.logger.info(`Created ${item.type}: ${issueKey} - ${item.title}`);

    // Create children
    if (item.children?.length) {
      for (const child of item.children) {
        try {
          await this.createItemTree(
            child,
            projectKey,
            globalLabels,
            issueKey,
            createdIssues,
            errors,
            titleToKey,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ item: child.title, error: message });
        }
      }
    }

    return issueKey;
  }

  /**
   * Build an ADF description for a plan item.
   * Includes the item description and acceptance criteria as a checklist.
   */
  private buildDescription(item: PlanItem): AdfDocument {
    const builder = new AdfBuilder();

    if (item.description) {
      builder.paragraph(item.description);
    }

    if (item.acceptanceCriteria && item.acceptanceCriteria.length > 0) {
      builder.heading(3, 'Acceptance Criteria');
      builder.bulletList(
        item.acceptanceCriteria.map(ac => `[ ] ${ac}`),
      );
    }

    if (item.dependencies && item.dependencies.length > 0) {
      builder.heading(3, 'Dependencies');
      builder.bulletList(item.dependencies);
    }

    if (item.storyPoints !== undefined) {
      builder.infoPanel(`Story Points: ${item.storyPoints}`);
    }

    return builder.build();
  }

  /**
   * After all issues are created, link dependencies between them using
   * Jira issue links (type "Blocks").
   */
  private async linkDependencies(
    items: PlanItem[],
    titleToKey: Map<string, string>,
    errors: PlanExecutionResult['errors'],
  ): Promise<void> {
    const allItems = this.flattenItems(items);

    for (const item of allItems) {
      if (!item.dependencies?.length) continue;

      const issueKey = titleToKey.get(item.title);
      if (!issueKey) continue;

      for (const depTitle of item.dependencies) {
        const depKey = titleToKey.get(depTitle);
        if (!depKey) {
          this.logger.warn(`Dependency not found: "${depTitle}" (referenced by "${item.title}")`);
          continue;
        }

        try {
          // Use the REST API directly via the inherited post method
          await (this.jiraClient as unknown as { post<T>(path: string, body?: unknown): Promise<{ data: T }> })
            .post('/rest/api/3/issueLink', {
              type: { name: 'Blocks' },
              inwardIssue: { key: depKey },
              outwardIssue: { key: issueKey },
            });
          this.logger.info(`Linked dependency: ${depKey} blocks ${issueKey}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to link ${depKey} -> ${issueKey}: ${message}`);
          errors.push({ item: `${item.title} (dependency link)`, error: message });
        }
      }
    }
  }

  /**
   * Flatten a tree of PlanItems into a single list.
   */
  private flattenItems(items: PlanItem[]): PlanItem[] {
    const result: PlanItem[] = [];
    const stack = [...items];
    while (stack.length > 0) {
      const item = stack.pop()!;
      result.push(item);
      if (item.children) {
        stack.push(...item.children);
      }
    }
    return result;
  }

  /**
   * Build a human-readable summary of the execution result.
   */
  private buildSummary(
    input: PlanInput,
    createdIssues: PlanExecutionResult['createdIssues'],
    errors: PlanExecutionResult['errors'],
    dryRun: boolean,
  ): string {
    const prefix = dryRun ? '[DRY RUN] ' : '';
    const lines: string[] = [
      `${prefix}Plan: "${input.title}" in project ${input.projectKey}`,
    ];

    if (createdIssues.length > 0) {
      lines.push(`${prefix}${dryRun ? 'Would create' : 'Created'} ${createdIssues.length} issues:`);

      const byType = new Map<string, number>();
      for (const issue of createdIssues) {
        byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1);
      }
      for (const [type, count] of byType.entries()) {
        lines.push(`  - ${count} ${type}(s)`);
      }

      if (!dryRun) {
        const epicIssue = createdIssues.find(i => i.type === 'Epic');
        if (epicIssue) {
          lines.push(`Epic: ${epicIssue.key} - ${epicIssue.url}`);
        }
      }
    } else {
      lines.push(`${prefix}No issues ${dryRun ? 'would be' : 'were'} created.`);
    }

    if (errors.length > 0) {
      lines.push(`${errors.length} error(s):`);
      for (const err of errors) {
        lines.push(`  - ${err.item}: ${err.error}`);
      }
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Static private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse priority, story points, and clean title from a single line.
   */
  private static parseTitleLine(raw: string, defaultType: PlanItem['type']): PlanItem {
    let title = raw;
    let priority: PlanItem['priority'] | undefined;
    let storyPoints: number | undefined;

    // Extract priority: [P1] .. [P5]
    const prioMatch = title.match(/\[(P[1-5])\]/i);
    if (prioMatch) {
      priority = PRIORITY_ALIASES[prioMatch[1].toUpperCase()];
      title = title.replace(prioMatch[0], '').trim();
    }

    // Extract story points: (3 pts) or (SP: 5)
    const spMatch = title.match(/\((\d+)\s*pts?\)/i) ?? title.match(/\(SP:\s*(\d+)\)/i);
    if (spMatch) {
      storyPoints = parseInt(spMatch[1], 10);
      title = title.replace(spMatch[0], '').trim();
    }

    const type = PlanExecutor.inferTypeFromText(title) ?? defaultType;

    return {
      title,
      type,
      priority,
      storyPoints,
    };
  }

  /**
   * Infer issue type from keywords in the text.
   */
  private static inferTypeFromText(text: string): PlanItem['type'] {
    const lower = text.toLowerCase();
    if (/\b(bug|fix|defect|broken|crash)\b/.test(lower)) return 'bug';
    if (/\b(feature|add|implement|build|create)\b/.test(lower)) return 'story';
    if (/\b(epic|initiative|theme)\b/.test(lower)) return 'epic';
    return 'task';
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a PlanExecutor from environment variables.
 * Expects ATLASSIAN_SITE_URL to be set.
 */
export function createPlanExecutorFromEnv(): PlanExecutor {
  const jiraClient = createJiraClientFromEnv();
  const siteUrl = process.env.ATLASSIAN_SITE_URL;
  if (!siteUrl) {
    throw new Error('ATLASSIAN_SITE_URL environment variable is required');
  }
  const logger = createLoggerFromEnv('plan-executor');
  return new PlanExecutor(jiraClient, { siteUrl }, logger);
}
