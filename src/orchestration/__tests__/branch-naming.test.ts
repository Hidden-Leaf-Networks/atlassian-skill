import {
  generateBranchName,
  generateReleaseBranchName,
  generateHotfixBranchName,
  extractIssueKeyFromBranch,
  extractAllIssueKeysFromBranch,
  extractWorkTypeFromBranch,
  extractVersionFromReleaseBranch,
  validateBranchName,
  isValidBranchName,
  parseBranchName,
  sanitizeBranchSegment,
  getWorkTypeFromIssue,
  filterBranchesByProject,
  groupBranchesByWorkType,
  findBranchesForIssue,
  BRANCH_PREFIXES,
} from '../branch-naming';
import { JiraIssue } from '../types';

// Helper to create a minimal JiraIssue for testing
function makeIssue(overrides: Partial<{
  key: string;
  summary: string;
  issueType: string;
  priority: string;
}>): JiraIssue {
  return {
    key: overrides.key ?? 'PROJ-123',
    id: '10001',
    self: 'https://jira.example.com/rest/api/2/issue/10001',
    fields: {
      summary: overrides.summary ?? 'Add user authentication',
      description: null,
      issuetype: { name: overrides.issueType ?? 'Story', subtask: false },
      status: { name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
      priority: overrides.priority ? { name: overrides.priority } : undefined,
      labels: [],
      fixVersions: [],
      components: [],
      created: '2024-01-01T00:00:00.000Z',
      updated: '2024-01-01T00:00:00.000Z',
    },
  };
}

describe('generateBranchName', () => {
  it('generates standard branch name with type prefix', () => {
    const issue = makeIssue({ key: 'PROJ-123', summary: 'Add user authentication', issueType: 'Story' });
    const result = generateBranchName(issue);
    expect(result).toBe('feature/PROJ-123-add-user-authentication');
  });

  it('generates bugfix branch name', () => {
    const issue = makeIssue({ issueType: 'Bug', summary: 'Fix login error' });
    const result = generateBranchName(issue);
    expect(result).toMatch(/^bugfix\/PROJ-123-fix-login-error$/);
  });

  it('handles long summaries by truncating', () => {
    const issue = makeIssue({
      summary: 'This is a very long summary that should be truncated because branch names have a maximum length limit',
    });
    const result = generateBranchName(issue, { maxLength: 50 });
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('generates without type prefix when disabled', () => {
    const issue = makeIssue({});
    const result = generateBranchName(issue, { includeTypePrefix: false });
    expect(result).toMatch(/^PROJ-123-add-user-authentication$/);
  });

  it('uses custom work type override', () => {
    const issue = makeIssue({ issueType: 'Story' });
    const result = generateBranchName(issue, { workTypeOverride: 'hotfix' });
    expect(result).toMatch(/^hotfix\//);
  });

  it('lowercases and sanitizes the summary', () => {
    const issue = makeIssue({ summary: 'Fix: API Error & Clean Up' });
    const result = generateBranchName(issue);
    // The issue key portion (PROJ-123) contains uppercase, which is expected
    // The summary portion after the key should be lowercase
    const afterKey = result.split('PROJ-123-')[1];
    expect(afterKey).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('generateReleaseBranchName', () => {
  it('generates release branch with v prefix', () => {
    expect(generateReleaseBranchName('1.2.0')).toBe('release/v1.2.0');
  });

  it('does not double-prefix v', () => {
    expect(generateReleaseBranchName('v1.2.0')).toBe('release/v1.2.0');
  });
});

describe('generateHotfixBranchName', () => {
  it('generates hotfix branch', () => {
    const issue = makeIssue({ summary: 'Critical auth bug' });
    const result = generateHotfixBranchName(issue);
    expect(result).toMatch(/^hotfix\/PROJ-123/);
  });
});

describe('extractIssueKeyFromBranch', () => {
  it('extracts key from standard branch', () => {
    expect(extractIssueKeyFromBranch('feature/PROJ-123-add-feature')).toBe('PROJ-123');
  });

  it('extracts key from branch without prefix', () => {
    expect(extractIssueKeyFromBranch('PROJ-456-bug-fix')).toBe('PROJ-456');
  });

  it('returns null when no key found', () => {
    expect(extractIssueKeyFromBranch('main')).toBeNull();
    expect(extractIssueKeyFromBranch('develop')).toBeNull();
  });
});

describe('extractAllIssueKeysFromBranch', () => {
  it('extracts multiple issue keys', () => {
    const keys = extractAllIssueKeysFromBranch('feature/PROJ-123-PROJ-124-combined-work');
    expect(keys).toEqual(['PROJ-123', 'PROJ-124']);
  });

  it('deduplicates keys', () => {
    const keys = extractAllIssueKeysFromBranch('PROJ-123-PROJ-123');
    expect(keys).toEqual(['PROJ-123']);
  });

  it('returns empty for no keys', () => {
    expect(extractAllIssueKeysFromBranch('main')).toEqual([]);
  });
});

describe('extractWorkTypeFromBranch', () => {
  it('extracts work type from prefixed branch', () => {
    expect(extractWorkTypeFromBranch('feature/PROJ-123-stuff')).toBe('feature');
    expect(extractWorkTypeFromBranch('bugfix/PROJ-456')).toBe('bugfix');
    expect(extractWorkTypeFromBranch('hotfix/PROJ-789')).toBe('hotfix');
    expect(extractWorkTypeFromBranch('release/v1.0.0')).toBe('release');
    expect(extractWorkTypeFromBranch('chore/PROJ-100')).toBe('chore');
    expect(extractWorkTypeFromBranch('docs/PROJ-200')).toBe('docs');
  });

  it('returns null for branches without prefix', () => {
    expect(extractWorkTypeFromBranch('PROJ-123-no-prefix')).toBeNull();
    expect(extractWorkTypeFromBranch('main')).toBeNull();
  });
});

describe('extractVersionFromReleaseBranch', () => {
  it('extracts version from release branch with v', () => {
    expect(extractVersionFromReleaseBranch('release/v1.2.0')).toBe('1.2.0');
  });

  it('extracts version without v prefix', () => {
    expect(extractVersionFromReleaseBranch('release/1.2.0')).toBe('1.2.0');
  });

  it('extracts pre-release version', () => {
    expect(extractVersionFromReleaseBranch('release/v1.2.0-beta.1')).toBe('1.2.0-beta.1');
  });

  it('returns null for non-release branches', () => {
    expect(extractVersionFromReleaseBranch('feature/PROJ-123')).toBeNull();
  });

  it('returns null for invalid version format', () => {
    expect(extractVersionFromReleaseBranch('release/not-a-version')).toBeNull();
  });
});

describe('validateBranchName', () => {
  it('validates correct standard branch names', () => {
    const result = validateBranchName('feature/PROJ-123-add-auth');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates release branch names', () => {
    const result = validateBranchName('release/v1.0.0');
    expect(result.valid).toBe(true);
  });

  it('returns error for empty branch name', () => {
    const result = validateBranchName('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Branch name cannot be empty');
  });

  it('returns error for consecutive slashes', () => {
    const result = validateBranchName('feature//something');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('consecutive slashes'))).toBe(true);
  });

  it('returns error for leading/trailing slashes', () => {
    expect(validateBranchName('/feature').errors.some(e => e.includes('start or end with a slash'))).toBe(true);
    expect(validateBranchName('feature/').errors.some(e => e.includes('start or end with a slash'))).toBe(true);
  });

  it('returns error for .lock suffix', () => {
    const result = validateBranchName('feature/test.lock');
    expect(result.errors.some(e => e.includes('.lock'))).toBe(true);
  });

  it('returns error when exceeding max length', () => {
    const longName = 'feature/' + 'a'.repeat(200);
    const result = validateBranchName(longName);
    expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
  });

  it('warns when missing issue key', () => {
    const result = validateBranchName('feature/no-issue-key');
    expect(result.warnings.some(w => w.includes('issue key'))).toBe(true);
  });

  it('warns when missing type prefix', () => {
    const result = validateBranchName('PROJ-123-some-work');
    expect(result.warnings.some(w => w.includes('type prefix'))).toBe(true);
  });

  it('provides normalized branch name when valid', () => {
    const result = validateBranchName('feature/PROJ-123-add-auth');
    expect(result.normalized).toBeDefined();
  });
});

describe('isValidBranchName', () => {
  it('returns true for valid names', () => {
    expect(isValidBranchName('feature/PROJ-123-test')).toBe(true);
  });

  it('returns false for invalid names', () => {
    expect(isValidBranchName('')).toBe(false);
  });
});

describe('parseBranchName', () => {
  it('parses a standard feature branch', () => {
    const parsed = parseBranchName('feature/PROJ-123-add-authentication');
    expect(parsed.workType).toBe('feature');
    expect(parsed.issueKey).toBe('PROJ-123');
    expect(parsed.description).toBe('add-authentication');
    expect(parsed.version).toBeNull();
    expect(parsed.isStandardFormat).toBe(true);
  });

  it('parses a release branch', () => {
    const parsed = parseBranchName('release/v1.2.0');
    expect(parsed.workType).toBe('release');
    expect(parsed.version).toBe('1.2.0');
    expect(parsed.isStandardFormat).toBe(true);
  });

  it('parses a branch without prefix', () => {
    const parsed = parseBranchName('PROJ-456-some-work');
    expect(parsed.workType).toBeNull();
    expect(parsed.issueKey).toBe('PROJ-456');
    expect(parsed.description).toBe('some-work');
    expect(parsed.isStandardFormat).toBe(false);
  });

  it('parses main/develop branches', () => {
    const parsed = parseBranchName('main');
    expect(parsed.workType).toBeNull();
    expect(parsed.issueKey).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.isStandardFormat).toBe(false);
  });
});

describe('getWorkTypeFromIssue', () => {
  it('maps Story to feature', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Story' }))).toBe('feature');
  });

  it('maps Bug to bugfix', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Bug' }))).toBe('bugfix');
  });

  it('maps Hotfix to hotfix', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Hotfix' }))).toBe('hotfix');
  });

  it('maps Documentation to docs', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Documentation' }))).toBe('docs');
  });

  it('maps Chore to chore', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Chore' }))).toBe('chore');
  });

  it('maps critical Bug to hotfix', () => {
    const issue = makeIssue({ issueType: 'Custom Bug Type', priority: 'Critical' });
    expect(getWorkTypeFromIssue(issue)).toBe('hotfix');
  });

  it('defaults to feature for unknown types', () => {
    expect(getWorkTypeFromIssue(makeIssue({ issueType: 'Unknown' }))).toBe('feature');
  });
});

