/**
 * Session Bridge
 *
 * Connects Claude Code session context to Jira operations.
 * Enables automatic ticket creation, decision logging, PR linking,
 * and progress tracking from development sessions.
 */

import { JiraClient } from '../jira/client.js';
import { AdfBuilder, TextBuilder } from '../core/adf-builder.js';
import { AdfDocument } from '../core/types.js';
import {
  SessionTranscript,
  SessionEvent,
  FileOperationData,
  CommandData,
} from '../session/types.js';
import { createLoggerFromEnv, Logger } from '../utils/logger.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the session bridge
 */
export interface SessionBridgeConfig {
  /** Jira project key for ticket creation */
  projectKey: string;
  /** Atlassian site URL for generating links */
  siteUrl: string;
  /** Automatically create tickets from session context */
  autoCreateTickets: boolean;
  /** Automatically link PRs to Jira tickets */
  autoLinkPRs: boolean;
  /** Automatically update ticket status based on activity */
  autoUpdateStatus: boolean;
  /** Default labels to apply to created tickets */
  defaultLabels: string[];
}

// ============================================================================
// Session Bridge Class
// ============================================================================

/**
 * Bridges Claude Code session context to Jira operations.
 *
 * Provides methods to capture decisions, create tickets from sessions,
 * link work artifacts, and sync progress to Jira issues.
 */
export class SessionBridge {
  private readonly jiraClient: JiraClient;
  private readonly config: SessionBridgeConfig;
  private readonly logger: Logger;

  constructor(
    jiraClient: JiraClient,
    config: SessionBridgeConfig,
    logger?: Logger
  ) {
    this.jiraClient = jiraClient;
    this.config = config;
    this.logger = logger || createLoggerFromEnv('session-bridge');
  }

  // ==========================================================================
  // Decision Capture
  // ==========================================================================

  /**
   * Extract decisions from a conversation and create a Jira comment on the issue
   * with the decisions listed, timestamp, and session reference.
   *
   * @param issueKey - The Jira issue key (e.g. "PROJ-123")
   * @param conversationSummary - Brief summary of the conversation context
   * @param decisions - List of decisions made during the session
   * @returns The created comment ID and count of decisions logged
   */
  async captureDecisions(
    issueKey: string,
    conversationSummary: string,
    decisions: string[]
  ): Promise<{ commentId: string; decisionsLogged: number }> {
    this.logger.info('Capturing decisions for issue', {
      issueKey,
      decisionCount: decisions.length,
    });

    const adf = new AdfBuilder();

    // Header
    adf.heading(3, 'Decisions from Claude Code Session');

    // Timestamp and context
    const timestamp = new Date().toISOString();
    adf.panel(
      'info',
      new TextBuilder()
        .bold('Logged: ')
        .text(timestamp)
        .hardBreak()
        .bold('Context: ')
        .text(conversationSummary)
    );

    // Decisions list
    if (decisions.length > 0) {
      adf.heading(4, 'Decisions Made');
      adf.orderedList(decisions);
    } else {
      adf.paragraph(
        new TextBuilder().italic('No explicit decisions recorded.')
      );
    }

    adf.rule();
    adf.paragraph(
      new TextBuilder()
        .italic('Automatically logged by ')
        .bold('@hidden-leaf/atlassian-skill')
    );

    const comment = await this.jiraClient.addComment(issueKey, {
      body: adf.build(),
    });

    this.logger.info('Decisions captured successfully', {
      issueKey,
      commentId: comment.id,
      decisionsLogged: decisions.length,
    });

    return {
      commentId: comment.id,
      decisionsLogged: decisions.length,
    };
  }

  // ==========================================================================
  // Ticket Creation from Session
  // ==========================================================================

