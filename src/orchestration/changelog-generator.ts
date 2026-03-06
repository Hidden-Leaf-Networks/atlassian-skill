/**
 * Changelog Generator
 *
 * Generates changelogs and release notes from Jira issues.
 * Supports multiple output formats for PR descriptions,
 * Confluence pages, and standalone markdown files.
 */

import { JiraIssue, JiraVersion } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Changelog output format
 */
export type ChangelogFormat = 'markdown' | 'confluence' | 'plain' | 'html';

/**
 * Issue category for grouping
 */
export type IssueCategory =
  | 'features'
  | 'enhancements'
  | 'bugfixes'
  | 'hotfixes'
  | 'documentation'
  | 'maintenance'
  | 'breaking'
  | 'other';

/**
 * Category metadata
 */
export interface CategoryMeta {
  title: string;
  emoji: string;
  priority: number;
}

/**
 * Changelog generation options
 */
export interface ChangelogOptions {
  /** Output format */
  format?: ChangelogFormat;

  /** Include issue links */
  includeLinks?: boolean;

  /** Include assignees */
  includeAssignees?: boolean;

  /** Include components */
  includeComponents?: boolean;

  /** Include issue descriptions */
  includeDescriptions?: boolean;

  /** Base URL for Jira links */
  jiraBaseUrl?: string;

  /** Group by components instead of type */
  groupByComponent?: boolean;

  /** Include header with version info */
  includeHeader?: boolean;

  /** Date format for release date */
  dateFormat?: 'short' | 'long' | 'iso';

  /** Maximum description length */
  maxDescriptionLength?: number;
}

/**
 * Default changelog options
 */
const DEFAULT_OPTIONS: Required<ChangelogOptions> = {
  format: 'markdown',
  includeLinks: true,
  includeAssignees: false,
  includeComponents: true,
  includeDescriptions: false,
  jiraBaseUrl: '',
  groupByComponent: false,
  includeHeader: true,
  dateFormat: 'long',
  maxDescriptionLength: 200,
};

// ============================================================================
// Category Configuration
// ============================================================================

/**
 * Category metadata for display
 */
const CATEGORY_META: Record<IssueCategory, CategoryMeta> = {
  breaking: { title: 'Breaking Changes', emoji: '!!!', priority: 0 },
  features: { title: 'New Features', emoji: '+', priority: 1 },
  enhancements: { title: 'Enhancements', emoji: '^', priority: 2 },
  bugfixes: { title: 'Bug Fixes', emoji: '*', priority: 3 },
  hotfixes: { title: 'Hotfixes', emoji: '!', priority: 4 },
  documentation: { title: 'Documentation', emoji: '#', priority: 5 },
  maintenance: { title: 'Maintenance', emoji: '~', priority: 6 },
  other: { title: 'Other Changes', emoji: '-', priority: 7 },
};

/**
 * Maps issue types to categories
 */
const ISSUE_TYPE_TO_CATEGORY: Record<string, IssueCategory> = {
  'Story': 'features',
  'Feature': 'features',
  'New Feature': 'features',
  'Epic': 'features',
  'Improvement': 'enhancements',
  'Enhancement': 'enhancements',
  'Task': 'maintenance',
  'Sub-task': 'maintenance',
  'Bug': 'bugfixes',
  'Defect': 'bugfixes',
  'Hotfix': 'hotfixes',
  'Critical Bug': 'hotfixes',
  'Documentation': 'documentation',
  'Chore': 'maintenance',
  'Technical Debt': 'maintenance',
};

// ============================================================================
// Main Generator Functions
// ============================================================================

/**
 * Generates a changelog from a list of Jira issues.
 *
 * @param issues - Jira issues to include in changelog
 * @param options - Generation options
 * @returns Generated changelog string
 *
 * @example
 * const changelog = generateChangelog(issues, {
 *   format: 'markdown',
 *   includeLinks: true,
 *   jiraBaseUrl: 'https://company.atlassian.net'
 * });
 */
