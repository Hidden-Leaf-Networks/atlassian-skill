/**
 * Validation utilities for the Atlassian Skill
 * Includes HLN convention validators and general data validation
 */

import { ValidationError, ValidationIssue } from '../core/types.js';

// ============================================================================
// HLN Label Convention Validators
// ============================================================================

/**
 * Valid HLN label prefixes
 */
export const HLN_LABEL_PREFIXES = [
  'team-',
  'type-',
  'priority-',
  'status-',
  'component-',
  'epic-',
  'sprint-',
  'release-',
] as const;

export type HlnLabelPrefix = typeof HLN_LABEL_PREFIXES[number];

/**
 * Standard HLN label values by prefix
 */
export const HLN_STANDARD_LABELS: Record<HlnLabelPrefix, string[]> = {
  'team-': ['platform', 'frontend', 'backend', 'devops', 'qa', 'design', 'data'],
  'type-': ['feature', 'bug', 'tech-debt', 'spike', 'chore', 'documentation'],
  'priority-': ['critical', 'high', 'medium', 'low'],
  'status-': ['blocked', 'needs-review', 'ready-for-qa', 'in-progress', 'backlog'],
  'component-': [], // Custom per project
  'epic-': [], // Custom per project
  'sprint-': [], // Dynamic based on sprint names
  'release-': [], // Dynamic based on release versions
};

/**
 * Validate a label against HLN conventions
 */
export function validateHlnLabel(label: string): ValidationIssue | null {
  // Check if label has a valid prefix
  const hasValidPrefix = HLN_LABEL_PREFIXES.some(prefix => label.startsWith(prefix));

  if (!hasValidPrefix) {
    return {
      field: 'label',
      message: `Label "${label}" does not follow HLN conventions. Must start with one of: ${HLN_LABEL_PREFIXES.join(', ')}`,
      code: 'INVALID_LABEL_PREFIX',
    };
  }

  // Check label format (lowercase, hyphenated)
  if (label !== label.toLowerCase()) {
    return {
      field: 'label',
      message: `Label "${label}" must be lowercase`,
      code: 'LABEL_NOT_LOWERCASE',
    };
  }

  if (!/^[a-z0-9-]+$/.test(label)) {
    return {
      field: 'label',
      message: `Label "${label}" contains invalid characters. Use only lowercase letters, numbers, and hyphens`,
      code: 'INVALID_LABEL_CHARACTERS',
    };
  }

  // Check for standard values (warn but don't fail for custom values)
  const prefix = HLN_LABEL_PREFIXES.find(p => label.startsWith(p));
  if (prefix) {
    const value = label.slice(prefix.length);
    const standardValues = HLN_STANDARD_LABELS[prefix];

    if (standardValues.length > 0 && !standardValues.includes(value)) {
      // This is a warning, not an error - allow custom values
      return null;
    }
  }

  return null;
}

/**
 * Validate multiple labels
 */
export function validateHlnLabels(labels: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const label of labels) {
    const issue = validateHlnLabel(label);
    if (issue) {
      issues.push(issue);
    }
  }

  // Check for duplicate prefixes (except component- which can have multiple)
  const prefixCounts = new Map<string, number>();
  for (const label of labels) {
    const prefix = HLN_LABEL_PREFIXES.find(p => label.startsWith(p));
    if (prefix && prefix !== 'component-') {
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
    }
  }

  for (const [prefix, count] of prefixCounts) {
    if (count > 1) {
      issues.push({
        field: 'labels',
        message: `Multiple labels with prefix "${prefix}" found. Each issue should have only one ${prefix.slice(0, -1)} label`,
        code: 'DUPLICATE_LABEL_PREFIX',
      });
    }
  }

  return issues;
}

/**
 * Suggest labels based on issue content
 */
export function suggestLabels(title: string, description: string): string[] {
  const suggestions: string[] = [];
  const text = `${title} ${description}`.toLowerCase();

  // Type suggestions
  if (text.includes('bug') || text.includes('fix') || text.includes('broken')) {
    suggestions.push('type-bug');
  } else if (text.includes('feature') || text.includes('add') || text.includes('new')) {
    suggestions.push('type-feature');
  } else if (text.includes('refactor') || text.includes('cleanup') || text.includes('tech debt')) {
    suggestions.push('type-tech-debt');
  } else if (text.includes('document') || text.includes('readme') || text.includes('docs')) {
    suggestions.push('type-documentation');
  }

  // Priority suggestions
  if (text.includes('critical') || text.includes('urgent') || text.includes('blocker')) {
    suggestions.push('priority-critical');
  } else if (text.includes('important') || text.includes('asap')) {
    suggestions.push('priority-high');
  }

  return suggestions;
}