describe('sanitizeBranchSegment', () => {
  it('lowercases text', () => {
    expect(sanitizeBranchSegment('Hello World')).toBe('hello-world');
  });

  it('replaces spaces and underscores', () => {
    expect(sanitizeBranchSegment('some_text here')).toBe('some-text-here');
  });

  it('removes special characters', () => {
    expect(sanitizeBranchSegment('fix: bug #123!')).toBe('fix-bug-123');
  });

  it('collapses multiple separators', () => {
    expect(sanitizeBranchSegment('too---many')).toBe('too-many');
  });

  it('strips leading/trailing separators', () => {
    expect(sanitizeBranchSegment('-hello-')).toBe('hello');
  });
});

describe('filterBranchesByProject', () => {
  const branches = [
    'feature/PROJ-1-stuff',
    'feature/OTHER-2-thing',
    'bugfix/PROJ-3-fix',
    'main',
  ];

  it('filters branches by project key', () => {
    expect(filterBranchesByProject(branches, 'PROJ')).toEqual([
      'feature/PROJ-1-stuff',
      'bugfix/PROJ-3-fix',
    ]);
  });

  it('returns empty when no match', () => {
    expect(filterBranchesByProject(branches, 'NONE')).toEqual([]);
  });
});

describe('groupBranchesByWorkType', () => {
  it('groups branches by their work type prefix', () => {
    const branches = [
      'feature/PROJ-1',
      'bugfix/PROJ-2',
      'hotfix/PROJ-3',
      'release/v1.0.0',
      'main',
    ];
    const grouped = groupBranchesByWorkType(branches);
    expect(grouped.feature).toEqual(['feature/PROJ-1']);
    expect(grouped.bugfix).toEqual(['bugfix/PROJ-2']);
    expect(grouped.hotfix).toEqual(['hotfix/PROJ-3']);
    expect(grouped.release).toEqual(['release/v1.0.0']);
    expect(grouped.unknown).toEqual(['main']);
  });
});

describe('findBranchesForIssue', () => {
  it('finds branches matching an issue key', () => {
    const branches = [
      'feature/PROJ-123-something',
      'bugfix/PROJ-456-other',
      'feature/PROJ-123-another',
    ];
    expect(findBranchesForIssue(branches, 'PROJ-123')).toEqual([
      'feature/PROJ-123-something',
      'feature/PROJ-123-another',
    ]);
  });

  it('is case insensitive for issue key', () => {
    const branches = ['feature/PROJ-123-stuff'];
    expect(findBranchesForIssue(branches, 'proj-123')).toEqual(['feature/PROJ-123-stuff']);
  });
});

describe('BRANCH_PREFIXES', () => {
  it('has all work types', () => {
    expect(BRANCH_PREFIXES.feature).toBe('feature');
    expect(BRANCH_PREFIXES.bugfix).toBe('bugfix');
    expect(BRANCH_PREFIXES.hotfix).toBe('hotfix');
    expect(BRANCH_PREFIXES.release).toBe('release');
    expect(BRANCH_PREFIXES.chore).toBe('chore');
    expect(BRANCH_PREFIXES.docs).toBe('docs');
  });
});