export function generateChangelog(
  issues: JiraIssue[],
  options: ChangelogOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (issues.length === 0) {
    return opts.format === 'html'
      ? '<p>No changes in this release.</p>'
      : 'No changes in this release.';
  }

  // Group issues by category
  const grouped = opts.groupByComponent
    ? groupIssuesByComponent(issues)
    : groupIssuesByCategory(issues);

  // Generate based on format
  switch (opts.format) {
    case 'markdown':
      return generateMarkdownChangelog(grouped, opts);
    case 'confluence':
      return generateConfluenceChangelog(grouped, opts);
    case 'html':
      return generateHTMLChangelog(grouped, opts);
    case 'plain':
      return generatePlainChangelog(grouped, opts);
    default:
      return generateMarkdownChangelog(grouped, opts);
  }
}

/**
 * Generates comprehensive release notes for a version.
 *
 * @param version - Version name or Jira version object
 * @param issues - Issues included in the release
 * @param options - Generation options
 * @returns Generated release notes
 */
export function generateReleaseNotes(
  version: string | JiraVersion,
  issues: JiraIssue[],
  options: ChangelogOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options, includeHeader: true };
  const versionName = typeof version === 'string' ? version : version.name;
  const releaseDate = typeof version === 'string' ? new Date() : version.releaseDate ? new Date(version.releaseDate) : new Date();

  const header = generateReleaseHeader(versionName, releaseDate, issues.length, opts);
  const summary = generateReleaseSummary(issues, opts);
  const changelog = generateChangelog(issues, { ...opts, includeHeader: false });
  const contributors = generateContributorsList(issues, opts);

  switch (opts.format) {
    case 'confluence':
      return [
        header,
        summary,
        changelog,
        contributors,
      ].filter(Boolean).join('\n\n');

    case 'html':
      return `<article class="release-notes">\n${header}\n${summary}\n${changelog}\n${contributors}\n</article>`;

    case 'markdown':
    default:
      return [
        header,
        summary,
        '---',
        changelog,
        '---',
        contributors,
      ].filter(Boolean).join('\n\n');
  }
}

/**
 * Generates a compact changelog suitable for PR descriptions.
 *
 * @param issues - Issues to include
 * @param options - Generation options
 * @returns Compact changelog
 */
export function generateCompactChangelog(
  issues: JiraIssue[],
  options: ChangelogOptions = {}
): string {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    includeDescriptions: false,
    includeAssignees: false,
    includeComponents: false,
  };

  return generateChangelog(issues, opts);
}

// ============================================================================
// Format-Specific Generators
// ============================================================================

/**
 * Generates markdown formatted changelog
 */
function generateMarkdownChangelog(
  grouped: Map<string, JiraIssue[]>,
  opts: Required<ChangelogOptions>
): string {
  const sections: string[] = [];

  // Sort groups by priority
  const sortedGroups = sortGroupsByPriority(grouped);

  for (const [category, issues] of sortedGroups) {
    const meta = getCategoryMeta(category);
    sections.push(`### ${meta.title}\n`);

    const items = issues.map(issue => formatIssueMarkdown(issue, opts));
    sections.push(items.join('\n'));
    sections.push('');
  }

  return sections.join('\n').trim();
}

/**
 * Generates Confluence storage format changelog
 */
function generateConfluenceChangelog(
  grouped: Map<string, JiraIssue[]>,
  opts: Required<ChangelogOptions>
): string {
  const sections: string[] = [];

  const sortedGroups = sortGroupsByPriority(grouped);

  for (const [category, issues] of sortedGroups) {
    const meta = getCategoryMeta(category);
    sections.push(`<h3>${meta.title}</h3>`);
    sections.push('<ul>');

    for (const issue of issues) {
      sections.push(formatIssueConfluence(issue, opts));
    }

    sections.push('</ul>');
  }

  return sections.join('\n');
}

/**
 * Generates HTML formatted changelog
 */
