/**
 * Session Capture Types
 */

// ============================================================================
// Session Types
// ============================================================================

/**
 * A captured session event
 */
export interface SessionEvent {
  /** Event type */
  type: SessionEventType;
  /** ISO timestamp */
  timestamp: string;
  /** Event-specific data */
  data: SessionEventData;
}

export type SessionEventType =
  | 'session_start'
  | 'session_end'
  | 'user_message'
  | 'assistant_message'
  | 'tool_use'
  | 'tool_result'
  | 'error'
  | 'file_read'
  | 'file_write'
  | 'file_edit'
  | 'command_run'
  | 'search'
  | 'task_created'
  | 'task_completed';

export type SessionEventData =
  | SessionStartData
  | SessionEndData
  | MessageData
  | ToolUseData
  | ToolResultData
  | ErrorData
  | FileOperationData
  | CommandData
  | SearchData
  | TaskData;

export interface SessionStartData {
  sessionId: string;
  workingDirectory: string;
  projectName?: string;
  gitBranch?: string;
  gitCommit?: string;
}

export interface SessionEndData {
  sessionId: string;
  duration: number;
  totalMessages: number;
  totalToolCalls: number;
  summary?: string;
}

export interface MessageData {
  role: 'user' | 'assistant';
  content: string;
  truncated?: boolean;
}

export interface ToolUseData {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

export interface ToolResultData {
  toolId: string;
  success: boolean;
  output?: string;
  error?: string;
  truncated?: boolean;
}

export interface ErrorData {
  type: string;
  message: string;
  stack?: string;
}

export interface FileOperationData {
  operation: 'read' | 'write' | 'edit' | 'delete';
  path: string;
  linesAffected?: number;
  success: boolean;
}

export interface CommandData {
  command: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  truncated?: boolean;
}

export interface SearchData {
  query: string;
  resultsCount: number;
  searchType: 'grep' | 'glob' | 'web';
}

export interface TaskData {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// ============================================================================
// Session Metadata
// ============================================================================

/**
 * Full session metadata
 */
export interface SessionMetadata {
  /** Unique session ID */
  sessionId: string;
  /** Session start timestamp */
  startedAt: string;
  /** Session end timestamp */
  endedAt?: string;
  /** Working directory */
  workingDirectory: string;
  /** Project name (directory name or package.json name) */
  projectName?: string;
  /** Git repository info */
  git?: {
    branch: string;
    commit: string;
    remote?: string;
    isDirty: boolean;
  };
  /** Summary statistics */
  stats: SessionStats;
  /** Related Jira issues */
  relatedIssues?: string[];
  /** Session tags for categorization */
  tags?: string[];
}

export interface SessionStats {
  totalDuration: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  filesRead: number;
  filesWritten: number;
  filesEdited: number;
  commandsRun: number;
  errorsEncountered: number;
}

// ============================================================================
// Archive Types
// ============================================================================

/**
 * Archive destination configuration
 */
export interface ArchiveConfig {
  /** Where to archive */
  destination: 'confluence' | 'jira' | 'both';
  /** Confluence space key (if applicable) */
  confluenceSpaceKey?: string;
  /** Confluence parent page ID (if applicable) */
  confluenceParentPageId?: string;
  /** Jira project key (if applicable) */
  jiraProjectKey?: string;
  /** Archive format */
  format: ArchiveFormat;
  /** Include full transcript */
  includeFullTranscript: boolean;
  /** Maximum transcript length before summarization */
  maxTranscriptLength?: number;
  /** Redaction patterns for sensitive data */
  redactionPatterns?: RegExp[];
}

export type ArchiveFormat = 'full' | 'summary' | 'structured';

/**
 * Archive result
 */
export interface ArchiveResult {
  success: boolean;
  sessionId: string;
  confluencePageId?: string;
  confluencePageUrl?: string;
  jiraIssueKey?: string;
  jiraIssueUrl?: string;
  error?: string;
}

// ============================================================================
// Transcript Types
// ============================================================================

/**
 * Structured session transcript
 */
export interface SessionTranscript {
  metadata: SessionMetadata;
  events: SessionEvent[];
  summary?: TranscriptSummary;
}

/**
 * AI-generated transcript summary
 */
export interface TranscriptSummary {
  /** One-line summary */
  title: string;
  /** What was accomplished */
  accomplishments: string[];
  /** Files changed */
  filesChanged: string[];
  /** Key decisions made */
  decisions: string[];
  /** Issues encountered */
  issues: string[];
  /** Next steps identified */
  nextSteps: string[];
  /** Jira ticket suggestions */
  suggestedTickets?: SuggestedTicket[];
}

export interface SuggestedTicket {
  type: 'Bug' | 'Task' | 'Story' | 'Improvement';
  summary: string;
  description: string;
  labels: string[];
  priority?: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
}

// ============================================================================
// Hook Configuration
// ============================================================================

/**
 * Session hook configuration
 */
export interface SessionHookConfig {
  /** Enable session capture */
  enabled: boolean;
  /** Capture mode */
  captureMode: 'full' | 'summary' | 'minimal';
  /** Auto-archive on session end */
  autoArchive: boolean;
  /** Archive configuration */
  archiveConfig?: ArchiveConfig;
  /** Event filters */
  eventFilters?: {
    /** Include these event types */
    include?: SessionEventType[];
    /** Exclude these event types */
    exclude?: SessionEventType[];
  };
  /** Content limits */
  limits?: {
    /** Max message content length */
    maxMessageLength?: number;
    /** Max tool output length */
    maxToolOutputLength?: number;
    /** Max events to capture */
    maxEvents?: number;
  };
}

/**
 * Default hook configuration
 */
export const DEFAULT_HOOK_CONFIG: SessionHookConfig = {
  enabled: true,
  captureMode: 'full',
  autoArchive: false,
  limits: {
    maxMessageLength: 10000,
    maxToolOutputLength: 5000,
    maxEvents: 1000,
  },
};
