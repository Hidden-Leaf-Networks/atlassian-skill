/**
 * Session Archiver Implementation
 * Archives session transcripts to Confluence and/or Jira
 */

import { createLoggerFromEnv, Logger } from '../utils/logger.js';
import { AdfBuilder, TextBuilder } from '../core/adf-builder.js';
import {
  SessionTranscript,
  SessionMetadata,
  SessionEvent,
  ArchiveConfig,
  ArchiveResult,
  TranscriptSummary,
  MessageData,
  ToolUseData,
  FileOperationData,
  CommandData,
} from './types.js';

// ============================================================================
// Session Archiver Class
// ============================================================================

/**
 * Archives session transcripts to Confluence/Jira
 */
export class SessionArchiver {
  private readonly logger: Logger;
  /** Confluence client - will be typed when integrated */
  confluenceClient?: unknown;
  /** Jira client - will be typed when integrated */
  jiraClient?: unknown;

  constructor(options?: {
    confluenceClient?: unknown;
    jiraClient?: unknown;
  }) {
    this.logger = createLoggerFromEnv('session-archiver');
    this.confluenceClient = options?.confluenceClient;
    this.jiraClient = options?.jiraClient;
  }

  /**
   * Archive a session transcript
   */
  async archive(
    transcript: SessionTranscript,
    config: ArchiveConfig
  ): Promise<ArchiveResult> {
    const result: ArchiveResult = {
      success: false,
      sessionId: transcript.metadata.sessionId,
    };

    try {
      // Apply redaction patterns if configured
      const sanitizedTranscript = this.sanitizeTranscript(transcript, config.redactionPatterns);

      // Generate summary if needed
      const summary = transcript.summary || this.generateBasicSummary(sanitizedTranscript);

      if (config.destination === 'confluence' || config.destination === 'both') {
        if (!config.confluenceSpaceKey) {
          throw new Error('Confluence space key required for archiving');
        }

        const pageResult = await this.archiveToConfluence(
          sanitizedTranscript,
          summary,
          config
        );
        result.confluencePageId = pageResult.pageId;
        result.confluencePageUrl = pageResult.pageUrl;
      }

      if (config.destination === 'jira' || config.destination === 'both') {
        if (!config.jiraProjectKey) {
          throw new Error('Jira project key required for archiving');
        }

        const issueResult = await this.archiveToJira(
          sanitizedTranscript,
          summary,
          config
        );
        result.jiraIssueKey = issueResult.issueKey;
        result.jiraIssueUrl = issueResult.issueUrl;
      }

      result.success = true;
      this.logger.info('Session archived successfully', { ...result });
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to archive session', error instanceof Error ? error : undefined, { error: result.error });
    }

    return result;
  }

  /**
   * Archive to Confluence
   */
  private async archiveToConfluence(
    transcript: SessionTranscript,
    summary: TranscriptSummary,
    config: ArchiveConfig
  ): Promise<{ pageId: string; pageUrl: string }> {
    const pageTitle = this.generatePageTitle(transcript.metadata, summary);
    this.buildConfluenceContent(transcript, summary, config);

    // TODO: Use actual Confluence client when integrated
    this.logger.info('Would create Confluence page', {
      spaceKey: config.confluenceSpaceKey,
      parentPageId: config.confluenceParentPageId,
      title: pageTitle,
    });

    // Placeholder - actual implementation would call Confluence API
    return {
      pageId: 'placeholder-page-id',
      pageUrl: `https://your-site.atlassian.net/wiki/spaces/${config.confluenceSpaceKey}/pages/placeholder`,
    };
  }

  /**
   * Archive to Jira
   */
  private async archiveToJira(
    transcript: SessionTranscript,
    summary: TranscriptSummary,
    config: ArchiveConfig
  ): Promise<{ issueKey: string; issueUrl: string }> {
    const issueData = this.buildJiraIssue(transcript, summary, config);

    // TODO: Use actual Jira client when integrated
    this.logger.info('Would create Jira issue', {
      projectKey: config.jiraProjectKey,
      summary: issueData.summary,
    });

    // Placeholder - actual implementation would call Jira API
    return {
      issueKey: `${config.jiraProjectKey}-999`,
      issueUrl: `https://your-site.atlassian.net/browse/${config.jiraProjectKey}-999`,
    };
  }