function generateHTMLChangelog(
  grouped: Map<string, JiraIssue[]>,
  opts: Required<ChangelogOptions>
): string {
  const sections: string[] = [];

  const sortedGroups = sortGroupsByPriority(grouped);

  for (const [category, issues] of sortedGroups) {
    const meta = getCategoryMeta(category);
    sections.push(`<section class="changelog-section changelog-${category}">`);
    sections.push(`  <h3>${meta.title}</h3>`);
    sections.push('  <ul class="changelog-list">');

    for (const issue of issues) {
      sections.push(formatIssueHTML(issue, opts));
    }

    sections.push('  </ul>');
    sections.push('</section>');
  }

  return sections.join('\n');
}

/**
 * Generates plain text changelog
 */
function generatePlainChangelog(
  grouped: Map<string, JiraIssue[]>,
  opts: Required<ChangelogOptions>
): string {
  const sections: string[] = [];

  const sortedGroups = sortGroupsByPriority(grouped);

  for (const [category, issues] of sortedGroups) {
    const meta = getCategoryMeta(category);
    sections.push(`${meta.title.toUpperCase()}`);
    sections.push('='.repeat(meta.title.length));

    for (const issue of issues) {
      sections.push(formatIssuePlain(issue, opts));
    }

    sections.push('');
  }

  return sections.join('\n').trim();
}

// ============================================================================
// Issue Formatting Functions
// ============================================================================

/**
 * Formats a single issue as markdown
 */
function formatIssueMarkdown(
  issue: JiraIssue,
  opts: Required<ChangelogOptions>
): string {
  const parts: string[] = [];

  // Issue key with optional link
  if (opts.includeLinks && opts.jiraBaseUrl) {
    parts.push(`- [${issue.key}](${opts.jiraBaseUrl}/browse/${issue.key}):`);
  } else {
    parts.push(`- ${issue.key}:`);
  }

  // Summary
  parts.push(issue.fields.summary);

  // Components
  if (opts.includeComponents && issue.fields.components.length > 0) {
    const componentNames = issue.fields.components.map(c => c.name).join(', ');
    parts.push(`(${componentNames})`);
  }

  // Assignee
  if (opts.includeAssignees && issue.fields.assignee) {
    parts.push(`[@${issue.fields.assignee.displayName}]`);
  }

  let line = parts.join(' ');

  // Description
  if (opts.includeDescriptions && issue.fields.description) {
    const desc = truncateDescription(issue.fields.description, opts.maxDescriptionLength);
    line += `\n  > ${desc}`;
  }

  return line;
}

/**
 * Formats a single issue for Confluence
 */
function formatIssueConfluence(
  issue: JiraIssue,
  opts: Required<ChangelogOptions>
): string {
  const parts: string[] = [];

  // Jira issue macro for linking
  if (opts.includeLinks) {
    parts.push(`<li><ac:structured-macro ac:name="jira"><ac:parameter ac:name="key">${issue.key}</ac:parameter></ac:structured-macro>`);
  } else {
    parts.push(`<li><strong>${issue.key}</strong>:`);
  }

  parts.push(escapeHTML(issue.fields.summary));

  if (opts.includeComponents && issue.fields.components.length > 0) {
    const componentNames = issue.fields.components.map(c => escapeHTML(c.name)).join(', ');
    parts.push(`<em>(${componentNames})</em>`);
  }

  if (opts.includeAssignees && issue.fields.assignee) {
    parts.push(`<ac:link><ri:user ri:account-id="${issue.fields.assignee.accountId}"/></ac:link>`);
  }

  parts.push('</li>');

  return parts.join(' ');
}

/**
 * Formats a single issue as HTML
 */
function formatIssueHTML(
  issue: JiraIssue,
  opts: Required<ChangelogOptions>
): string {
  const parts: string[] = [];

  parts.push('    <li class="changelog-item">');

  if (opts.includeLinks && opts.jiraBaseUrl) {
    parts.push(`      <a href="${opts.jiraBaseUrl}/browse/${issue.key}" class="issue-key">${issue.key}</a>:`);
  } else {
    parts.push(`      <span class="issue-key">${issue.key}</span>:`);
  }

  parts.push(`      <span class="issue-summary">${escapeHTML(issue.fields.summary)}</span>`);

  if (opts.includeComponents && issue.fields.components.length > 0) {
    const componentNames = issue.fields.components.map(c => escapeHTML(c.name)).join(', ');
    parts.push(`      <span class="issue-components">(${componentNames})</span>`);
  }

  if (opts.includeAssignees && issue.fields.assignee) {
    parts.push(`      <span class="issue-assignee">@${escapeHTML(issue.fields.assignee.displayName)}</span>`);
  }

  parts.push('    </li>');

  return parts.join('\n');
}