  /**
   * Create a Jira ticket from the current session transcript.
   *
   * Analyzes the session to auto-generate a summary, extracts files changed,
   * related issues, and creates a ticket with a rich ADF description.
   *
   * @param sessionTranscript - The session transcript to create a ticket from
   * @param options - Optional overrides for issue creation
   * @returns The created issue key and URL
   */
  async createTicketFromSession(
    sessionTranscript: SessionTranscript,
    options?: {
      issueType?: string;
      priority?: string;
      summary?: string;
      parentKey?: string;
      labels?: string[];
    }
  ): Promise<{ issueKey: string; url: string }> {
    const { metadata } = sessionTranscript;

    this.logger.info('Creating ticket from session', {
      sessionId: metadata.sessionId,
    });

    // Auto-generate summary if not provided
    const summary =
      options?.summary || this.generateTicketSummary(sessionTranscript);

    // Build description
    const description = this.buildTicketDescription(sessionTranscript);

    // Merge labels
    const labels = [
      ...this.config.defaultLabels,
      ...(options?.labels || []),
      'claude-code-session',
    ];

    // Determine issue type
    const issueType = options?.issueType || 'Task';

    // Determine priority from session errors
    const priority =
      options?.priority ||
      (metadata.stats.errorsEncountered > 3 ? 'High' : 'Medium');

    // Create the issue
    const createInput: Record<string, unknown> = {
      project: this.config.projectKey,
      issuetype: issueType,
      summary,
      description,
      labels,
      priority,
    };

    if (options?.parentKey) {
      (createInput as Record<string, unknown>).parent = options.parentKey;
    }

    const response = await this.jiraClient.createIssue({
      project: this.config.projectKey,
      issuetype: issueType,
      summary,
      description,
      labels,
      priority,
      parent: options?.parentKey,
    });

    const issueKey = response.key;
    const url = `${this.config.siteUrl}/browse/${issueKey}`;

    this.logger.info('Ticket created from session', {
      issueKey,
      url,
      sessionId: metadata.sessionId,
    });

    return { issueKey, url };
  }

  // ==========================================================================
  // Work Linking
  // ==========================================================================

