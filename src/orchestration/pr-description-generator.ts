/**
 * PR Description Generator
 *
 * Generates intelligent pull request descriptions by combining:
 * - Jira issue context
 * - Session summary from development work
 * - Code diff analysis
 * - Testing recommendations
 */

import {
  JiraIssue,
  SessionContext,
} from './types';
import { categorizeIssue } from './changelog-generator';

// ============================================================================
// Types
// ============================================================================

/**
 * PR description template type
 */
export type PRTemplateType = 'standard' | 'minimal' | 'detailed' | 'release';

/**
 * Options for generating PR descriptions
 */
export interface PRDescriptionOptions {
  /** Template style */
  template?: PRTemplateType;

  /** Include Jira issue details */
  includeJiraContext?: boolean;

  /** Include session summary */
  includeSessionSummary?: boolean;

  /** Include diff analysis */
  includeDiffAnalysis?: boolean;

  /** Include testing notes */
  includeTestingNotes?: boolean;

  /** Include checklist */
  includeChecklist?: boolean;

  /** Include related issues */
  includeRelatedIssues?: boolean;

  /** Base URL for Jira links */
  jiraBaseUrl?: string;

  /** Custom sections to add */
  customSections?: PRCustomSection[];

  /** Maximum description length */
  maxLength?: number;
}

/**
 * Custom section for PR description
 */
export interface PRCustomSection {
  title: string;
  content: string;
  position?: 'before_summary' | 'after_summary' | 'before_checklist' | 'end';
}

/**
 * Diff analysis result
 */
export interface DiffAnalysis {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  filesByType: Record<string, number>;
  hasTests: boolean;
  hasDocChanges: boolean;
  hasConfigChanges: boolean;
  hasMigrations: boolean;
  impactedAreas: string[];
}

/**
 * Generated PR description
 */
