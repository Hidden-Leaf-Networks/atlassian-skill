import {
  generatePRTitle,
  analyzeDiff,
  suggestLabels,
  generateQuickPRDescription,
  generatePRDescription,
} from '../pr-description-generator';
import { JiraIssue } from '../types';

function makeIssue(overrides: Partial<{
  key: string;
  summary: string;
  description: string | null;
  issueType: string;
  priority: string;
  labels: string[];
  components: Array<{ id: string; name: string }>;
  assignee: { accountId: string; displayName: string };
  parent: { key: string; fields: { summary: string } };
  subtasks: Array<{ key: string; fields: { summary: string; status: { name: string } } }>;
}> = {}): JiraIssue {
  return {
    key: overrides.key ?? 'PROJ-123',
    id: '10001',
    self: 'https://jira.example.com/rest/api/2/issue/10001',
    fields: {
      summary: overrides.summary ?? 'Implement user authentication',
      description: overrides.description ?? 'Add OAuth2 login flow',
      issuetype: { name: overrides.issueType ?? 'Story', subtask: false },
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
      priority: overrides.priority ? { name: overrides.priority } : undefined,
      assignee: overrides.assignee,
      labels: overrides.labels ?? [],
      fixVersions: [],
      components: overrides.components ?? [],
      created: '2024-01-01T00:00:00.000Z',
      updated: '2024-01-15T00:00:00.000Z',
      parent: overrides.parent,
      subtasks: overrides.subtasks,
    },
  };
}

describe('generatePRTitle', () => {
  it('formats title as [KEY] Summary', () => {
    const issue = makeIssue({ key: 'PROJ-42', summary: 'Add login page' });
    expect(generatePRTitle(issue)).toBe('[PROJ-42] Add login page');
  });

  it('truncates long summaries to fit 72 char limit', () => {
    const longSummary = 'A'.repeat(100);
    const issue = makeIssue({ key: 'PROJ-1', summary: longSummary });
    const title = generatePRTitle(issue);
    expect(title.length).toBeLessThanOrEqual(72);
    expect(title).toMatch(/\.\.\.$/);
  });

  it('does not truncate short summaries', () => {
    const issue = makeIssue({ summary: 'Short' });
    const title = generatePRTitle(issue);
    expect(title).not.toContain('...');
  });
});

describe('analyzeDiff', () => {
  const sampleDiff = `diff --git a/src/auth/login.ts b/src/auth/login.ts
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -1,5 +1,10 @@
+import { OAuth } from './oauth';
+
 export function login() {
-  return false;
+  const client = new OAuth();
+  return client.authenticate();
+}
+
+export function logout() {
+  return true;
 }
diff --git a/src/auth/__tests__/login.test.ts b/src/auth/__tests__/login.test.ts
--- /dev/null
+++ b/src/auth/__tests__/login.test.ts
@@ -0,0 +1,5 @@
+import { login } from '../login';
+
+test('login works', () => {
+  expect(login()).toBeTruthy();
+});
diff --git a/docs/auth.md b/docs/auth.md
--- /dev/null
+++ b/docs/auth.md
@@ -0,0 +1,3 @@
+# Auth
+
+Documentation for auth module.`;

  it('counts files changed', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.filesChanged).toBe(3);
  });

  it('counts lines added and removed', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.linesAdded).toBeGreaterThan(0);
    expect(analysis.linesRemoved).toBeGreaterThan(0);
  });

  it('detects test files', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.hasTests).toBe(true);
  });

  it('detects doc changes', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.hasDocChanges).toBe(true);
  });

  it('tracks file types by extension', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.filesByType['ts']).toBeGreaterThan(0);
    expect(analysis.filesByType['md']).toBeGreaterThan(0);
  });

  it('identifies impacted areas', () => {
    const analysis = analyzeDiff(sampleDiff);
    expect(analysis.impactedAreas).toContain('src');
    expect(analysis.impactedAreas).toContain('auth');
    expect(analysis.impactedAreas).toContain('docs');
  });

  it('detects config changes', () => {
    const configDiff = `diff --git a/config/app.json b/config/app.json
--- a/config/app.json
+++ b/config/app.json
@@ -1 +1 @@
-{"key": "old"}
+{"key": "new"}`;
    const analysis = analyzeDiff(configDiff);
    expect(analysis.hasConfigChanges).toBe(true);
  });

  it('detects migration files', () => {
    const migrationDiff = `diff --git a/db/migration/001.sql b/db/migration/001.sql
--- /dev/null
+++ b/db/migration/001.sql
@@ -0,0 +1 @@
+CREATE TABLE users;`;
    const analysis = analyzeDiff(migrationDiff);
    expect(analysis.hasMigrations).toBe(true);
  });

  it('handles empty diff', () => {
    const analysis = analyzeDiff('');
    expect(analysis.filesChanged).toBe(0);
    expect(analysis.linesAdded).toBe(0);
    expect(analysis.linesRemoved).toBe(0);
  });
});