  /**
   * Link a PR/branch to a Jira ticket and update its status.
   *
   * Adds a remote link to the PR, adds a comment about the branch/PR,
   * and transitions the issue to "In Progress" or "In Review" as appropriate.
   *
   * @param issueKey - The Jira issue key
   * @param work - Work artifacts to link (branch, PR, commits)
   * @returns Link and transition results
   */
  async linkWorkToTicket(
    issueKey: string,
    work: {
      branchName?: string;
      prUrl?: string;
      prTitle?: string;
      commitMessages?: string[];
    }
  ): Promise<{ linked: boolean; transitioned: boolean; newStatus?: string }> {
    this.logger.info('Linking work to ticket', {
      issueKey,
      hasBranch: !!work.branchName,
      hasPR: !!work.prUrl,
      commitCount: work.commitMessages?.length || 0,
    });

    let linked = false;
    let transitioned = false;
    let newStatus: string | undefined;

    try {
      // Add remote link for the PR if URL is provided
      if (work.prUrl) {
        await this.jiraClient.post(
          `/rest/api/3/issue/${issueKey}/remotelink`,
          {
            globalId: `pr:${work.prUrl}`,
            object: {
              url: work.prUrl,
              title: work.prTitle || 'Pull Request',
              icon: {
                url16x16:
                  'https://github.githubassets.com/favicons/favicon.svg',
                title: 'Pull Request',
              },
            },
          }
        );
        linked = true;
      }

      // Add a comment about the linked work
      const commentAdf = this.buildWorkLinkComment(work);
      await this.jiraClient.addComment(issueKey, {
        body: commentAdf,
      });

      if (!linked && work.branchName) {
        linked = true;
      }

      // Transition the issue based on work type
      if (this.config.autoUpdateStatus) {
        const targetStatus = work.prUrl ? 'In Review' : 'In Progress';

        try {
          const transitions = await this.jiraClient.getTransitions(issueKey);
          const matchingTransition = transitions.find(
            (t) =>
              t.name.toLowerCase() === targetStatus.toLowerCase() ||
              t.to.name.toLowerCase() === targetStatus.toLowerCase()
          );

          if (matchingTransition) {
            await this.jiraClient.transitionIssue(issueKey, {
              transitionId: matchingTransition.id,
            });
            transitioned = true;
            newStatus = matchingTransition.to.name;
          }
        } catch (transitionError) {
          this.logger.warn('Failed to transition issue', {
            issueKey,
            targetStatus,
            error:
              transitionError instanceof Error
                ? transitionError.message
                : 'Unknown error',
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to link work to ticket',
        error instanceof Error ? error : undefined,
        { issueKey }
      );
      throw error;
    }

    this.logger.info('Work linked to ticket', {
      issueKey,
      linked,
      transitioned,
      newStatus,
    });

    return { linked, transitioned, newStatus };
  }

  // ==========================================================================
  // Session Progress Sync
  // ==========================================================================

  /**
   * Update a Jira ticket with session progress.
   *
   * Adds a progress comment with files modified, commands run,
   * and key decisions extracted from the session.
   *
   * @param issueKey - The Jira issue key
   * @param sessionTranscript - The current session transcript
   * @returns Whether the ticket was updated and a comment was added
   */
  async syncSessionProgress(
    issueKey: string,
    sessionTranscript: SessionTranscript
  ): Promise<{ updated: boolean; commentAdded: boolean }> {
    this.logger.info('Syncing session progress', {
      issueKey,
      sessionId: sessionTranscript.metadata.sessionId,
    });

    try {
      const summaryText = this.generateSessionSummary(sessionTranscript);
      const { metadata } = sessionTranscript;

      const adf = new AdfBuilder();

      // Header
      adf.heading(3, 'Session Progress Update');

      // Session info panel
      adf.panel(
        'info',
        new TextBuilder()
          .bold('Session: ')
          .code(metadata.sessionId)
          .hardBreak()
          .bold('Updated: ')
          .text(new Date().toISOString())
      );

      // Summary paragraph
      adf.paragraph(summaryText);

      // Files modified
      const filesModified = this.extractFilesModified(sessionTranscript.events);
      if (filesModified.length > 0) {
        adf.heading(4, 'Files Modified');
        adf.bulletList(
          filesModified
            .slice(0, 20)
            .map((f) => new TextBuilder().code(f).build())
        );
        if (filesModified.length > 20) {
          adf.paragraph(
            new TextBuilder().italic(
              `...and ${filesModified.length - 20} more files`
            )
          );
        }
      }

      // Commands run
      const commands = this.extractCommands(sessionTranscript.events);
      if (commands.length > 0) {
        adf.heading(4, 'Commands Executed');
        adf.codeBlock(commands.slice(0, 10).join('\n'), 'bash');
        if (commands.length > 10) {
          adf.paragraph(
            new TextBuilder().italic(
              `...and ${commands.length - 10} more commands`
            )
          );
        }
      }

      // Stats table
      adf.heading(4, 'Session Statistics');
      adf.table(
        ['Metric', 'Value'],
        [
          ['Messages', metadata.stats.messageCount.toString()],
          ['Tool Calls', metadata.stats.toolCallCount.toString()],
          ['Files Read', metadata.stats.filesRead.toString()],
          [
            'Files Written/Edited',
            (
              metadata.stats.filesWritten + metadata.stats.filesEdited
            ).toString(),
          ],
          ['Commands Run', metadata.stats.commandsRun.toString()],
          ['Errors', metadata.stats.errorsEncountered.toString()],
        ]
      );

      // Git info if available
      if (metadata.git) {
        adf.paragraph(
          new TextBuilder()
            .bold('Branch: ')
            .code(metadata.git.branch)
            .text(' @ ')
            .code(metadata.git.commit)
        );
      }

      adf.rule();
      adf.paragraph(
        new TextBuilder()
          .italic('Auto-synced by ')
          .bold('@hidden-leaf/atlassian-skill')
      );

      await this.jiraClient.addComment(issueKey, {
        body: adf.build(),
      });

      this.logger.info('Session progress synced', {
        issueKey,
        filesModified: filesModified.length,
        commands: commands.length,
      });

      return { updated: true, commentAdded: true };
    } catch (error) {
      this.logger.error(
        'Failed to sync session progress',
        error instanceof Error ? error : undefined,
        { issueKey }
      );
      return { updated: false, commentAdded: false };
    }
  }

  // ==========================================================================
  // Session Summary Generation
  // ==========================================================================

  /**
   * Generate a human-readable session summary suitable for Jira.
   *
   * @param sessionTranscript - The session transcript to summarize
   * @returns A plain text summary string
   */
  generateSessionSummary(sessionTranscript: SessionTranscript): string {
    const { metadata } = sessionTranscript;
    const parts: string[] = [];

    // Project and timing
    if (metadata.projectName) {
      parts.push(`Work on ${metadata.projectName}.`);
    }

    // Duration
    if (metadata.stats.totalDuration > 0) {
      parts.push(`Duration: ${this.formatDuration(metadata.stats.totalDuration)}.`);
    }

    // Activity summary
    const activities: string[] = [];
    if (metadata.stats.filesWritten > 0) {
      activities.push(`${metadata.stats.filesWritten} file(s) created`);
    }
    if (metadata.stats.filesEdited > 0) {
      activities.push(`${metadata.stats.filesEdited} file(s) edited`);
    }
    if (metadata.stats.filesRead > 0) {
      activities.push(`${metadata.stats.filesRead} file(s) read`);
    }
    if (metadata.stats.commandsRun > 0) {
      activities.push(`${metadata.stats.commandsRun} command(s) run`);
    }
    if (activities.length > 0) {
      parts.push(`Activity: ${activities.join(', ')}.`);
    }

    // Errors
    if (metadata.stats.errorsEncountered > 0) {
      parts.push(
        `Encountered ${metadata.stats.errorsEncountered} error(s) during session.`
      );
    }

    // Git context
    if (metadata.git) {
      parts.push(`Branch: ${metadata.git.branch} (${metadata.git.commit}).`);
    }

    // Related issues
    if (metadata.relatedIssues && metadata.relatedIssues.length > 0) {
      parts.push(
        `Related issues: ${metadata.relatedIssues.join(', ')}.`
      );
    }

    // Use transcript summary if available
    if (sessionTranscript.summary) {
      parts.push(sessionTranscript.summary.title);
    }

    return parts.join(' ');
  }

  // ==========================================================================
  // Static Utility Methods
  // ==========================================================================

  /**
   * Extract action items from conversation text.
   *
   * Looks for patterns like "TODO", "need to", "should", "action item",
   * "next step", etc. in the text and extracts them as structured items.
   *
   * @param text - The conversation text to scan
   * @returns Array of extracted action items with optional assignee and priority
   */
  static extractActionItems(
    text: string
  ): Array<{
    action: string;
    assignee?: string;
    priority?: 'high' | 'medium' | 'low';
  }> {
    const items: Array<{
      action: string;
      assignee?: string;
      priority?: 'high' | 'medium' | 'low';
    }> = [];

    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Match TODO patterns
      const todoMatch = trimmed.match(
        /\bTODO\b[:\s-]*(.+)/i
      );
      if (todoMatch) {
        items.push({
          action: todoMatch[1].trim(),
          priority: 'medium',
        });
        continue;
      }

      // Match "action item" patterns
      const actionItemMatch = trimmed.match(
        /\baction\s+item\b[:\s-]*(.+)/i
      );
      if (actionItemMatch) {
        items.push({
          action: actionItemMatch[1].trim(),
          priority: 'high',
        });
        continue;
      }

      // Match "next step" patterns
      const nextStepMatch = trimmed.match(
        /\bnext\s+step\b[:\s-]*(.+)/i
      );
      if (nextStepMatch) {
        items.push({
          action: nextStepMatch[1].trim(),
          priority: 'medium',
        });
        continue;
      }

      // Match "need to" / "needs to" patterns
      const needToMatch = trimmed.match(
        /\bneeds?\s+to\b\s+(.+)/i
      );
      if (needToMatch) {
        items.push({
          action: needToMatch[1].trim(),
          priority: 'medium',
        });
        continue;
      }

      // Match "should" patterns (lower priority)
      const shouldMatch = trimmed.match(
        /\bshould\b\s+(.+)/i
      );
      if (shouldMatch) {
        items.push({
          action: shouldMatch[1].trim(),
          priority: 'low',
        });
        continue;
      }

      // Match "must" / "have to" patterns (high priority)
      const mustMatch = trimmed.match(
        /\b(?:must|have\s+to)\b\s+(.+)/i
      );
      if (mustMatch) {
        items.push({
          action: mustMatch[1].trim(),
          priority: 'high',
        });
        continue;
      }

      // Match "FIXME" patterns
      const fixmeMatch = trimmed.match(
        /\bFIXME\b[:\s-]*(.+)/i
      );
      if (fixmeMatch) {
        items.push({
          action: fixmeMatch[1].trim(),
          priority: 'high',
        });
        continue;
      }
    }

    return items;
  }

  /**
   * Detect Jira issue keys mentioned in text.
   *
   * Matches the standard PROJECT-123 pattern (uppercase letters followed
   * by a hyphen and digits).
   *
   * @param text - The text to scan for issue keys
   * @returns Array of unique issue keys found
   */
  static detectIssueKeys(text: string): string[] {
    const pattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
    const matches = text.match(pattern);

    if (!matches) {
      return [];
    }

    // Return unique keys
    return [...new Set(matches)];
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Generate an auto-summary for ticket creation from a session transcript
   */
  private generateTicketSummary(transcript: SessionTranscript): string {
    const { metadata } = transcript;

    if (transcript.summary?.title) {
      return transcript.summary.title;
    }

    const parts: string[] = [];

    if (metadata.projectName) {
      parts.push(`[${metadata.projectName}]`);
    }

    const filesModified = this.extractFilesModified(transcript.events);
    if (filesModified.length > 0) {
      const firstFile = filesModified[0].split('/').pop() || filesModified[0];
      if (filesModified.length === 1) {
        parts.push(`Update ${firstFile}`);
      } else {
        parts.push(
          `Update ${firstFile} and ${filesModified.length - 1} other file(s)`
        );
      }
    } else {
      parts.push('Session work');
    }

    if (metadata.git?.branch) {
      parts.push(`on ${metadata.git.branch}`);
    }

    return parts.join(' ');
  }

  /**
   * Build a rich ADF description for a ticket created from a session
   */
  private buildTicketDescription(
    transcript: SessionTranscript
  ): AdfDocument {
    const { metadata, events } = transcript;

    const adf = new AdfBuilder();

    // Header
    adf.heading(2, 'Session-Generated Ticket');

    // Session metadata panel
    const metaBuilder = new TextBuilder()
      .bold('Session ID: ')
      .code(metadata.sessionId)
      .hardBreak()
      .bold('Started: ')
      .text(metadata.startedAt);

    if (metadata.endedAt) {
      metaBuilder.hardBreak().bold('Ended: ').text(metadata.endedAt);
    }

    if (metadata.git) {
      metaBuilder
        .hardBreak()
        .bold('Branch: ')
        .code(metadata.git.branch)
        .text(' @ ')
        .code(metadata.git.commit);
    }

    adf.panel('info', metaBuilder);

    // Summary from transcript
    if (transcript.summary) {
      if (transcript.summary.accomplishments.length > 0) {
        adf.heading(3, 'Accomplishments');
        adf.bulletList(transcript.summary.accomplishments);
      }

      if (transcript.summary.decisions.length > 0) {
        adf.heading(3, 'Key Decisions');
        adf.orderedList(transcript.summary.decisions);
      }

      if (transcript.summary.nextSteps.length > 0) {
        adf.heading(3, 'Next Steps');
        adf.orderedList(transcript.summary.nextSteps);
      }

      if (transcript.summary.issues.length > 0) {
        adf.heading(3, 'Issues Encountered');
        adf.panel('warning', transcript.summary.issues.join('; '));
      }
    }

    // Files changed
    const filesModified = this.extractFilesModified(events);
    if (filesModified.length > 0) {
      adf.heading(3, 'Files Changed');
      adf.bulletList(
        filesModified
          .slice(0, 15)
          .map((f) => new TextBuilder().code(f).build())
      );
      if (filesModified.length > 15) {
        adf.paragraph(
          new TextBuilder().italic(
            `...and ${filesModified.length - 15} more files`
          )
        );
      }
    }

    // Stats
    adf.heading(3, 'Session Statistics');
    adf.table(
      ['Metric', 'Value'],
      [
        [
          'Duration',
          this.formatDuration(metadata.stats.totalDuration),
        ],
        ['Messages', metadata.stats.messageCount.toString()],
        ['Tool Calls', metadata.stats.toolCallCount.toString()],
        ['Files Read', metadata.stats.filesRead.toString()],
        [
          'Files Written/Edited',
          (
            metadata.stats.filesWritten + metadata.stats.filesEdited
          ).toString(),
        ],
        ['Commands Run', metadata.stats.commandsRun.toString()],
        ['Errors', metadata.stats.errorsEncountered.toString()],
      ]
    );

    // Related issues
    if (metadata.relatedIssues && metadata.relatedIssues.length > 0) {
      adf.heading(3, 'Related Issues');
      adf.bulletList(
        metadata.relatedIssues.map((key) =>
          new TextBuilder().code(key).build()
        )
      );
    }

    return adf.build();
  }

  /**
   * Build an ADF comment describing linked work artifacts
   */
  private buildWorkLinkComment(work: {
    branchName?: string;
    prUrl?: string;
    prTitle?: string;
    commitMessages?: string[];
  }): AdfDocument {
    const adf = new AdfBuilder();

    adf.heading(4, 'Development Work Linked');

    if (work.branchName) {
      adf.paragraph(
        new TextBuilder().bold('Branch: ').code(work.branchName)
      );
    }

    if (work.prUrl) {
      const prText = new TextBuilder().bold('Pull Request: ');
      if (work.prTitle) {
        prText.link(work.prTitle, work.prUrl);
      } else {
        prText.link(work.prUrl, work.prUrl);
      }
      adf.paragraph(prText);
    }

    if (work.commitMessages && work.commitMessages.length > 0) {
      adf.heading(5, 'Recent Commits');
      adf.bulletList(
        work.commitMessages
          .slice(0, 10)
          .map((msg) => new TextBuilder().code(msg).build())
      );
      if (work.commitMessages.length > 10) {
        adf.paragraph(
          new TextBuilder().italic(
            `...and ${work.commitMessages.length - 10} more commits`
          )
        );
      }
    }

    adf.rule();
    adf.paragraph(
      new TextBuilder()
        .italic('Linked by ')
        .bold('@hidden-leaf/atlassian-skill')
    );

    return adf.build();
  }

  /**
   * Extract unique file paths that were modified (written or edited) from events
   */
  private extractFilesModified(events: SessionEvent[]): string[] {
    const files = new Set<string>();

    for (const event of events) {
      if (event.type === 'file_write' || event.type === 'file_edit') {
        const data = event.data as FileOperationData;
        if (data.success) {
          files.add(data.path);
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Extract command strings from session events
   */
  private extractCommands(events: SessionEvent[]): string[] {
    const commands: string[] = [];

    for (const event of events) {
      if (event.type === 'command_run') {
        const data = event.data as CommandData;
        commands.push(data.command);
      }
    }

    return commands;
  }

  /**
   * Format a millisecond duration as a human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SessionBridge instance from environment variables.
 *
 * Reads the following environment variables:
 * - JIRA_PROJECT_KEY: Jira project key (required)
 * - ATLASSIAN_SITE_URL: Atlassian site URL (required)
 * - SESSION_BRIDGE_AUTO_CREATE_TICKETS: Enable auto ticket creation (default: false)
 * - SESSION_BRIDGE_AUTO_LINK_PRS: Enable auto PR linking (default: true)
 * - SESSION_BRIDGE_AUTO_UPDATE_STATUS: Enable auto status updates (default: true)
 * - SESSION_BRIDGE_DEFAULT_LABELS: Comma-separated default labels
 *
 * @param jiraClient - An initialized JiraClient instance
 * @returns A configured SessionBridge instance
 */
export function createSessionBridgeFromEnv(
  jiraClient: JiraClient
): SessionBridge {
  const projectKey = process.env.JIRA_PROJECT_KEY || '';
  const siteUrl = process.env.ATLASSIAN_SITE_URL || '';

  const config: SessionBridgeConfig = {
    projectKey,
    siteUrl,
    autoCreateTickets:
      process.env.SESSION_BRIDGE_AUTO_CREATE_TICKETS === 'true',
    autoLinkPRs:
      process.env.SESSION_BRIDGE_AUTO_LINK_PRS !== 'false',
    autoUpdateStatus:
      process.env.SESSION_BRIDGE_AUTO_UPDATE_STATUS !== 'false',
    defaultLabels: process.env.SESSION_BRIDGE_DEFAULT_LABELS
      ? process.env.SESSION_BRIDGE_DEFAULT_LABELS.split(',').map((l) =>
          l.trim()
        )
      : [],
  };

  return new SessionBridge(jiraClient, config);
}
