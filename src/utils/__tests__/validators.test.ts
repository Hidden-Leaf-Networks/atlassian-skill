import {
  validateHlnLabel,
  validateHlnLabels,
  suggestLabels,
  validateIssueKey,
  validateProjectKey,
  validateJql,
  validateRequired,
  validateStringLength,
  validateEmail,
  validateUrl,
  throwIfInvalid,
  combineValidations,
  HLN_LABEL_PREFIXES,
} from '../validators';
import { ValidationError } from '../../core/types';

describe('validateHlnLabel', () => {
  it('returns null for valid labels with known prefixes', () => {
    expect(validateHlnLabel('team-platform')).toBeNull();
    expect(validateHlnLabel('type-bug')).toBeNull();
    expect(validateHlnLabel('priority-high')).toBeNull();
    expect(validateHlnLabel('status-blocked')).toBeNull();
  });

  it('returns null for valid labels with custom values', () => {
    expect(validateHlnLabel('component-auth')).toBeNull();
    expect(validateHlnLabel('epic-onboarding')).toBeNull();
  });

  it('returns error for labels without valid prefix', () => {
    const result = validateHlnLabel('invalid-label');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('INVALID_LABEL_PREFIX');
  });

  it('returns error for uppercase labels', () => {
    const result = validateHlnLabel('Team-Platform');
    // This gets caught by prefix check first since "Team-" is not a valid prefix
    expect(result).not.toBeNull();
  });

  it('returns error for labels with invalid characters', () => {
    const result = validateHlnLabel('team-platform test');
    // Caught by prefix check or character validation
    expect(result).not.toBeNull();
  });
});

describe('validateHlnLabels', () => {
  it('returns empty array for valid labels', () => {
    const issues = validateHlnLabels(['team-platform', 'type-bug']);
    expect(issues).toEqual([]);
  });

  it('returns issues for invalid labels', () => {
    const issues = validateHlnLabels(['bad-label', 'type-bug']);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_LABEL_PREFIX');
  });

  it('detects duplicate prefixes (except component)', () => {
    const issues = validateHlnLabels(['team-platform', 'team-backend']);
    expect(issues.some(i => i.code === 'DUPLICATE_LABEL_PREFIX')).toBe(true);
  });

  it('allows multiple component labels', () => {
    const issues = validateHlnLabels(['component-auth', 'component-api']);
    expect(issues).toEqual([]);
  });
});

describe('suggestLabels', () => {
  it('suggests type-bug for bug-related content', () => {
    const labels = suggestLabels('Fix login bug', '');
    expect(labels).toContain('type-bug');
  });

  it('suggests type-feature for feature-related content', () => {
    const labels = suggestLabels('Add new dashboard', '');
    expect(labels).toContain('type-feature');
  });

  it('suggests type-tech-debt for refactoring content', () => {
    const labels = suggestLabels('Refactor auth module', '');
    expect(labels).toContain('type-tech-debt');
  });

  it('suggests type-documentation for docs content', () => {
    const labels = suggestLabels('Update documentation', '');
    expect(labels).toContain('type-documentation');
  });

  it('suggests priority-critical for urgent content', () => {
    const labels = suggestLabels('Critical issue', 'urgent blocker');
    expect(labels).toContain('priority-critical');
  });

  it('suggests priority-high for important content', () => {
    const labels = suggestLabels('Important task', 'asap');
    expect(labels).toContain('priority-high');
  });

  it('returns empty array when no patterns match', () => {
    const labels = suggestLabels('Update database schema', 'Change column types');
    expect(labels).toEqual([]);
  });
});

describe('validateIssueKey', () => {
  it('returns null for valid issue keys', () => {
    expect(validateIssueKey('PROJ-123')).toBeNull();
    expect(validateIssueKey('AB-1')).toBeNull();
    expect(validateIssueKey('MY2PROJ-999')).toBeNull();
  });

  it('returns error for invalid issue keys', () => {
    expect(validateIssueKey('proj-123')).not.toBeNull();
    expect(validateIssueKey('PROJ')).not.toBeNull();
    expect(validateIssueKey('123-PROJ')).not.toBeNull();
    expect(validateIssueKey('PROJ-')).not.toBeNull();
    expect(validateIssueKey('')).not.toBeNull();
  });

  it('has proper error code', () => {
    const result = validateIssueKey('invalid');
    expect(result!.code).toBe('INVALID_ISSUE_KEY');
  });
});

describe('validateProjectKey', () => {
  it('returns null for valid project keys', () => {
    expect(validateProjectKey('AB')).toBeNull();
    expect(validateProjectKey('PROJ')).toBeNull();
    expect(validateProjectKey('MY2PROJ')).toBeNull();
  });

  it('returns error for invalid project keys', () => {
    expect(validateProjectKey('A')).not.toBeNull(); // too short
    expect(validateProjectKey('ab')).not.toBeNull(); // lowercase
    expect(validateProjectKey('1PROJ')).not.toBeNull(); // starts with number
    expect(validateProjectKey('ABCDEFGHIJK')).not.toBeNull(); // too long (>10)
  });

  it('has proper error code', () => {
    const result = validateProjectKey('bad');
    expect(result!.code).toBe('INVALID_PROJECT_KEY');
  });
});