export interface GeneratedPRDescription {
  title: string;
  body: string;
  labels: string[];
  reviewers?: string[];
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<PRDescriptionOptions> = {
  template: 'standard',
  includeJiraContext: true,
  includeSessionSummary: true,
  includeDiffAnalysis: true,
  includeTestingNotes: true,
  includeChecklist: true,
  includeRelatedIssues: true,
  jiraBaseUrl: '',
  customSections: [],
  maxLength: 65535, // GitHub PR description limit
};

// ============================================================================
// Main Generator Functions
// ============================================================================

/**
 * Generates a complete PR description from available context.
 *
 * @param issue - The Jira issue this PR addresses
 * @param sessionSummary - Summary of the development session
 * @param diff - Optional raw diff content for analysis
 * @param options - Generation options
 * @returns Generated PR description with title, body, and suggested labels
 *
 * @example
 * const pr = generatePRDescription(issue, sessionSummary, diff, {
 *   template: 'standard',
 *   jiraBaseUrl: 'https://company.atlassian.net'
 * });
 */
export function generatePRDescription(
  issue: JiraIssue,
  sessionSummary: string | null,
  diff: string | null = null,
  options: PRDescriptionOptions = {}
): GeneratedPRDescription {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Generate title
  const title = generatePRTitle(issue);

  // Analyze diff if provided
  const diffAnalysis = diff ? analyzeDiff(diff) : null;

  // Generate body based on template
  const body = generatePRBody(issue, sessionSummary, diffAnalysis, opts);

  // Suggest labels
  const labels = suggestLabels(issue, diffAnalysis);

  return { title, body, labels };
}

/**
 * Generates a PR title from a Jira issue.
 *
 * Format: [ISSUE-KEY] Summary
 *
 * @param issue - The Jira issue
 * @returns Generated PR title
 */
export function generatePRTitle(issue: JiraIssue): string {
  const summary = issue.fields.summary;
  const key = issue.key;

  // Truncate summary if too long (keeping room for key)
  const maxSummaryLength = 72 - key.length - 3; // 72 char limit, minus key and brackets/space
  const truncatedSummary =
    summary.length > maxSummaryLength
      ? summary.slice(0, maxSummaryLength - 3) + '...'
      : summary;

  return `[${key}] ${truncatedSummary}`;
}

/**
 * Generates the PR body content.
 */
function generatePRBody(
  issue: JiraIssue,
  sessionSummary: string | null,
  diffAnalysis: DiffAnalysis | null,
  opts: Required<PRDescriptionOptions>
): string {
  switch (opts.template) {
    case 'minimal':
      return generateMinimalBody(issue, opts);
    case 'detailed':
      return generateDetailedBody(issue, sessionSummary, diffAnalysis, opts);
    case 'release':
      return generateReleaseBody(issue, diffAnalysis, opts);
    case 'standard':
    default:
      return generateStandardBody(issue, sessionSummary, diffAnalysis, opts);
  }
}

// ============================================================================
// Template Generators
// ============================================================================

/**
 * Generates standard template body
 */
function generateStandardBody(
  issue: JiraIssue,
  sessionSummary: string | null,
  diffAnalysis: DiffAnalysis | null,
  opts: Required<PRDescriptionOptions>
): string {
  const sections: string[] = [];

  // Custom sections (before_summary)
  sections.push(...getCustomSections(opts.customSections, 'before_summary'));

  // Summary section
  sections.push('## Summary');
  sections.push('');

  if (opts.includeJiraContext) {
    sections.push(generateJiraContext(issue, opts.jiraBaseUrl));
    sections.push('');
  }

  if (opts.includeSessionSummary && sessionSummary) {
    sections.push('### Changes Made');
    sections.push('');
    sections.push(sessionSummary);
    sections.push('');
  }

  // Custom sections (after_summary)
  sections.push(...getCustomSections(opts.customSections, 'after_summary'));

  // Diff analysis
  if (opts.includeDiffAnalysis && diffAnalysis) {
    sections.push('## Changes');
    sections.push('');
    sections.push(generateDiffSummary(diffAnalysis));
    sections.push('');
  }

  // Related issues
  if (opts.includeRelatedIssues) {
    const related = generateRelatedIssues(issue, opts.jiraBaseUrl);
    if (related) {
      sections.push('## Related Issues');
      sections.push('');
      sections.push(related);
      sections.push('');
    }
  }

  // Testing notes
  if (opts.includeTestingNotes) {
    sections.push('## Testing');
    sections.push('');
    sections.push(generateTestingNotes(issue, diffAnalysis));
    sections.push('');
  }

  // Custom sections (before_checklist)
  sections.push(...getCustomSections(opts.customSections, 'before_checklist'));

  // Checklist
  if (opts.includeChecklist) {
    sections.push('## Checklist');
    sections.push('');
    sections.push(generateChecklist(diffAnalysis));
    sections.push('');
  }

  // Custom sections (end)
  sections.push(...getCustomSections(opts.customSections, 'end'));

  return truncateBody(sections.join('\n'), opts.maxLength);
}

/**
 * Generates minimal template body
 */
function generateMinimalBody(
  issue: JiraIssue,
  opts: Required<PRDescriptionOptions>
): string {
  const sections: string[] = [];

  // Link to Jira
  if (opts.jiraBaseUrl) {
    sections.push(`Resolves [${issue.key}](${opts.jiraBaseUrl}/browse/${issue.key})`);
  } else {
    sections.push(`Resolves ${issue.key}`);
  }

  sections.push('');
  sections.push('## Summary');
  sections.push('');
  sections.push(issue.fields.summary);

  if (issue.fields.description) {
    sections.push('');
    sections.push(truncateText(cleanDescription(issue.fields.description), 500));
  }

  return sections.join('\n');
}

/**
 * Generates detailed template body
 */
function generateDetailedBody(
  issue: JiraIssue,
  sessionSummary: string | null,
  diffAnalysis: DiffAnalysis | null,
  opts: Required<PRDescriptionOptions>
): string {
  const sections: string[] = [];

  // Header with issue info
  sections.push('## Overview');
  sections.push('');
  sections.push(`| Field | Value |`);
  sections.push(`|-------|-------|`);
  sections.push(`| **Issue** | ${formatIssueLink(issue, opts.jiraBaseUrl)} |`);
  sections.push(`| **Type** | ${issue.fields.issuetype.name} |`);
  sections.push(`| **Priority** | ${issue.fields.priority?.name || 'None'} |`);
  sections.push(`| **Assignee** | ${issue.fields.assignee?.displayName || 'Unassigned'} |`);

  if (issue.fields.components.length > 0) {
    sections.push(`| **Components** | ${issue.fields.components.map(c => c.name).join(', ')} |`);
  }

  sections.push('');

  // Description
  sections.push('## Description');
  sections.push('');
  if (issue.fields.description) {
    sections.push(cleanDescription(issue.fields.description));
  } else {
    sections.push('_No description provided in Jira._');
  }
  sections.push('');

  // Implementation details
  if (sessionSummary) {
    sections.push('## Implementation Details');
    sections.push('');
    sections.push(sessionSummary);
    sections.push('');
  }

  // Comprehensive diff analysis
  if (diffAnalysis) {
    sections.push('## Impact Analysis');
    sections.push('');
    sections.push(generateDetailedDiffAnalysis(diffAnalysis));
    sections.push('');
  }

  // Testing strategy
  sections.push('## Testing Strategy');
  sections.push('');
  sections.push(generateDetailedTestingNotes(issue, diffAnalysis));
  sections.push('');

  // Deployment notes
  sections.push('## Deployment Notes');
  sections.push('');
  sections.push(generateDeploymentNotes(diffAnalysis));
  sections.push('');

  // Checklist
  sections.push('## Review Checklist');
  sections.push('');
  sections.push(generateDetailedChecklist(diffAnalysis));

  return truncateBody(sections.join('\n'), opts.maxLength);
}

/**
 * Generates release template body
 */
function generateReleaseBody(
  issue: JiraIssue,
  diffAnalysis: DiffAnalysis | null,
  _opts: Required<PRDescriptionOptions>
): string {
  const sections: string[] = [];

  sections.push('## Release Summary');
  sections.push('');
  sections.push(`This PR prepares the release for ${issue.key}.`);
  sections.push('');

  if (diffAnalysis) {
    sections.push('## Changes Included');
    sections.push('');
    sections.push(generateDiffSummary(diffAnalysis));
    sections.push('');
  }

  sections.push('## Pre-Release Checklist');
  sections.push('');
  sections.push('- [ ] All feature PRs merged');
  sections.push('- [ ] Version numbers updated');
  sections.push('- [ ] Changelog updated');
  sections.push('- [ ] Documentation updated');
  sections.push('- [ ] All tests passing');
  sections.push('- [ ] QA sign-off obtained');
  sections.push('- [ ] Stakeholder approval');
  sections.push('');

  sections.push('## Post-Release Steps');
  sections.push('');
  sections.push('- [ ] Tag release in git');
  sections.push('- [ ] Deploy to production');
  sections.push('- [ ] Verify deployment');
  sections.push('- [ ] Close Jira version');
  sections.push('- [ ] Announce release');

  return sections.join('\n');
}

// ============================================================================
// Context Generators
// ============================================================================

/**
 * Generates Jira issue context section
 */
function generateJiraContext(issue: JiraIssue, baseUrl: string): string {
  const lines: string[] = [];

  const issueLink = formatIssueLink(issue, baseUrl);
  lines.push(`This PR addresses ${issueLink}.`);

  if (issue.fields.description) {
    lines.push('');
    lines.push('> ' + truncateText(cleanDescription(issue.fields.description), 300).replace(/\n/g, '\n> '));
  }

  return lines.join('\n');
}

/**
 * Generates related issues section
 */
function generateRelatedIssues(issue: JiraIssue, baseUrl: string): string | null {
  const related: string[] = [];

  // Parent issue
  if (issue.fields.parent) {
    related.push(`- Parent: ${formatIssueKeyLink(issue.fields.parent.key, baseUrl)} - ${issue.fields.parent.fields.summary}`);
  }

  // Subtasks
  if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
    for (const subtask of issue.fields.subtasks.slice(0, 5)) {
      const status = subtask.fields.status.name;
      const statusIcon = status.toLowerCase() === 'done' ? '[x]' : '[ ]';
      related.push(`- ${statusIcon} ${formatIssueKeyLink(subtask.key, baseUrl)} - ${subtask.fields.summary}`);
    }
    if (issue.fields.subtasks.length > 5) {
      related.push(`- ... and ${issue.fields.subtasks.length - 5} more subtasks`);
    }
  }

