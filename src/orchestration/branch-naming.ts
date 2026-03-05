/**
 * Branch Naming Conventions
 *
 * Handles HLN branch naming conventions for Atlassian integration.
 * Generates standardized branch names from Jira issues and extracts
 * issue keys from existing branch names.
 */

import {
  JiraIssue,
  WorkType,
  ISSUE_TYPE_TO_WORK_TYPE,
  WorkflowConfig,
  DEFAULT_WORKFLOW_CONFIG,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Branch prefixes for different work types
 */
export const BRANCH_PREFIXES: Record<WorkType, string> = {
  feature: 'feature',
  bugfix: 'bugfix',
  hotfix: 'hotfix',
  release: 'release',
  chore: 'chore',
  docs: 'docs',
};

/**
 * Characters not allowed in branch names
 */
const INVALID_BRANCH_CHARS = /[~^:?*\[\]\\@{}\s]/g;

/**
 * Pattern to match issue keys in branch names
 */
const ISSUE_KEY_PATTERN = /([A-Z][A-Z0-9]*-\d+)/;

/**
 * Pattern to validate full branch name format
 */
const BRANCH_NAME_PATTERN = /^(feature|bugfix|hotfix|release|chore|docs)\/[A-Z][A-Z0-9]*-\d+(-[a-z0-9-]+)?$/;

/**
 * Release branch pattern
 */
const RELEASE_BRANCH_PATTERN = /^release\/v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;

// ============================================================================
// Branch Name Generation
// ============================================================================

/**
 * Options for branch name generation
 */
export interface BranchNameOptions {
  /** Maximum length for the branch name */
  maxLength?: number;

  /** Separator between words */
  separator?: string;

  /** Include the work type prefix */
  includeTypePrefix?: boolean;

  /** Custom work type override */
  workTypeOverride?: WorkType;
}

/**
 * Generates a branch name from a Jira issue following HLN conventions.
 *
 * Format: {type}/{ISSUE-KEY}-{short-summary}
 * Example: feature/PROJ-123-add-user-authentication
 *
 * @param issue - The Jira issue to generate a branch name for
 * @param options - Optional configuration
 * @returns The generated branch name
 */
export function generateBranchName(
  issue: JiraIssue,
  options: BranchNameOptions = {}
): string {
  const {
    maxLength = DEFAULT_WORKFLOW_CONFIG.branchNaming.maxLength,
    separator = DEFAULT_WORKFLOW_CONFIG.branchNaming.separator,
    includeTypePrefix = DEFAULT_WORKFLOW_CONFIG.branchNaming.includeTypePrefix,
    workTypeOverride,
  } = options;

  // Determine work type from issue type or override
  const workType = workTypeOverride ?? getWorkTypeFromIssue(issue);
  const prefix = BRANCH_PREFIXES[workType];

  // Get and sanitize the issue key
  const issueKey = issue.key.toUpperCase();

  // Sanitize and shorten the summary
  const sanitizedSummary = sanitizeBranchSegment(issue.fields.summary, separator);

  // Build the branch name
  let branchName: string;
  if (includeTypePrefix) {
    branchName = `${prefix}/${issueKey}${separator}${sanitizedSummary}`;
  } else {
    branchName = `${issueKey}${separator}${sanitizedSummary}`;
  }

  // Truncate if necessary
  if (branchName.length > maxLength) {
    branchName = truncateBranchName(branchName, maxLength, separator);
  }

  return branchName;
}

/**
 * Generates a release branch name.
 *
 * Format: release/v{major}.{minor}.{patch}
 * Example: release/v1.2.0
 *
 * @param version - The version string (e.g., "1.2.0" or "v1.2.0")
 * @returns The release branch name
 */
export function generateReleaseBranchName(version: string): string {
  // Ensure version starts with 'v'
  const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
  return `release/${normalizedVersion}`;
}

/**
 * Generates a hotfix branch name.
 *
 * Format: hotfix/{ISSUE-KEY}-{short-description}
 * Example: hotfix/PROJ-789-fix-critical-auth-bug
 *
 * @param issue - The Jira issue for the hotfix
 * @param options - Optional configuration
 * @returns The hotfix branch name
 */
export function generateHotfixBranchName(
  issue: JiraIssue,
  options: BranchNameOptions = {}
): string {
  return generateBranchName(issue, {
    ...options,
    workTypeOverride: 'hotfix',
  });
}

// ============================================================================
// Branch Name Extraction
// ============================================================================

/**
 * Extracts a Jira issue key from a branch name.
 *
 * @param branchName - The branch name to extract from
 * @returns The issue key if found, null otherwise
 *
 * @example
 * extractIssueKeyFromBranch('feature/PROJ-123-add-feature') // 'PROJ-123'
 * extractIssueKeyFromBranch('PROJ-456-bug-fix') // 'PROJ-456'
 * extractIssueKeyFromBranch('main') // null
 */
export function extractIssueKeyFromBranch(branchName: string): string | null {
  const match = branchName.match(ISSUE_KEY_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extracts multiple issue keys from a branch name.
 * Useful for branches that reference multiple issues.
 *
 * @param branchName - The branch name to extract from
 * @returns Array of found issue keys
 *
 * @example
 * extractAllIssueKeysFromBranch('feature/PROJ-123-PROJ-124-combined-work')
 * // ['PROJ-123', 'PROJ-124']
 */
export function extractAllIssueKeysFromBranch(branchName: string): string[] {
  const pattern = new RegExp(ISSUE_KEY_PATTERN.source, 'g');
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(branchName)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1]);
    }
  }

  return matches;
}