describe('suggestLabels', () => {
  it('suggests feature label for Story type', () => {
    const issue = makeIssue({ issueType: 'Story' });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('feature');
  });

  it('suggests bug label for Bug type', () => {
    const issue = makeIssue({ issueType: 'Bug' });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('bug');
  });

  it('suggests hotfix and urgent for Hotfix type', () => {
    const issue = makeIssue({ issueType: 'Hotfix' });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('hotfix');
    expect(labels).toContain('urgent');
  });

  it('suggests priority:critical for critical issues', () => {
    const issue = makeIssue({ priority: 'Critical' });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('priority:critical');
  });

  it('suggests priority:high for high priority', () => {
    const issue = makeIssue({ priority: 'High' });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('priority:high');
  });

  it('suggests has-tests when diff includes test files', () => {
    const issue = makeIssue({});
    const diffAnalysis = {
      filesChanged: 5,
      linesAdded: 100,
      linesRemoved: 20,
      filesByType: { ts: 5 },
      hasTests: true,
      hasDocChanges: false,
      hasConfigChanges: false,
      hasMigrations: false,
      impactedAreas: ['src'],
    };
    const labels = suggestLabels(issue, diffAnalysis);
    expect(labels).toContain('has-tests');
  });

  it('suggests size labels based on diff size', () => {
    const issue = makeIssue({});
    const small = {
      filesChanged: 1, linesAdded: 10, linesRemoved: 5,
      filesByType: {}, hasTests: false, hasDocChanges: false,
      hasConfigChanges: false, hasMigrations: false, impactedAreas: [],
    };
    expect(suggestLabels(issue, small)).toContain('size:small');

    const medium = { ...small, linesAdded: 100, linesRemoved: 50 };
    expect(suggestLabels(issue, medium)).toContain('size:medium');

    const large = { ...small, linesAdded: 500, linesRemoved: 200 };
    expect(suggestLabels(issue, large)).toContain('size:large');
  });

  it('adds component labels', () => {
    const issue = makeIssue({
      components: [{ id: '1', name: 'Auth Service' }],
    });
    const labels = suggestLabels(issue, null);
    expect(labels).toContain('component:auth-service');
  });

  it('deduplicates labels', () => {
    const issue = makeIssue({ issueType: 'Documentation' });
    const diffAnalysis = {
      filesChanged: 1, linesAdded: 10, linesRemoved: 0,
      filesByType: { md: 1 }, hasTests: false, hasDocChanges: true,
      hasConfigChanges: false, hasMigrations: false, impactedAreas: [],
    };
    const labels = suggestLabels(issue, diffAnalysis);
    const docCount = labels.filter(l => l === 'documentation').length;
    expect(docCount).toBe(1);
  });
});

describe('generateQuickPRDescription', () => {
  it('generates a quick description without Jira URL', () => {
    const result = generateQuickPRDescription('PROJ-123', 'Add feature', 'Changed file X');
    expect(result).toContain('Resolves PROJ-123');
    expect(result).toContain('## Summary');
    expect(result).toContain('Add feature');
    expect(result).toContain('## Changes');
    expect(result).toContain('Changed file X');
  });

  it('generates a quick description with Jira URL', () => {
    const result = generateQuickPRDescription(
      'PROJ-123',
      'Add feature',
      'Changed file X',
      'https://jira.example.com'
    );
    expect(result).toContain('[PROJ-123](https://jira.example.com/browse/PROJ-123)');
  });
});

describe('generatePRDescription', () => {
  it('generates complete PR description with title and body', () => {
    const issue = makeIssue({});
    const result = generatePRDescription(issue, 'Did some work', null, {
      template: 'standard',
    });
    expect(result.title).toContain('[PROJ-123]');
    expect(result.body).toContain('## Summary');
    expect(result.labels).toBeInstanceOf(Array);
  });

  it('includes session summary when provided', () => {
    const issue = makeIssue({});
    const result = generatePRDescription(issue, 'Implemented OAuth2 flow', null, {
      includeSessionSummary: true,
    });
    expect(result.body).toContain('Implemented OAuth2 flow');
  });

  it('generates minimal template', () => {
    const issue = makeIssue({});
    const result = generatePRDescription(issue, null, null, {
      template: 'minimal',
    });
    expect(result.body).toContain('## Summary');
    expect(result.body).not.toContain('## Checklist');
  });

  it('includes diff analysis when diff provided', () => {
    const issue = makeIssue({});
    const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1 +1,2 @@
 line1
+line2`;
    const result = generatePRDescription(issue, null, diff, {
      includeDiffAnalysis: true,
    });
    expect(result.body).toContain('Changes');
  });

  it('includes related issues when parent exists', () => {
    const issue = makeIssue({
      parent: { key: 'PROJ-100', fields: { summary: 'Parent epic' } },
    });
    const result = generatePRDescription(issue, null, null, {
      includeRelatedIssues: true,
    });
    expect(result.body).toContain('PROJ-100');
  });

  it('generates labels from issue context', () => {
    const issue = makeIssue({ issueType: 'Bug', priority: 'High' });
    const result = generatePRDescription(issue, null, null);
    expect(result.labels).toContain('bug');
    expect(result.labels).toContain('priority:high');
  });
});
