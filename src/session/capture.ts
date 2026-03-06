/**
 * Session Capture Implementation
 * Captures and processes Claude Code session events
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createLoggerFromEnv, Logger } from '../utils/logger.js';
import {
  SessionEvent,
  SessionEventType,
  SessionEventData,
  SessionMetadata,
  SessionStats,
  SessionTranscript,
  SessionHookConfig,
  DEFAULT_HOOK_CONFIG,
  SessionStartData,
  SessionEndData,
  MessageData,
  ToolUseData,
  ToolResultData,
  FileOperationData,
  CommandData,
} from './types.js';

// ============================================================================
// Session Capture Class
// ============================================================================

/**
 * Captures and manages session events
 */
export class SessionCapture {
  private readonly config: SessionHookConfig;
  private readonly logger: Logger;
  private events: SessionEvent[] = [];
  private metadata: Partial<SessionMetadata> = {};
  private stats: SessionStats = this.initStats();
  private startTime: number = 0;
  private isActive: boolean = false;

  constructor(config: Partial<SessionHookConfig> = {}) {
    this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
    this.logger = createLoggerFromEnv('session-capture');
  }

  /**
   * Start capturing a new session
   */
  startSession(options?: {
    sessionId?: string;
    workingDirectory?: string;
    projectName?: string;
  }): void {
    if (this.isActive) {
      this.logger.warn('Session already active, ending previous session');
      this.endSession();
    }

    this.events = [];
    this.stats = this.initStats();
    this.startTime = Date.now();
    this.isActive = true;

    const sessionId = options?.sessionId || this.generateSessionId();
    const workingDirectory = options?.workingDirectory || process.cwd();
    const gitInfo = this.getGitInfo(workingDirectory);

    this.metadata = {
      sessionId,
      startedAt: new Date().toISOString(),
      workingDirectory,
      projectName: options?.projectName || this.getProjectName(workingDirectory),
      git: gitInfo,
      stats: this.stats,
      relatedIssues: [],
      tags: [],
    };

    this.addEvent('session_start', {
      sessionId,
      workingDirectory,
      projectName: this.metadata.projectName,
      gitBranch: gitInfo?.branch,
      gitCommit: gitInfo?.commit,
    } as SessionStartData);

    this.logger.info('Session capture started', { sessionId });
  }

  /**
   * End the current session
   */
  endSession(summary?: string): SessionTranscript {
    if (!this.isActive) {
      this.logger.warn('No active session to end');
      return this.getTranscript();
    }

    const duration = Date.now() - this.startTime;

    this.addEvent('session_end', {
      sessionId: this.metadata.sessionId!,
      duration,
      totalMessages: this.stats.messageCount,
      totalToolCalls: this.stats.toolCallCount,
      summary,
    } as SessionEndData);

    this.metadata.endedAt = new Date().toISOString();
    this.stats.totalDuration = duration;
    this.isActive = false;

    this.logger.info('Session capture ended', {
      sessionId: this.metadata.sessionId,
      duration,
      events: this.events.length,
    });

    return this.getTranscript();
  }

  /**
   * Capture a user message
   */
  captureUserMessage(content: string): void {
    if (!this.shouldCapture('user_message')) return;

    const truncated = content.length > (this.config.limits?.maxMessageLength || 10000);
    const messageContent = truncated
      ? content.slice(0, this.config.limits?.maxMessageLength) + '...[truncated]'
      : content;

    this.addEvent('user_message', {
      role: 'user',
      content: messageContent,
      truncated,
    } as MessageData);

    this.stats.messageCount++;
    this.stats.userMessageCount++;

    // Extract potential Jira issue keys
    this.extractIssueKeys(content);
  }

  /**
   * Capture an assistant message
   */
  captureAssistantMessage(content: string): void {
    if (!this.shouldCapture('assistant_message')) return;

    const truncated = content.length > (this.config.limits?.maxMessageLength || 10000);
    const messageContent = truncated
      ? content.slice(0, this.config.limits?.maxMessageLength) + '...[truncated]'
      : content;

    this.addEvent('assistant_message', {
      role: 'assistant',
      content: messageContent,
      truncated,
    } as MessageData);

    this.stats.messageCount++;
    this.stats.assistantMessageCount++;
  }

  /**
   * Capture a tool use
   */
  captureToolUse(toolName: string, toolId: string, input: Record<string, unknown>): void {
    if (!this.shouldCapture('tool_use')) return;

    this.addEvent('tool_use', {
      toolName,
      toolId,
      input: this.sanitizeInput(input),
    } as ToolUseData);

    this.stats.toolCallCount++;
  }

