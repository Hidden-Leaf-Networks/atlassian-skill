/**
 * Session Capture Module
 * Captures Claude Code session transcripts for archival to Confluence/Jira
 */

export { SessionCapture, createSessionCaptureFromEnv } from './capture.js';
export { SessionArchiver, createArchiverFromEnv } from './archiver.js';
export * from './types.js';