/**
 * Formats a single issue as plain text
 */
function formatIssuePlain(
  issue: JiraIssue,
  opts: Required<ChangelogOptions>
): string {
  const parts: string[] = [];

  parts.push(`  [${issue.key}] ${issue.fields.summary}`);

  if (opts.includeComponents && issue.fields.components.length > 0) {
    const componentNames = issue.fields.components.map(c => c.name).join(', ');
    parts.push(`           Components: ${componentNames}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Header and Summary Generators
// ============================================================================

/**
 * Generates release header
 */
function generateReleaseHeader(
  version: string,
  releaseDate: Date,
  issueCount: number,
  opts: Required<ChangelogOptions>
): string {
  const formattedDate = formatDate(releaseDate, opts.dateFormat);

  switch (opts.format) {
    case 'confluence':
      return `<h1>Release ${escapeHTML(version)}</h1>
<p><strong>Release Date:</strong> ${escapeHTML(formattedDate)}</p>
<p><strong>Issues Resolved:</strong> ${issueCount}</p>`;

    case 'html':
      return `<header class="release-header">
  <h1>Release ${escapeHTML(version)}</h1>
  <p class="release-meta">
    <span class="release-date">Release Date: ${escapeHTML(formattedDate)}</span>
    <span class="release-count">Issues Resolved: ${issueCount}</span>
  </p>
</header>`;

    case 'markdown':
    default:
      return `# Release ${version}

**Release Date:** ${formattedDate}
**Issues Resolved:** ${issueCount}`;
  }
}

/**
 * Generates release summary with statistics
 */
function generateReleaseSummary(
  issues: JiraIssue[],
  opts: Required<ChangelogOptions>
): string {
  const stats = calculateReleaseStats(issues);

  const summaryItems = [
    stats.features > 0 ? `${stats.features} new features` : null,
    stats.enhancements > 0 ? `${stats.enhancements} enhancements` : null,
    stats.bugfixes > 0 ? `${stats.bugfixes} bug fixes` : null,
    stats.hotfixes > 0 ? `${stats.hotfixes} hotfixes` : null,
    stats.other > 0 ? `${stats.other} other changes` : null,
  ].filter(Boolean);

  if (summaryItems.length === 0) {
    return '';
  }

  const summaryText = summaryItems.join(', ');

  switch (opts.format) {
    case 'confluence':
      return `<ac:structured-macro ac:name="info">
<ac:rich-text-body>
<p>This release includes ${summaryText}.</p>
</ac:rich-text-body>
</ac:structured-macro>`;

    case 'html':
      return `<div class="release-summary">
  <p>This release includes ${summaryText}.</p>
</div>`;

    case 'markdown':
    default:
      return `> This release includes ${summaryText}.`;
  }
}

/**
 * Generates list of contributors
 */
function generateContributorsList(
  issues: JiraIssue[],
  opts: Required<ChangelogOptions>
): string {
  const contributors = new Map<string, { name: string; count: number }>();

  for (const issue of issues) {
    if (issue.fields.assignee) {
      const id = issue.fields.assignee.accountId;
      const existing = contributors.get(id);
      if (existing) {
        existing.count++;
      } else {
        contributors.set(id, {
          name: issue.fields.assignee.displayName,
          count: 1,
        });
      }
    }
  }

  if (contributors.size === 0) {
    return '';
  }

  const sorted = Array.from(contributors.values()).sort((a, b) => b.count - a.count);

  switch (opts.format) {
    case 'confluence':
      const confluenceItems = sorted.map(c => `<li>${escapeHTML(c.name)} (${c.count} issues)</li>`);
      return `<h3>Contributors</h3>\n<ul>${confluenceItems.join('')}</ul>`;

    case 'html':
      const htmlItems = sorted.map(c => `    <li>${escapeHTML(c.name)} (${c.count} issues)</li>`);
      return `<section class="contributors">\n  <h3>Contributors</h3>\n  <ul>\n${htmlItems.join('\n')}\n  </ul>\n</section>`;

    case 'markdown':
    default:
      const mdItems = sorted.map(c => `- ${c.name} (${c.count} issues)`);
      return `### Contributors\n\n${mdItems.join('\n')}`;
  }
}

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * Groups issues by their category (type-based)
 */
export function groupIssuesByCategory(issues: JiraIssue[]): Map<IssueCategory, JiraIssue[]> {
  const grouped = new Map<IssueCategory, JiraIssue[]>();

  for (const issue of issues) {
    const category = categorizeIssue(issue);
    const existing = grouped.get(category) || [];
    existing.push(issue);
    grouped.set(category, existing);
  }

  return grouped;
}

/**
 * Groups issues by their component
 */
export function groupIssuesByComponent(issues: JiraIssue[]): Map<string, JiraIssue[]> {
  const grouped = new Map<string, JiraIssue[]>();

  for (const issue of issues) {
    if (issue.fields.components.length === 0) {
      const existing = grouped.get('General') || [];
      existing.push(issue);
      grouped.set('General', existing);
    } else {
      // Add to each component group
      for (const component of issue.fields.components) {
        const existing = grouped.get(component.name) || [];
        existing.push(issue);
        grouped.set(component.name, existing);
      }
    }
  }

  return grouped;
}

/**
 * Categorizes a single issue
 */
export function categorizeIssue(issue: JiraIssue): IssueCategory {
  const issueType = issue.fields.issuetype.name;

  // Check for breaking change label
  if (issue.fields.labels.some(l => l.toLowerCase().includes('breaking'))) {
    return 'breaking';
  }

  // Check direct mapping
  if (issueType in ISSUE_TYPE_TO_CATEGORY) {
    return ISSUE_TYPE_TO_CATEGORY[issueType];
  }

  // Check for priority-based hotfix
  const priority = issue.fields.priority?.name?.toLowerCase();
  if (priority === 'critical' || priority === 'blocker') {
    if (issueType.toLowerCase().includes('bug')) {
      return 'hotfixes';
    }
  }

  return 'other';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets category metadata
 */
function getCategoryMeta(category: string): CategoryMeta {
  if (category in CATEGORY_META) {
    return CATEGORY_META[category as IssueCategory];
  }
  // For component-based grouping
  return { title: category, emoji: '', priority: 99 };
}

/**
 * Sorts groups by priority
 */
function sortGroupsByPriority<T>(
  grouped: Map<string, T[]>
): [string, T[]][] {
  return Array.from(grouped.entries()).sort(([a], [b]) => {
    const metaA = getCategoryMeta(a);
    const metaB = getCategoryMeta(b);
    return metaA.priority - metaB.priority;
  });
}

/**
 * Calculates release statistics
 */
function calculateReleaseStats(issues: JiraIssue[]): Record<IssueCategory | 'total', number> {
  const stats: Record<IssueCategory | 'total', number> = {
    features: 0,
    enhancements: 0,
    bugfixes: 0,
    hotfixes: 0,
    documentation: 0,
    maintenance: 0,
    breaking: 0,
    other: 0,
    total: issues.length,
  };

  for (const issue of issues) {
    const category = categorizeIssue(issue);
    stats[category]++;
  }

  return stats;
}

/**
 * Formats a date based on format option
 */
function formatDate(date: Date, format: 'short' | 'long' | 'iso'): string {
  switch (format) {
    case 'iso':
      return date.toISOString().split('T')[0];
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'long':
    default:
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
  }
}

/**
 * Truncates description to max length
 */
function truncateDescription(description: string, maxLength: number): string {
  // Clean up description (remove markdown/HTML)
  const cleaned = description
    .replace(/<[^>]+>/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * Escapes HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================================
// Exports
// ============================================================================

export {
  CATEGORY_META,
  ISSUE_TYPE_TO_CATEGORY,
  DEFAULT_OPTIONS as DEFAULT_CHANGELOG_OPTIONS,
};
