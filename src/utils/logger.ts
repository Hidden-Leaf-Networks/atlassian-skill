/**
 * Logger utility for the Atlassian Skill
 * Provides structured logging with configurable levels and formats
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  context?: string;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  format: 'json',
};

/**
 * Structured logger for the Atlassian Skill
 */
export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      context: this.config.context ? `${this.config.context}:${context}` : context,
    });
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level] as keyof typeof LogLevel,
      message,
      context: this.config.context,
      data,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.output(level, entry);
  }

  /**
   * Output the log entry
   */
  private output(level: LogLevel, entry: LogEntry): void {
    const output = this.config.format === 'json'
      ? JSON.stringify(entry)
      : this.formatText(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Format log entry as text
   */
  private formatText(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
    ];

    if (entry.context) {
      parts.push(`[${entry.context}]`);
    }

    parts.push(entry.message);

    if (entry.data) {
      parts.push(JSON.stringify(entry.data));
    }

    if (entry.error) {
      parts.push(`\nError: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n${entry.error.stack}`);
      }
    }

    return parts.join(' ');
  }
}

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toUpperCase();
  if (normalized in LogLevel) {
    return LogLevel[normalized as keyof typeof LogLevel];
  }
  return LogLevel.INFO;
}

/**
 * Create a logger from environment variables
 */
export function createLoggerFromEnv(context?: string): Logger {
  const level = parseLogLevel(process.env.LOG_LEVEL || 'info');
  const format = (process.env.LOG_FORMAT || 'json') as 'json' | 'text';

  return new Logger({ level, format, context });
}

/**
 * Create a logger with a given context
 */
export function createLogger(context: string): Logger {
  return new Logger({ context });
}

/**
 * Default logger instance
 */
export const logger = createLoggerFromEnv('atlassian-skill');