  return related.length > 0 ? related.join('\n') : null;
}

/**
 * Generates testing notes
 */
function generateTestingNotes(
  issue: JiraIssue,
  diffAnalysis: DiffAnalysis | null
): string {
  const notes: string[] = [];
  const category = categorizeIssue(issue);

  // Category-specific testing guidance
  switch (category) {
    case 'bugfixes':
    case 'hotfixes':
      notes.push('- [ ] Verify the reported bug is fixed');
      notes.push('- [ ] Test regression scenarios');
      notes.push('- [ ] Verify no new issues introduced');
      break;

    case 'features':
      notes.push('- [ ] Test new functionality end-to-end');
      notes.push('- [ ] Verify acceptance criteria met');
      notes.push('- [ ] Test edge cases');
      break;

    case 'enhancements':
      notes.push('- [ ] Verify enhancement works as expected');
      notes.push('- [ ] Test backward compatibility');
      break;

    default:
      notes.push('- [ ] Verify changes work as expected');
  }

  // Diff-based testing suggestions
  if (diffAnalysis) {
    if (diffAnalysis.hasTests) {
      notes.push('- [ ] Review new/updated tests');
    } else if (diffAnalysis.filesChanged > 0) {
      notes.push('- [ ] Consider adding tests for changes');
    }

    if (diffAnalysis.hasConfigChanges) {
      notes.push('- [ ] Verify configuration changes');
    }

    if (diffAnalysis.hasMigrations) {
      notes.push('- [ ] Test database migrations');
      notes.push('- [ ] Verify rollback procedure');
    }

    if (diffAnalysis.impactedAreas.length > 0) {
      notes.push(`- [ ] Test impacted areas: ${diffAnalysis.impactedAreas.join(', ')}`);
    }
  }

  return notes.join('\n');
}