/**
 * Extracts the work type from a branch name.
 *
 * @param branchName - The branch name to analyze
 * @returns The work type if found, null otherwise
 *
 * @example
 * extractWorkTypeFromBranch('feature/PROJ-123-add-feature') // 'feature'
 * extractWorkTypeFromBranch('hotfix/PROJ-456-critical-fix') // 'hotfix'
 * extractWorkTypeFromBranch('PROJ-789-no-prefix') // null
 */
export function extractWorkTypeFromBranch(branchName: string): WorkType | null {
  const prefix = branchName.split('/')[0];
  if (prefix in BRANCH_PREFIXES) {
    return prefix as WorkType;
  }
  return null;
}

/**
 * Extracts version from a release branch name.
 *
 * @param branchName - The release branch name
 * @returns The version string if valid release branch, null otherwise
 *
 * @example
 * extractVersionFromReleaseBranch('release/v1.2.0') // '1.2.0'
 * extractVersionFromReleaseBranch('release/1.2.0') // '1.2.0'
 * extractVersionFromReleaseBranch('feature/xyz') // null
 */
export function extractVersionFromReleaseBranch(branchName: string): string | null {
  if (!branchName.startsWith('release/')) {
    return null;
  }

  const versionPart = branchName.slice('release/'.length);
  const version = versionPart.startsWith('v') ? versionPart.slice(1) : versionPart;

  // Basic semver validation
  if (/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(version)) {
    return version;
  }

  return null;
}

// ============================================================================
// Branch Name Validation
// ============================================================================

/**
 * Validation result for branch names
 */
export interface BranchNameValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalized?: string;
}

/**
 * Validates a branch name against HLN conventions.
 *
 * @param branchName - The branch name to validate
 * @param config - Optional workflow configuration
 * @returns Validation result with errors and warnings
 */