  /**
   * Capture a tool result
   */
  captureToolResult(toolId: string, success: boolean, output?: string, error?: string): void {
    if (!this.shouldCapture('tool_result')) return;

    const maxLength = this.config.limits?.maxToolOutputLength || 5000;
    const truncated = (output?.length || 0) > maxLength;

    this.addEvent('tool_result', {
      toolId,
      success,
      output: truncated ? output?.slice(0, maxLength) + '...[truncated]' : output,
      error,
      truncated,
    } as ToolResultData);

    if (!success) {
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Capture a file operation
   */
  captureFileOperation(
    operation: 'read' | 'write' | 'edit' | 'delete',
    path: string,
    success: boolean,
    linesAffected?: number
  ): void {
    if (!this.shouldCapture('file_read') && !this.shouldCapture('file_write') && !this.shouldCapture('file_edit')) {
      return;
    }

    const eventType = operation === 'read' ? 'file_read' :
                      operation === 'write' ? 'file_write' : 'file_edit';

    this.addEvent(eventType, {
      operation,
      path,
      linesAffected,
      success,
    } as FileOperationData);

    if (success) {
      switch (operation) {
        case 'read':
          this.stats.filesRead++;
          break;
        case 'write':
          this.stats.filesWritten++;
          break;
        case 'edit':
          this.stats.filesEdited++;
          break;
      }
    }
  }

  /**
   * Capture a command execution
   */
  captureCommand(
    command: string,
    exitCode?: number,
    stdout?: string,
    stderr?: string
  ): void {
    if (!this.shouldCapture('command_run')) return;

    const maxLength = this.config.limits?.maxToolOutputLength || 5000;
    const outputTruncated = (stdout?.length || 0) > maxLength;

    this.addEvent('command_run', {
      command,
      exitCode,
      stdout: outputTruncated ? stdout?.slice(0, maxLength) + '...[truncated]' : stdout,
      stderr: stderr?.slice(0, 1000),
      truncated: outputTruncated,
    } as CommandData);

    this.stats.commandsRun++;

    if (exitCode !== undefined && exitCode !== 0) {
      this.stats.errorsEncountered++;
    }
  }

  /**
   * Capture an error
   */
  captureError(type: string, message: string, stack?: string): void {
    if (!this.shouldCapture('error')) return;

    this.addEvent('error', { type, message, stack });
    this.stats.errorsEncountered++;
  }

  /**
   * Add a related Jira issue
   */
  addRelatedIssue(issueKey: string): void {
    if (!this.metadata.relatedIssues?.includes(issueKey)) {
      this.metadata.relatedIssues?.push(issueKey);
    }
  }

  /**
   * Add session tags
   */
  addTags(...tags: string[]): void {
    for (const tag of tags) {
      if (!this.metadata.tags?.includes(tag)) {
        this.metadata.tags?.push(tag);
      }
    }
  }

  /**
   * Get the current transcript
   */
  getTranscript(): SessionTranscript {
    return {
      metadata: this.getMetadata(),
      events: [...this.events],
    };
  }

  /**
   * Get session metadata
   */
  getMetadata(): SessionMetadata {
    return {
      sessionId: this.metadata.sessionId || 'unknown',
      startedAt: this.metadata.startedAt || new Date().toISOString(),
      endedAt: this.metadata.endedAt,
      workingDirectory: this.metadata.workingDirectory || process.cwd(),
      projectName: this.metadata.projectName,
      git: this.metadata.git,
      stats: { ...this.stats },
      relatedIssues: [...(this.metadata.relatedIssues || [])],
      tags: [...(this.metadata.tags || [])],
    };
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private addEvent(type: SessionEventType, data: SessionEventData): void {
    if (this.events.length >= (this.config.limits?.maxEvents || 1000)) {
      this.logger.warn('Max events reached, dropping oldest event');
      this.events.shift();
    }

    this.events.push({
      type,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  private shouldCapture(eventType: SessionEventType): boolean {
    if (!this.config.enabled || !this.isActive) return false;

    const { include, exclude } = this.config.eventFilters || {};

    if (include && !include.includes(eventType)) return false;
    if (exclude && exclude.includes(eventType)) return false;

    return true;
  }

  private initStats(): SessionStats {
    return {
      totalDuration: 0,
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      toolCallCount: 0,
      filesRead: 0,
      filesWritten: 0,
      filesEdited: 0,
      commandsRun: 0,
      errorsEncountered: 0,
    };
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `sess_${timestamp}_${random}`;
  }

  private getGitInfo(workingDirectory: string): SessionMetadata['git'] | undefined {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workingDirectory,
        encoding: 'utf-8',
      }).trim();

      const commit = execSync('git rev-parse --short HEAD', {
        cwd: workingDirectory,
        encoding: 'utf-8',
      }).trim();

      const remote = execSync('git remote get-url origin 2>/dev/null || echo ""', {
        cwd: workingDirectory,
        encoding: 'utf-8',
      }).trim() || undefined;

      const isDirty = execSync('git status --porcelain', {
        cwd: workingDirectory,
        encoding: 'utf-8',
      }).trim().length > 0;

      return { branch, commit, remote, isDirty };
    } catch {
      return undefined;
    }
  }

  private getProjectName(workingDirectory: string): string | undefined {
    try {
      const raw = readFileSync(`${workingDirectory}/package.json`, 'utf-8');
      const packageJson = JSON.parse(raw);
      return packageJson.name as string;
    } catch {
      return workingDirectory.split('/').pop();
    }
  }

  private extractIssueKeys(text: string): void {
    // Match Jira issue keys (PROJECT-123 format)
    const issueKeyPattern = /\b([A-Z][A-Z0-9]+-\d+)\b/g;
    const matches = text.match(issueKeyPattern);

    if (matches) {
      for (const key of matches) {
        this.addRelatedIssue(key);
      }
    }
  }

  private sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
    // Remove potentially sensitive data
    const sanitized = { ...input };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create session capture from environment configuration
 */
export function createSessionCaptureFromEnv(): SessionCapture {
  const config: Partial<SessionHookConfig> = {
    enabled: process.env.SESSION_CAPTURE_ENABLED !== 'false',
    captureMode: (process.env.SESSION_CAPTURE_MODE as 'full' | 'summary' | 'minimal') || 'full',
    autoArchive: process.env.SESSION_AUTO_ARCHIVE === 'true',
  };

  return new SessionCapture(config);
}