/**
 * Generates detailed testing notes
 */
function generateDetailedTestingNotes(
  issue: JiraIssue,
  diffAnalysis: DiffAnalysis | null
): string {
  const notes: string[] = [];

  notes.push('### Unit Tests');
  notes.push('- [ ] All unit tests pass locally');
  notes.push('- [ ] New functionality has test coverage');
  notes.push('');

  notes.push('### Integration Tests');
  notes.push('- [ ] Integration tests pass');
  notes.push('- [ ] API contracts verified');
  notes.push('');

  notes.push('### Manual Testing');
  notes.push(generateTestingNotes(issue, diffAnalysis));

  return notes.join('\n');
}

/**
 * Generates deployment notes
 */
function generateDeploymentNotes(diffAnalysis: DiffAnalysis | null): string {
  const notes: string[] = [];

  if (!diffAnalysis) {
    notes.push('- No special deployment considerations');
    return notes.join('\n');
  }

  if (diffAnalysis.hasMigrations) {
    notes.push('**Database Migrations Required**');
    notes.push('- Run migrations before deploying new code');
    notes.push('- Verify migration success before proceeding');
    notes.push('');
  }

  if (diffAnalysis.hasConfigChanges) {
    notes.push('**Configuration Changes**');
    notes.push('- Update environment variables as needed');
    notes.push('- Verify configuration in target environment');
    notes.push('');
  }

  if (notes.length === 0) {
    notes.push('- Standard deployment process');
  }

  return notes.join('\n');
}

/**
 * Generates checklist
 */
function generateChecklist(diffAnalysis: DiffAnalysis | null): string {
  const items: string[] = [];

  items.push('- [ ] Code follows project conventions');
  items.push('- [ ] Self-review completed');

  if (diffAnalysis?.hasTests) {
    items.push('- [ ] Tests added/updated');
  }

  if (diffAnalysis?.hasDocChanges) {
    items.push('- [ ] Documentation updated');
  }

  items.push('- [ ] No breaking changes (or documented)');

  return items.join('\n');
}

/**
 * Generates detailed checklist
 */
function generateDetailedChecklist(diffAnalysis: DiffAnalysis | null): string {
  const items: string[] = [];

  items.push('### Code Quality');
  items.push('- [ ] Code follows project style guide');
  items.push('- [ ] No commented-out code');
  items.push('- [ ] No console.log/debug statements');
  items.push('- [ ] Error handling is appropriate');
  items.push('');

  items.push('### Testing');
  items.push('- [ ] Unit tests pass');
  items.push('- [ ] Integration tests pass');
  items.push('- [ ] Manual testing completed');
  items.push('');

  items.push('### Documentation');
  items.push('- [ ] Code comments where needed');
  if (diffAnalysis?.hasDocChanges) {
    items.push('- [ ] Documentation changes reviewed');
  }
  items.push('');

  items.push('### Security');
  items.push('- [ ] No sensitive data exposed');
  items.push('- [ ] Input validation added where needed');
  items.push('- [ ] Authentication/authorization checked');

  return items.join('\n');
}

// ============================================================================
// Diff Analysis
// ============================================================================

/**
 * Analyzes a diff to extract useful information
 */