  /**
   * Build Confluence page content
   */
  private buildConfluenceContent(
    transcript: SessionTranscript,
    summary: TranscriptSummary,
    config: ArchiveConfig
  ): unknown {
    const adf = new AdfBuilder();

    // Header with session info
    adf.heading(1, `Session: ${summary.title}`);

    // Metadata panel
    const metaParts = new TextBuilder()
      .text('Session ID: ').bold(transcript.metadata.sessionId)
      .text(' | Started: ').text(transcript.metadata.startedAt);
    if (transcript.metadata.endedAt) {
      metaParts.text(' | Ended: ').text(transcript.metadata.endedAt);
    }
    if (transcript.metadata.git) {
      metaParts.text(' | Branch: ').code(transcript.metadata.git.branch)
        .text(' @ ').code(transcript.metadata.git.commit);
    }
    adf.panel('info', metaParts);

    // Summary section
    adf.heading(2, 'Summary');

    if (summary.accomplishments.length > 0) {
      adf.heading(3, 'Accomplishments');
      adf.bulletList(summary.accomplishments);
    }

    if (summary.filesChanged.length > 0) {
      adf.heading(3, 'Files Changed');
      adf.bulletList(summary.filesChanged.map(f => new TextBuilder().code(f).build()));
    }

    if (summary.decisions.length > 0) {
      adf.heading(3, 'Key Decisions');
      adf.bulletList(summary.decisions);
    }

    if (summary.issues.length > 0) {
      adf.heading(3, 'Issues Encountered');
      adf.panel('warning', summary.issues.join('; '));
    }

    if (summary.nextSteps.length > 0) {
      adf.heading(3, 'Next Steps');
      adf.orderedList(summary.nextSteps);
    }

    // Statistics
    adf.heading(2, 'Statistics');
    adf.table(
      ['Metric', 'Value'],
      [
        ['Duration', this.formatDuration(transcript.metadata.stats.totalDuration)],
        ['Messages', transcript.metadata.stats.messageCount.toString()],
        ['Tool Calls', transcript.metadata.stats.toolCallCount.toString()],
        ['Files Read', transcript.metadata.stats.filesRead.toString()],
        ['Files Written', transcript.metadata.stats.filesWritten.toString()],
        ['Files Edited', transcript.metadata.stats.filesEdited.toString()],
        ['Commands Run', transcript.metadata.stats.commandsRun.toString()],
        ['Errors', transcript.metadata.stats.errorsEncountered.toString()],
      ]
    );

    // Full transcript (if requested)
    if (config.includeFullTranscript && config.format === 'full') {
      adf.heading(2, 'Full Transcript');
      for (const event of transcript.events) {
        this.addEventToAdf(adf, event);
      }
    }

    // Related issues
    if (transcript.metadata.relatedIssues && transcript.metadata.relatedIssues.length > 0) {
      adf.heading(2, 'Related Issues');
      for (const issueKey of transcript.metadata.relatedIssues) {
        adf.paragraph(new TextBuilder().code(issueKey));
      }
    }

    return adf.build();
  }

  /**
   * Build Jira issue data
   */
  private buildJiraIssue(
    transcript: SessionTranscript,
    summary: TranscriptSummary,
    _config: ArchiveConfig
  ): { summary: string; description: unknown } {
    const adf = new AdfBuilder();

    adf.heading(2, 'Session Summary');
    adf.bulletList(summary.accomplishments);

    if (summary.filesChanged.length > 0) {
      adf.heading(3, 'Files Changed');
      adf.bulletList(summary.filesChanged.slice(0, 10).map(f => new TextBuilder().code(f).build()));
      if (summary.filesChanged.length > 10) {
        adf.paragraph(`...and ${summary.filesChanged.length - 10} more files`);
      }
    }

    if (summary.nextSteps.length > 0) {
      adf.heading(3, 'Next Steps');
      adf.orderedList(summary.nextSteps);
    }

    // Link to Confluence page if created
    adf.paragraph(new TextBuilder().text('Session ID: ').code(transcript.metadata.sessionId));

    return {
      summary: `[Session Archive] ${summary.title}`,
      description: adf.build(),
    };
  }

