import {
  generateChangelog,
  generateReleaseNotes,
  generateCompactChangelog,
  categorizeIssue,
  groupIssuesByCategory,
  groupIssuesByComponent,
  CATEGORY_META,
  ISSUE_TYPE_TO_CATEGORY,
} from '../changelog-generator';
import { JiraIssue } from '../types';

function makeIssue(overrides: Partial<{
  key: string;
  summary: string;
  issueType: string;
  priority: string;
  labels: string[];
  components: Array<{ id: string; name: string }>;
  assignee: { accountId: string; displayName: string };
  description: string | null;
}> = {}): JiraIssue {
  return {
    key: overrides.key ?? 'PROJ-1',
    id: '10001',
    self: 'https://jira.example.com/rest/api/2/issue/10001',
    fields: {
      summary: overrides.summary ?? 'Test issue',
      description: overrides.description ?? null,
      issuetype: { name: overrides.issueType ?? 'Story', subtask: false },
      status: { name: 'Done', statusCategory: { key: 'done', name: 'Done' } },
      priority: overrides.priority ? { name: overrides.priority } : undefined,
      assignee: overrides.assignee,
      labels: overrides.labels ?? [],
      fixVersions: [],
      components: overrides.components ?? [],
      created: '2024-01-01T00:00:00.000Z',
      updated: '2024-01-15T00:00:00.000Z',
    },
  };
}

describe('categorizeIssue', () => {
  it('categorizes Story as features', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Story' }))).toBe('features');
  });

  it('categorizes Bug as bugfixes', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Bug' }))).toBe('bugfixes');
  });

  it('categorizes Hotfix as hotfixes', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Hotfix' }))).toBe('hotfixes');
  });

  it('categorizes Task as maintenance', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Task' }))).toBe('maintenance');
  });

  it('categorizes Improvement as enhancements', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Improvement' }))).toBe('enhancements');
  });

  it('categorizes Documentation as documentation', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Documentation' }))).toBe('documentation');
  });

  it('categorizes breaking change by label', () => {
    const issue = makeIssue({ issueType: 'Story', labels: ['breaking-change'] });
    expect(categorizeIssue(issue)).toBe('breaking');
  });

  it('categorizes critical Bug as hotfixes', () => {
    const issue = makeIssue({ issueType: 'Custom Bug Type', priority: 'Critical' });
    // issueType contains "bug" (case insensitive) + critical priority = hotfixes
    expect(categorizeIssue(issue)).toBe('hotfixes');
  });

  it('returns other for unknown types', () => {
    expect(categorizeIssue(makeIssue({ issueType: 'Unknown' }))).toBe('other');
  });
});

describe('groupIssuesByCategory', () => {
  it('groups issues into correct categories', () => {
    const issues = [
      makeIssue({ key: 'P-1', issueType: 'Story' }),
      makeIssue({ key: 'P-2', issueType: 'Bug' }),
      makeIssue({ key: 'P-3', issueType: 'Story' }),
      makeIssue({ key: 'P-4', issueType: 'Task' }),
    ];
    const grouped = groupIssuesByCategory(issues);
    expect(grouped.get('features')!.length).toBe(2);
    expect(grouped.get('bugfixes')!.length).toBe(1);
    expect(grouped.get('maintenance')!.length).toBe(1);
  });
});

describe('groupIssuesByComponent', () => {
  it('groups issues by component name', () => {
    const issues = [
      makeIssue({ key: 'P-1', components: [{ id: '1', name: 'Auth' }] }),
      makeIssue({ key: 'P-2', components: [{ id: '2', name: 'API' }] }),
      makeIssue({ key: 'P-3', components: [{ id: '1', name: 'Auth' }] }),
    ];
    const grouped = groupIssuesByComponent(issues);
    expect(grouped.get('Auth')!.length).toBe(2);
    expect(grouped.get('API')!.length).toBe(1);
  });

  it('puts issues without components in General', () => {
    const issues = [makeIssue({ components: [] })];
    const grouped = groupIssuesByComponent(issues);
    expect(grouped.get('General')!.length).toBe(1);
  });

  it('adds issue to multiple groups if multiple components', () => {
    const issues = [
      makeIssue({ components: [{ id: '1', name: 'Auth' }, { id: '2', name: 'API' }] }),
    ];
    const grouped = groupIssuesByComponent(issues);
    expect(grouped.get('Auth')!.length).toBe(1);
    expect(grouped.get('API')!.length).toBe(1);
  });
});