export function analyzeDiff(diff: string): DiffAnalysis {
  const lines = diff.split('\n');

  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  const filesByType: Record<string, number> = {};
  let hasTests = false;
  let hasDocChanges = false;
  let hasConfigChanges = false;
  let hasMigrations = false;
  const impactedAreas = new Set<string>();

  for (const line of lines) {
    // Count files
    if (line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---')) {
      if (line.startsWith('diff --git')) {
        filesChanged++;
      }

      // Extract file path
      const match = line.match(/[ab]\/(.+)$/);
      if (match) {
        const filePath = match[1];
        const ext = filePath.split('.').pop() || 'unknown';

        // Count by extension
        filesByType[ext] = (filesByType[ext] || 0) + 1;

        // Detect special files
        if (filePath.includes('test') || filePath.includes('spec')) {
          hasTests = true;
        }
        if (filePath.endsWith('.md') || filePath.includes('docs/')) {
          hasDocChanges = true;
        }
        if (
          filePath.includes('config') ||
          filePath.endsWith('.env') ||
          filePath.endsWith('.yaml') ||
          filePath.endsWith('.yml') ||
          filePath.endsWith('.json')
        ) {
          hasConfigChanges = true;
        }
        if (filePath.includes('migration')) {
          hasMigrations = true;
        }

        // Detect impacted areas from path
        const parts = filePath.split('/');
        if (parts.length > 1) {
          impactedAreas.add(parts[0]);
          if (parts.length > 2 && parts[0] === 'src') {
            impactedAreas.add(parts[1]);
          }
        }
      }
    }

    // Count added/removed lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      linesAdded++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      linesRemoved++;
    }
  }

  return {
    filesChanged,
    linesAdded,
    linesRemoved,
    filesByType,
    hasTests,
    hasDocChanges,
    hasConfigChanges,
    hasMigrations,
    impactedAreas: Array.from(impactedAreas),
  };
}

/**
 * Generates diff summary text
 */
function generateDiffSummary(analysis: DiffAnalysis): string {
  const lines: string[] = [];

  lines.push(`- **Files changed:** ${analysis.filesChanged}`);
  lines.push(`- **Lines added:** +${analysis.linesAdded}`);
  lines.push(`- **Lines removed:** -${analysis.linesRemoved}`);

  if (Object.keys(analysis.filesByType).length > 0) {
    const types = Object.entries(analysis.filesByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ext, count]) => `${ext} (${count})`)
      .join(', ');
    lines.push(`- **File types:** ${types}`);
  }

  return lines.join('\n');
}

/**
 * Generates detailed diff analysis
 */