// ============================================================================
// Jira Field Validators
// ============================================================================

/**
 * Validate Jira issue key format
 */
export function validateIssueKey(key: string): ValidationIssue | null {
  const pattern = /^[A-Z][A-Z0-9]+-\d+$/;

  if (!pattern.test(key)) {
    return {
      field: 'issueKey',
      message: `Invalid issue key format: "${key}". Expected format: PROJECT-123`,
      code: 'INVALID_ISSUE_KEY',
    };
  }

  return null;
}

/**
 * Validate project key format
 */
export function validateProjectKey(key: string): ValidationIssue | null {
  const pattern = /^[A-Z][A-Z0-9]{1,9}$/;

  if (!pattern.test(key)) {
    return {
      field: 'projectKey',
      message: `Invalid project key format: "${key}". Must be 2-10 uppercase letters/numbers starting with a letter`,
      code: 'INVALID_PROJECT_KEY',
    };
  }

  return null;
}

/**
 * Validate JQL query (basic syntax check)
 */
export function validateJql(jql: string): ValidationIssue | null {
  // Check for common JQL syntax issues
  const trimmed = jql.trim();

  if (trimmed.length === 0) {
    return {
      field: 'jql',
      message: 'JQL query cannot be empty',
      code: 'EMPTY_JQL',
    };
  }

  // Check for unclosed quotes
  const singleQuotes = (trimmed.match(/'/g) || []).length;
  const doubleQuotes = (trimmed.match(/"/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    return {
      field: 'jql',
      message: 'JQL query has unclosed single quotes',
      code: 'UNCLOSED_QUOTES',
    };
  }

  if (doubleQuotes % 2 !== 0) {
    return {
      field: 'jql',
      message: 'JQL query has unclosed double quotes',
      code: 'UNCLOSED_QUOTES',
    };
  }

  // Check for unclosed parentheses
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    return {
      field: 'jql',
      message: 'JQL query has unmatched parentheses',
      code: 'UNMATCHED_PARENTHESES',
    };
  }

  return null;
}

// ============================================================================
// General Validators
// ============================================================================

/**
 * Validate required fields
 */
export function validateRequired<T extends object>(
  data: T,
  requiredFields: (keyof T)[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of requiredFields) {
    const value = data[field];

    if (value === undefined || value === null) {
      issues.push({
        field: String(field),
        message: `${String(field)} is required`,
        code: 'REQUIRED_FIELD',
      });
    } else if (typeof value === 'string' && value.trim().length === 0) {
      issues.push({
        field: String(field),
        message: `${String(field)} cannot be empty`,
        code: 'EMPTY_FIELD',
      });
    }
  }

  return issues;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  field: string,
  minLength?: number,
  maxLength?: number
): ValidationIssue | null {
  if (minLength !== undefined && value.length < minLength) {
    return {
      field,
      message: `${field} must be at least ${minLength} characters`,
      code: 'MIN_LENGTH',
    };
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return {
      field,
      message: `${field} must be at most ${maxLength} characters`,
      code: 'MAX_LENGTH',
    };
  }

  return null;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationIssue | null {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!pattern.test(email)) {
    return {
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL',
    };
  }

  return null;
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, field: string = 'url'): ValidationIssue | null {
  try {
    new URL(url);
    return null;
  } catch {
    return {
      field,
      message: `Invalid URL format: ${url}`,
      code: 'INVALID_URL',
    };
  }
}

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Throw ValidationError if there are any issues
 */
export function throwIfInvalid(issues: ValidationIssue[], message?: string): void {
  if (issues.length > 0) {
    throw new ValidationError(
      message || `Validation failed: ${issues.map(i => i.message).join('; ')}`,
      issues
    );
  }
}

/**
 * Combine multiple validation results
 */
export function combineValidations(
  ...results: (ValidationIssue | ValidationIssue[] | null)[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const result of results) {
    if (result === null) {
      continue;
    }

    if (Array.isArray(result)) {
      issues.push(...result);
    } else {
      issues.push(result);
    }
  }

  return issues;
}