describe('generateChangelog', () => {
  const issues = [
    makeIssue({ key: 'P-1', issueType: 'Story', summary: 'New dashboard' }),
    makeIssue({ key: 'P-2', issueType: 'Bug', summary: 'Fix crash on login' }),
    makeIssue({ key: 'P-3', issueType: 'Improvement', summary: 'Better search' }),
  ];

  it('generates markdown changelog by default', () => {
    const result = generateChangelog(issues);
    expect(result).toContain('### New Features');
    expect(result).toContain('### Bug Fixes');
    expect(result).toContain('### Enhancements');
    expect(result).toContain('P-1');
    expect(result).toContain('New dashboard');
  });

  it('returns empty message for no issues', () => {
    const result = generateChangelog([]);
    expect(result).toBe('No changes in this release.');
  });

  it('returns HTML empty message when format is html', () => {
    const result = generateChangelog([], { format: 'html' });
    expect(result).toBe('<p>No changes in this release.</p>');
  });

  it('generates plain text changelog', () => {
    const result = generateChangelog(issues, { format: 'plain' });
    expect(result).toContain('NEW FEATURES');
    expect(result).toContain('[P-1]');
  });

  it('generates HTML changelog', () => {
    const result = generateChangelog(issues, { format: 'html' });
    expect(result).toContain('<section');
    expect(result).toContain('<h3>');
    expect(result).toContain('</ul>');
  });

  it('generates Confluence changelog', () => {
    const result = generateChangelog(issues, { format: 'confluence' });
    expect(result).toContain('<h3>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  it('includes links when jiraBaseUrl provided', () => {
    const result = generateChangelog(issues, {
      includeLinks: true,
      jiraBaseUrl: 'https://jira.example.com',
    });
    expect(result).toContain('https://jira.example.com/browse/P-1');
  });

  it('includes components when enabled', () => {
    const issuesWithComponents = [
      makeIssue({
        key: 'P-1',
        issueType: 'Story',
        summary: 'Feature',
        components: [{ id: '1', name: 'Auth' }],
      }),
    ];
    const result = generateChangelog(issuesWithComponents, { includeComponents: true });
    expect(result).toContain('Auth');
  });

  it('includes assignees when enabled', () => {
    const issuesWithAssignees = [
      makeIssue({
        key: 'P-1',
        issueType: 'Story',
        summary: 'Feature',
        assignee: { accountId: 'user1', displayName: 'Alice' },
      }),
    ];
    const result = generateChangelog(issuesWithAssignees, { includeAssignees: true });
    expect(result).toContain('Alice');
  });

  it('supports groupByComponent', () => {
    const issuesWithComponents = [
      makeIssue({ key: 'P-1', components: [{ id: '1', name: 'Auth' }], summary: 'Auth feature' }),
      makeIssue({ key: 'P-2', components: [{ id: '2', name: 'API' }], summary: 'API fix' }),
    ];
    const result = generateChangelog(issuesWithComponents, { groupByComponent: true });
    expect(result).toContain('Auth');
    expect(result).toContain('API');
  });
});

describe('generateReleaseNotes', () => {
  const issues = [
    makeIssue({ key: 'P-1', issueType: 'Story', summary: 'New feature' }),
    makeIssue({ key: 'P-2', issueType: 'Bug', summary: 'Bug fix' }),
  ];

  it('generates release notes with version header', () => {
    const result = generateReleaseNotes('1.0.0', issues);
    expect(result).toContain('Release 1.0.0');
    expect(result).toContain('Issues Resolved');
  });

  it('includes summary statistics', () => {
    const result = generateReleaseNotes('1.0.0', issues);
    expect(result).toContain('1 new features');
    expect(result).toContain('1 bug fixes');
  });

  it('accepts JiraVersion object', () => {
    const version = {
      id: '1',
      name: 'v2.0.0',
      projectId: 1,
      released: true,
      archived: false,
      releaseDate: '2024-06-01',
    };
    const result = generateReleaseNotes(version, issues);
    expect(result).toContain('Release v2.0.0');
  });

  it('includes contributor list', () => {
    const issuesWithAssignees = [
      makeIssue({
        key: 'P-1',
        issueType: 'Story',
        summary: 'Feature',
        assignee: { accountId: 'user1', displayName: 'Alice' },
      }),
    ];
    const result = generateReleaseNotes('1.0.0', issuesWithAssignees);
    expect(result).toContain('Contributors');
    expect(result).toContain('Alice');
  });
});

describe('generateCompactChangelog', () => {
  it('generates changelog without descriptions, assignees, or components', () => {
    const issues = [
      makeIssue({
        key: 'P-1',
        issueType: 'Story',
        summary: 'Feature',
        components: [{ id: '1', name: 'Auth' }],
        assignee: { accountId: 'u1', displayName: 'Alice' },
        description: 'Long description text',
      }),
    ];
    const result = generateCompactChangelog(issues);
    expect(result).toContain('P-1');
    expect(result).toContain('Feature');
    // Should not include extra details
    expect(result).not.toContain('Alice');
  });
});

describe('CATEGORY_META', () => {
  it('has metadata for all categories', () => {
    const categories = ['features', 'enhancements', 'bugfixes', 'hotfixes', 'documentation', 'maintenance', 'breaking', 'other'];
    for (const cat of categories) {
      expect(CATEGORY_META[cat as keyof typeof CATEGORY_META]).toBeDefined();
      expect(CATEGORY_META[cat as keyof typeof CATEGORY_META].title).toBeTruthy();
    }
  });

  it('has priorities in correct order (breaking first)', () => {
    expect(CATEGORY_META.breaking.priority).toBeLessThan(CATEGORY_META.features.priority);
    expect(CATEGORY_META.features.priority).toBeLessThan(CATEGORY_META.bugfixes.priority);
  });
});

describe('ISSUE_TYPE_TO_CATEGORY', () => {
  it('maps standard Jira issue types', () => {
    expect(ISSUE_TYPE_TO_CATEGORY['Story']).toBe('features');
    expect(ISSUE_TYPE_TO_CATEGORY['Bug']).toBe('bugfixes');
    expect(ISSUE_TYPE_TO_CATEGORY['Task']).toBe('maintenance');
    expect(ISSUE_TYPE_TO_CATEGORY['Improvement']).toBe('enhancements');
  });
});