describe('validateJql', () => {
  it('returns null for valid JQL', () => {
    expect(validateJql('project = PROJ')).toBeNull();
    expect(validateJql('status = "In Progress" AND assignee = currentUser()')).toBeNull();
  });

  it('returns error for empty JQL', () => {
    const result = validateJql('');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('EMPTY_JQL');
  });

  it('returns error for whitespace-only JQL', () => {
    const result = validateJql('   ');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('EMPTY_JQL');
  });

  it('returns error for unclosed single quotes', () => {
    const result = validateJql("status = 'Open");
    expect(result).not.toBeNull();
    expect(result!.code).toBe('UNCLOSED_QUOTES');
  });

  it('returns error for unclosed double quotes', () => {
    const result = validateJql('status = "Open');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('UNCLOSED_QUOTES');
  });

  it('returns error for unmatched parentheses', () => {
    const result = validateJql('(project = PROJ');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('UNMATCHED_PARENTHESES');
  });
});

describe('validateRequired', () => {
  it('returns empty array when all fields present', () => {
    const data = { name: 'Alice', age: 30 };
    const issues = validateRequired(data, ['name', 'age']);
    expect(issues).toEqual([]);
  });

  it('returns issues for missing fields', () => {
    const data = { name: 'Alice', age: undefined as unknown as number };
    const issues = validateRequired(data, ['name', 'age']);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('REQUIRED_FIELD');
    expect(issues[0].field).toBe('age');
  });

  it('returns issues for null fields', () => {
    const data = { name: null as unknown as string };
    const issues = validateRequired(data, ['name']);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('REQUIRED_FIELD');
  });

  it('returns issues for empty string fields', () => {
    const data = { name: '   ' };
    const issues = validateRequired(data, ['name']);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('EMPTY_FIELD');
  });
});

describe('validateStringLength', () => {
  it('returns null when within bounds', () => {
    expect(validateStringLength('hello', 'name', 1, 10)).toBeNull();
  });

  it('returns error when too short', () => {
    const result = validateStringLength('hi', 'name', 5);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('MIN_LENGTH');
  });

  it('returns error when too long', () => {
    const result = validateStringLength('a very long string', 'name', undefined, 5);
    expect(result).not.toBeNull();
    expect(result!.code).toBe('MAX_LENGTH');
  });
});

describe('validateEmail', () => {
  it('returns null for valid emails', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('first.last@domain.co')).toBeNull();
  });

  it('returns error for invalid emails', () => {
    expect(validateEmail('invalid')).not.toBeNull();
    expect(validateEmail('@domain.com')).not.toBeNull();
    expect(validateEmail('user@')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });

  it('has proper error code', () => {
    expect(validateEmail('bad')!.code).toBe('INVALID_EMAIL');
  });
});

describe('validateUrl', () => {
  it('returns null for valid URLs', () => {
    expect(validateUrl('https://example.com')).toBeNull();
    expect(validateUrl('http://localhost:3000')).toBeNull();
  });

  it('returns error for invalid URLs', () => {
    expect(validateUrl('not-a-url')).not.toBeNull();
    expect(validateUrl('')).not.toBeNull();
  });

  it('uses custom field name', () => {
    const result = validateUrl('bad', 'website');
    expect(result!.field).toBe('website');
  });
});

describe('throwIfInvalid', () => {
  it('does not throw when no issues', () => {
    expect(() => throwIfInvalid([])).not.toThrow();
  });

  it('throws ValidationError when there are issues', () => {
    const issues = [{ field: 'name', message: 'name is required', code: 'REQUIRED_FIELD' }];
    expect(() => throwIfInvalid(issues)).toThrow(ValidationError);
  });

  it('uses custom message', () => {
    const issues = [{ field: 'x', message: 'bad', code: 'ERR' }];
    expect(() => throwIfInvalid(issues, 'Custom error')).toThrow('Custom error');
  });
});

describe('combineValidations', () => {
  it('combines null, single issues, and arrays', () => {
    const single = { field: 'a', message: 'err', code: 'E1' };
    const array = [
      { field: 'b', message: 'err2', code: 'E2' },
      { field: 'c', message: 'err3', code: 'E3' },
    ];
    const result = combineValidations(null, single, array, null);
    expect(result).toHaveLength(3);
    expect(result[0].field).toBe('a');
    expect(result[1].field).toBe('b');
    expect(result[2].field).toBe('c');
  });

  it('returns empty array when all null', () => {
    expect(combineValidations(null, null)).toEqual([]);
  });
});