function generateDetailedDiffAnalysis(analysis: DiffAnalysis): string {
  const lines: string[] = [];

  lines.push('### Change Statistics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Files Changed | ${analysis.filesChanged} |`);
  lines.push(`| Lines Added | +${analysis.linesAdded} |`);
  lines.push(`| Lines Removed | -${analysis.linesRemoved} |`);
  lines.push(`| Net Change | ${analysis.linesAdded - analysis.linesRemoved > 0 ? '+' : ''}${analysis.linesAdded - analysis.linesRemoved} |`);
  lines.push('');

  lines.push('### Change Categories');
  lines.push('');

  const categories: string[] = [];
  if (analysis.hasTests) categories.push('Tests');
  if (analysis.hasDocChanges) categories.push('Documentation');
  if (analysis.hasConfigChanges) categories.push('Configuration');
  if (analysis.hasMigrations) categories.push('Database Migrations');

  if (categories.length > 0) {
    lines.push(`Includes: ${categories.join(', ')}`);
  } else {
    lines.push('Standard code changes');
  }

  if (analysis.impactedAreas.length > 0) {
    lines.push('');
    lines.push('### Impacted Areas');
    lines.push('');
    lines.push(analysis.impactedAreas.map(area => `- ${area}`).join('\n'));
  }

  return lines.join('\n');
}

// ============================================================================
// Label Suggestions
// ============================================================================

/**
 * Suggests labels based on issue and diff analysis
 */
export function suggestLabels(
  issue: JiraIssue,
  diffAnalysis: DiffAnalysis | null
): string[] {
  const labels: string[] = [];
  const category = categorizeIssue(issue);

  // Category-based labels
  switch (category) {
    case 'features':
      labels.push('feature');
      break;
    case 'bugfixes':
      labels.push('bug');
      break;
    case 'hotfixes':
      labels.push('hotfix', 'urgent');
      break;
    case 'enhancements':
      labels.push('enhancement');
      break;
    case 'documentation':
      labels.push('documentation');
      break;
    case 'maintenance':
      labels.push('maintenance');
      break;
    case 'breaking':
      labels.push('breaking-change');
      break;
  }

  // Priority-based labels
  const priority = issue.fields.priority?.name?.toLowerCase();
  if (priority === 'critical' || priority === 'blocker') {
    labels.push('priority:critical');
  } else if (priority === 'high') {
    labels.push('priority:high');
  }

  // Diff-based labels
  if (diffAnalysis) {
    if (diffAnalysis.hasTests) {
      labels.push('has-tests');
    }
    if (diffAnalysis.hasDocChanges) {
      labels.push('documentation');
    }
    if (diffAnalysis.hasMigrations) {
      labels.push('database');
    }
    if (diffAnalysis.hasConfigChanges) {
      labels.push('configuration');
    }

    // Size labels
    const totalChanges = diffAnalysis.linesAdded + diffAnalysis.linesRemoved;
    if (totalChanges < 50) {
      labels.push('size:small');
    } else if (totalChanges < 200) {
      labels.push('size:medium');
    } else {
      labels.push('size:large');
    }
  }

  // Component-based labels
  for (const component of issue.fields.components) {
    labels.push(`component:${component.name.toLowerCase().replace(/\s+/g, '-')}`);
  }

  // Deduplicate
  return [...new Set(labels)];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats an issue as a link
 */
function formatIssueLink(issue: JiraIssue, baseUrl: string): string {
  if (baseUrl) {
    return `[${issue.key}](${baseUrl}/browse/${issue.key})`;
  }
  return issue.key;
}

/**
 * Formats an issue key as a link
 */
function formatIssueKeyLink(key: string, baseUrl: string): string {
  if (baseUrl) {
    return `[${key}](${baseUrl}/browse/${key})`;
  }
  return key;
}

/**
 * Cleans Jira description (removes wiki markup, etc.)
 */
function cleanDescription(description: string): string {
  return description
    // Remove Jira wiki markup
    .replace(/\{code[^}]*\}[\s\S]*?\{code\}/g, '```\n[code block]\n```')
    .replace(/\{noformat\}[\s\S]*?\{noformat\}/g, '[formatted text]')
    .replace(/\{quote\}/g, '> ')
    .replace(/\[([^\]]+)\|([^\]]+)\]/g, '[$1]($2)')
    .replace(/\*([^*]+)\*/g, '**$1**')
    .replace(/_([^_]+)_/g, '_$1_')
    .replace(/\+([^+]+)\+/g, '$1')
    .replace(/-([^-]+)-/g, '~~$1~~')
    .replace(/h[1-6]\.\s*/g, '### ')
    .trim();
}

/**
 * Truncates text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncates body to max length, preserving structure
 */
function truncateBody(body: string, maxLength: number): string {
  if (body.length <= maxLength) {
    return body;
  }

  // Try to truncate at a section boundary
  const truncated = body.slice(0, maxLength - 50);
  const lastSection = truncated.lastIndexOf('\n## ');

  if (lastSection > body.length / 2) {
    return body.slice(0, lastSection) + '\n\n_[Description truncated due to length]_';
  }

  return truncated + '\n\n_[Description truncated due to length]_';
}

/**
 * Gets custom sections for a specific position
 */
function getCustomSections(
  sections: PRCustomSection[],
  position: PRCustomSection['position']
): string[] {
  return sections
    .filter(s => s.position === position)
    .flatMap(s => [`## ${s.title}`, '', s.content, '']);
}

// ============================================================================
// Session-Based Description
// ============================================================================

/**
 * Generates a PR description from a session context
 */
export function generatePRDescriptionFromSession(
  issue: JiraIssue,
  session: SessionContext,
  diff: string | null = null,
  options: PRDescriptionOptions = {}
): GeneratedPRDescription {
  return generatePRDescription(issue, session.summary || null, diff, options);
}

/**
 * Generates a quick PR description with minimal context
 */
export function generateQuickPRDescription(
  issueKey: string,
  summary: string,
  changes: string,
  jiraBaseUrl?: string
): string {
  const lines: string[] = [];

  if (jiraBaseUrl) {
    lines.push(`Resolves [${issueKey}](${jiraBaseUrl}/browse/${issueKey})`);
  } else {
    lines.push(`Resolves ${issueKey}`);
  }

  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(summary);
  lines.push('');
  lines.push('## Changes');
  lines.push('');
  lines.push(changes);

  return lines.join('\n');
}