  /**
   * Add an event to ADF content
   */
  private addEventToAdf(builder: AdfBuilder, event: SessionEvent): void {
    const timestamp = new Date(event.timestamp).toLocaleTimeString();

    switch (event.type) {
      case 'user_message': {
        const data = event.data as MessageData;
        builder.panel('note', new TextBuilder().bold(`[${timestamp}] User: `).text(data.content));
        break;
      }

      case 'assistant_message': {
        const data = event.data as MessageData;
        builder.paragraph(new TextBuilder().bold(`[${timestamp}] Assistant:`));
        builder.paragraph(data.content.slice(0, 2000));
        if (data.content.length > 2000) {
          builder.paragraph(new TextBuilder().italic('...[truncated]'));
        }
        break;
      }

      case 'tool_use': {
        const data = event.data as ToolUseData;
        builder.paragraph(new TextBuilder().text(`[${timestamp}] `).code(data.toolName));
        break;
      }

      case 'file_write':
      case 'file_edit': {
        const data = event.data as FileOperationData;
        builder.paragraph(new TextBuilder().text(`[${timestamp}] ${data.operation}: `).code(data.path));
        break;
      }

      case 'command_run': {
        const data = event.data as CommandData;
        builder.codeBlock(data.command, 'bash');
        break;
      }

      default:
        // Skip other events in transcript view
        break;
    }
  }

  /**
   * Generate a basic summary from the transcript
   */
  private generateBasicSummary(transcript: SessionTranscript): TranscriptSummary {
    const filesChanged = new Set<string>();
    const accomplishments: string[] = [];

    for (const event of transcript.events) {
      if (event.type === 'file_write' || event.type === 'file_edit') {
        const data = event.data as FileOperationData;
        filesChanged.add(data.path);
      }
    }

    if (filesChanged.size > 0) {
      accomplishments.push(`Modified ${filesChanged.size} file(s)`);
    }

    if (transcript.metadata.stats.commandsRun > 0) {
      accomplishments.push(`Ran ${transcript.metadata.stats.commandsRun} command(s)`);
    }

    return {
      title: transcript.metadata.projectName
        ? `Work on ${transcript.metadata.projectName}`
        : 'Claude Code Session',
      accomplishments,
      filesChanged: Array.from(filesChanged),
      decisions: [],
      issues: transcript.metadata.stats.errorsEncountered > 0
        ? [`Encountered ${transcript.metadata.stats.errorsEncountered} error(s)`]
        : [],
      nextSteps: [],
    };
  }

  /**
   * Generate page title
   */
  private generatePageTitle(metadata: SessionMetadata, summary: TranscriptSummary): string {
    const date = new Date(metadata.startedAt).toISOString().split('T')[0];
    const project = metadata.projectName || 'Unknown Project';
    return `${date} - ${project} - ${summary.title}`;
  }

  /**
   * Sanitize transcript by applying redaction patterns
   */
  private sanitizeTranscript(
    transcript: SessionTranscript,
    patterns?: RegExp[]
  ): SessionTranscript {
    if (!patterns || patterns.length === 0) {
      return transcript;
    }

    const sanitizeString = (str: string): string => {
      let result = str;
      for (const pattern of patterns) {
        result = result.replace(pattern, '[REDACTED]');
      }
      return result;
    };

    const sanitizedEvents = transcript.events.map(event => ({
      ...event,
      data: JSON.parse(sanitizeString(JSON.stringify(event.data))),
    }));

    return {
      ...transcript,
      events: sanitizedEvents,
    };
  }

  /**
   * Format duration in human-readable form
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
 * Create session archiver from environment configuration
 */
export function createArchiverFromEnv(): SessionArchiver {
  // TODO: Initialize with actual clients when available
  return new SessionArchiver();
}