export function validateBranchName(
  branchName: string,
  config: Partial<WorkflowConfig> = {}
): BranchNameValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const maxLength = config.branchNaming?.maxLength ?? DEFAULT_WORKFLOW_CONFIG.branchNaming.maxLength;

  // Check for empty branch name
  if (!branchName || branchName.trim() === '') {
    return { valid: false, errors: ['Branch name cannot be empty'], warnings: [] };
  }

  // Check for invalid characters
  if (INVALID_BRANCH_CHARS.test(branchName)) {
    errors.push('Branch name contains invalid characters (spaces, ~, ^, :, ?, *, [, ], \\, @, {, })');
  }

  // Check for consecutive slashes
  if (branchName.includes('//')) {
    errors.push('Branch name cannot contain consecutive slashes');
  }

  // Check for leading/trailing slashes
  if (branchName.startsWith('/') || branchName.endsWith('/')) {
    errors.push('Branch name cannot start or end with a slash');
  }

  // Check for .lock suffix
  if (branchName.endsWith('.lock')) {
    errors.push('Branch name cannot end with .lock');
  }

  // Check length
  if (branchName.length > maxLength) {
    errors.push(`Branch name exceeds maximum length of ${maxLength} characters`);
  }

  // Check format (warning only)
  const isStandardFormat = BRANCH_NAME_PATTERN.test(branchName);
  const isReleaseFormat = RELEASE_BRANCH_PATTERN.test(branchName);

  if (!isStandardFormat && !isReleaseFormat) {
    // Check if it at least has an issue key
    const hasIssueKey = ISSUE_KEY_PATTERN.test(branchName);
    if (!hasIssueKey && !branchName.startsWith('release/')) {
      warnings.push('Branch name does not contain a Jira issue key');
    }

    // Check for type prefix
    const hasPrefix = Object.keys(BRANCH_PREFIXES).some(prefix =>
      branchName.startsWith(`${prefix}/`)
    );
    if (!hasPrefix) {
      warnings.push('Branch name does not follow HLN convention (missing type prefix)');
    }
  }

  // Check for uppercase in summary portion
  const parts = branchName.split('/');
  if (parts.length > 1) {
    const summaryPart = parts.slice(1).join('/');
    // Skip the issue key portion when checking for uppercase
    const afterIssueKey = summaryPart.replace(ISSUE_KEY_PATTERN, '');
    if (/[A-Z]/.test(afterIssueKey)) {
      warnings.push('Summary portion of branch name should be lowercase');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalizeBranchName(branchName) : undefined,
  };
}

/**
 * Simple validation check (returns boolean only).
 *
 * @param branchName - The branch name to validate
 * @returns true if valid, false otherwise
 */
export function isValidBranchName(branchName: string): boolean {
  return validateBranchName(branchName).valid;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the work type from a Jira issue.
 *
 * @param issue - The Jira issue
 * @returns The determined work type
 */
export function getWorkTypeFromIssue(issue: JiraIssue): WorkType {
  const issueTypeName = issue.fields.issuetype.name;

  // Check direct mapping
  if (issueTypeName in ISSUE_TYPE_TO_WORK_TYPE) {
    return ISSUE_TYPE_TO_WORK_TYPE[issueTypeName];
  }

  // Check for priority-based hotfix detection
  const priority = issue.fields.priority?.name?.toLowerCase();
  if (priority === 'critical' || priority === 'blocker') {
    const isBug =
      issueTypeName.toLowerCase().includes('bug') ||
      issueTypeName.toLowerCase().includes('defect');
    if (isBug) {
      return 'hotfix';
    }
  }

  // Default to feature
  return 'feature';
}

/**
 * Sanitizes a string for use as a branch name segment.
 *
 * @param segment - The string to sanitize
 * @param separator - The separator to use between words
 * @returns Sanitized string
 */
export function sanitizeBranchSegment(segment: string, separator: string = '-'): string {
  return (
    segment
      // Convert to lowercase
      .toLowerCase()
      // Replace spaces and underscores with separator
      .replace(/[\s_]+/g, separator)
      // Remove invalid characters
      .replace(INVALID_BRANCH_CHARS, '')
      // Remove special characters except separator and alphanumeric
      .replace(new RegExp(`[^a-z0-9${separator}]`, 'g'), '')
      // Replace multiple separators with single
      .replace(new RegExp(`${separator}+`, 'g'), separator)
      // Remove leading/trailing separators
      .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
  );
}

/**
 * Truncates a branch name intelligently at word boundaries.
 *
 * @param branchName - The branch name to truncate
 * @param maxLength - Maximum length
 * @param separator - Word separator
 * @returns Truncated branch name
 */
function truncateBranchName(
  branchName: string,
  maxLength: number,
  separator: string
): string {
  if (branchName.length <= maxLength) {
    return branchName;
  }

  // Find the last separator before maxLength
  const truncated = branchName.slice(0, maxLength);
  const lastSeparatorIndex = truncated.lastIndexOf(separator);

  if (lastSeparatorIndex > branchName.indexOf('/') + 10) {
    // Only truncate at separator if we keep at least 10 chars after the /
    return truncated.slice(0, lastSeparatorIndex);
  }

  // Otherwise just hard truncate
  return truncated;
}

/**
 * Normalizes a branch name (removes redundant characters).
 *
 * @param branchName - The branch name to normalize
 * @returns Normalized branch name
 */
function normalizeBranchName(branchName: string): string {
  return branchName
    .replace(/--+/g, '-')
    .replace(/-\//g, '/')
    .replace(/\/-/g, '/')
    .replace(/-$/g, '');
}

// ============================================================================
// Branch Name Parsing
// ============================================================================

/**
 * Parsed branch name components
 */
export interface ParsedBranchName {
  /** Work type prefix (feature, bugfix, etc.) */
  workType: WorkType | null;

  /** Jira issue key */
  issueKey: string | null;

  /** Description/summary portion */
  description: string | null;

  /** For release branches, the version */
  version: string | null;

  /** Whether the branch follows HLN conventions */
  isStandardFormat: boolean;
}

/**
 * Parses a branch name into its components.
 *
 * @param branchName - The branch name to parse
 * @returns Parsed components
 *
 * @example
 * parseBranchName('feature/PROJ-123-add-authentication')
 * // {
 * //   workType: 'feature',
 * //   issueKey: 'PROJ-123',
 * //   description: 'add-authentication',
 * //   version: null,
 * //   isStandardFormat: true
 * // }
 */
export function parseBranchName(branchName: string): ParsedBranchName {
  const workType = extractWorkTypeFromBranch(branchName);
  const issueKey = extractIssueKeyFromBranch(branchName);
  const version = extractVersionFromReleaseBranch(branchName);

  let description: string | null = null;
  let isStandardFormat = false;

  if (workType) {
    // Remove the prefix
    const withoutPrefix = branchName.slice(workType.length + 1);

    if (issueKey) {
      // Extract description after issue key
      const issueKeyIndex = withoutPrefix.indexOf(issueKey);
      if (issueKeyIndex !== -1) {
        const afterKey = withoutPrefix.slice(issueKeyIndex + issueKey.length);
        description = afterKey.startsWith('-') ? afterKey.slice(1) : afterKey || null;
        isStandardFormat = true;
      }
    } else if (version) {
      // Release branch with version
      isStandardFormat = true;
    }
  } else if (issueKey) {
    // Branch without prefix but with issue key
    const issueKeyIndex = branchName.indexOf(issueKey);
    const afterKey = branchName.slice(issueKeyIndex + issueKey.length);
    description = afterKey.startsWith('-') ? afterKey.slice(1) : afterKey || null;
  }

  return {
    workType,
    issueKey,
    description,
    version,
    isStandardFormat,
  };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Filters branches that are associated with a specific Jira project.
 *
 * @param branches - List of branch names
 * @param projectKey - Jira project key (e.g., 'PROJ')
 * @returns Filtered branch names
 */
export function filterBranchesByProject(
  branches: string[],
  projectKey: string
): string[] {
  const projectPattern = new RegExp(`${projectKey}-\\d+`);
  return branches.filter(branch => projectPattern.test(branch));
}

/**
 * Groups branches by their work type.
 *
 * @param branches - List of branch names
 * @returns Branches grouped by work type
 */
export function groupBranchesByWorkType(
  branches: string[]
): Record<WorkType | 'unknown', string[]> {
  const grouped: Record<WorkType | 'unknown', string[]> = {
    feature: [],
    bugfix: [],
    hotfix: [],
    release: [],
    chore: [],
    docs: [],
    unknown: [],
  };

  for (const branch of branches) {
    const workType = extractWorkTypeFromBranch(branch);
    if (workType) {
      grouped[workType].push(branch);
    } else {
      grouped.unknown.push(branch);
    }
  }

  return grouped;
}

/**
 * Finds branches that match a specific Jira issue.
 *
 * @param branches - List of branch names
 * @param issueKey - The Jira issue key to find
 * @returns Matching branch names
 */
export function findBranchesForIssue(branches: string[], issueKey: string): string[] {
  const normalizedKey = issueKey.toUpperCase();
  return branches.filter(branch => {
    const extractedKey = extractIssueKeyFromBranch(branch);
    return extractedKey?.toUpperCase() === normalizedKey;
  });
}
