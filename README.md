# @hidden-leaf/atlassian-skill

**Open infrastructure for AI-native software teams.**

[![Build](https://img.shields.io/github/actions/workflow/status/hidden-leaf-networks/atlassian-skill/ci.yml?branch=main)](https://github.com/hidden-leaf-networks/atlassian-skill/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@hidden-leaf/atlassian-skill)](https://www.npmjs.com/package/@hidden-leaf/atlassian-skill)

---

## What It Does

A unified Atlassian integration layer for AI-driven software development lifecycle automation.

- **Programmatic Atlassian access** -- typed clients for Jira, Confluence, and Bitbucket Cloud APIs with built-in auth, retry, and rate limiting.
- **SDLC orchestration primitives** -- branch naming, changelog generation, PR descriptions, and workflow transitions derived from Jira context.
- **Session capture and archival** -- record development sessions and persist transcripts to Confluence pages or Jira comments.
- **Autonomous planning and triage** -- sprint planning utilities and issue triage with categorization, duplicate detection, and assignee suggestions.

---

## Key Features

### Jira

Full Jira Cloud REST API v3 and Agile API coverage:

- Issue CRUD (`getIssue`, `createIssue`, `updateIssue`, `deleteIssue`)
- JQL query builder with composable, type-safe API
- Sprint and board management (`getSprint`, `getSprintIssues`, `moveIssuesToSprint`)
- Workflow transitions (`getTransitions`, `transitionIssue`)
- Comments, labels, assignees, projects, users

### Confluence

Confluence Cloud API v2 client:

- Page lifecycle (`createPage`, `getPage`, `updatePage`, `deletePage`)
- Space operations (`listSpaces`, `getSpace`, `getSpaceByKey`)
- CQL search (`searchByCQL`)
- Documentation sync -- push local Markdown files to Confluence as ADF
- ADF document builder for structured content creation

### Bitbucket

Bitbucket Cloud REST API v2 client with pull request operations:

- PR lifecycle (`createPullRequest`, `mergePullRequest`, `approvePullRequest`, `declinePullRequest`)
- Code review workflow (`requestChanges`, `addReviewers`, `addPRComment`)
- Diff and diffstat retrieval (`getPRDiff`, `getPRDiffStat`)
- Pagination helpers (`getAllPages`, `getPage`)

### Orchestration

Convention-driven SDLC automation:

- Branch naming from Jira issues (`generateBranchName`, `generateReleaseBranchName`)
- Changelog generation from issue lists (`generateChangelog`, `generateReleaseNotes`)
- PR description generation with diff analysis (`generatePRDescription`, `generatePRTitle`, `analyzeDiff`)
- Branch validation and parsing (`validateBranchName`, `parseBranchName`, `extractIssueKeyFromBranch`)

### Session Capture

Development session recording and archival:

- Event capture (`startSession`, `captureUserMessage`, `captureToolUse`, `captureFileOperation`)
- Transcript archival to Confluence or Jira (`SessionArchiver.archive`)
- Configurable redaction patterns for sensitive data

### Autonomous

Sprint planning and issue triage:

- `SprintPlanner` -- velocity analysis, scope suggestions, risk assessment, sprint health reports
- `IssueTriage` -- duplicate detection, priority recommendations, assignee suggestions

---

## Quick Start

### Install

```bash
npm install @hidden-leaf/atlassian-skill
```

### Configure

Set your Atlassian credentials as environment variables:

```bash
export ATLASSIAN_CLOUD_ID=your-cloud-id
export ATLASSIAN_SITE_URL=https://your-domain.atlassian.net
export ATLASSIAN_USER_EMAIL=your-email@company.com
export ATLASSIAN_API_TOKEN=your-api-token
```

### Use

```typescript
import { createJiraClientFromEnv, jql, JqlFunctions } from '@hidden-leaf/atlassian-skill';

const client = createJiraClientFromEnv();

// Build a JQL query
const query = jql()
  .equals('project', 'ENG')
  .in('status', ['To Do', 'In Progress'])
  .equals('assignee', JqlFunctions.currentUser())
  .orderBy('priority', 'DESC')
  .build();

const results = await client.searchIssues({ jql: query });

// Create an issue
const issue = await client.createIssue({
  project: 'ENG',
  issuetype: 'Bug',
  summary: 'Fix login flow error',
  priority: 'High',
  labels: ['bug', 'auth'],
});
```

---

## Usage Examples

### Search and transition a Jira issue

```typescript
import { createJiraClientFromEnv } from '@hidden-leaf/atlassian-skill';

const jira = createJiraClientFromEnv();

const issue = await jira.getIssue('ENG-452');
const transitions = await jira.getTransitions('ENG-452');

const inProgress = transitions.find(t => t.name === 'In Progress');
if (inProgress) {
  await jira.transitionIssue('ENG-452', {
    transitionId: inProgress.id,
    comment: { body: 'Starting work on this.' },
  });
}
```

### Create a pull request with a generated description

```typescript
import {
  BitbucketClient,
  PullRequestOperations,
  generatePRDescription,
  generateBranchName,
} from '@hidden-leaf/atlassian-skill';

const bb = new BitbucketClient({
  auth: { accessToken: process.env.BITBUCKET_ACCESS_TOKEN! },
});
const prs = new PullRequestOperations(bb);

const description = generatePRDescription(issue, {
  template: 'standard',
  includeJiraContext: true,
  includeChecklist: true,
  jiraBaseUrl: 'https://your-domain.atlassian.net',
});

await prs.createPullRequest('acme', 'my-repo', {
  title: `ENG-452: ${issue.fields.summary}`,
  source: { branch: { name: 'feature/ENG-452-fix-login' } },
  destination: { branch: { name: 'main' } },
  description: description.body,
  close_source_branch: true,
});
```

### Sync documentation to Confluence

```typescript
import { ConfluenceClient, DocumentationSyncService } from '@hidden-leaf/atlassian-skill';

const confluence = new ConfluenceClient({
  cloudId: process.env.ATLASSIAN_CLOUD_ID!,
  accessToken: process.env.ATLASSIAN_ACCESS_TOKEN!,
});

const sync = new DocumentationSyncService(confluence);
const result = await sync.syncReadmeToConfluence('/path/to/repo', 'space-id', 'parent-page-id');

if (result.success) {
  console.log(`Synced: ${result.updated.length} updated, ${result.created.length} created`);
}
```

### Capture and archive a session

```typescript
import { SessionCapture, SessionArchiver } from '@hidden-leaf/atlassian-skill';

const capture = new SessionCapture();
capture.startSession({ projectName: 'My Project' });

capture.captureUserMessage('Fix the auth bug in login flow');
capture.captureToolUse('Read', 'tool-1', { file_path: '/src/auth.ts' });
capture.captureFileOperation('edit', '/src/auth.ts', true, 15);

const transcript = capture.endSession('Fixed authentication flow');

const archiver = new SessionArchiver();
await archiver.archive(transcript, {
  destination: 'confluence',
  confluenceSpaceKey: 'ENG',
  format: 'full',
  includeFullTranscript: true,
});
```

---

## API Reference

### Clients

| Class | Description |
|-------|-------------|
| `JiraClient` | Jira Cloud REST API v3 + Agile API |
| `ConfluenceClient` | Confluence Cloud API v2 |
| `BitbucketClient` | Bitbucket Cloud REST API v2 |
| `PullRequestOperations` | PR lifecycle operations (wraps `BitbucketClient`) |

### Builders

| Class / Function | Description |
|------------------|-------------|
| `JqlBuilder` / `jql()` | Composable JQL query builder |
| `AdfBuilder` / `adf()` | Atlassian Document Format builder |
| `TextBuilder` / `text()` | Inline text builder with marks |
| `JqlFunctions` | JQL function helpers (`currentUser()`, etc.) |
| `JqlTemplates` | Pre-built JQL query templates |

### Orchestration

| Function | Description |
|----------|-------------|
| `generateBranchName(issue, options?)` | Branch name from Jira issue |
| `generateChangelog(issues, options?)` | Changelog from issue list |
| `generateReleaseNotes(issues, version, options?)` | Release notes |
| `generatePRDescription(issue, options?)` | PR description with context |
| `generatePRTitle(issue)` | PR title from issue |
| `analyzeDiff(diff)` | Diff analysis summary |
| `extractIssueKeyFromBranch(branchName)` | Extract Jira key from branch |
| `validateBranchName(branchName)` | Validate branch conventions |
| `parseBranchName(branchName)` | Parse branch into components |

### Autonomous

| Class | Description |
|-------|-------------|
| `SprintPlanner` | Velocity analysis, scope suggestions, risk assessment, health reports |
| `IssueTriage` | Duplicate detection, priority/assignee recommendations |

### Session

| Class | Description |
|-------|-------------|
| `SessionCapture` | Event recording for development sessions |
| `SessionArchiver` | Persist transcripts to Confluence/Jira |

### Auth and Utilities

| Export | Description |
|--------|-------------|
| `createJiraClientFromEnv()` | Factory: Jira client from env vars |
| `createClientFromEnv()` | Factory: base Atlassian client from env vars |
| `createAuthFromEnv()` | Factory: auth config from env vars |
| `RateLimiter` | Configurable rate limiter |
| `Logger` / `createLogger()` | Structured logger |
| `markdownToAdf(md)` | Convert Markdown to ADF |
| `adfToText(doc)` | Convert ADF to plain text |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ATLASSIAN_CLOUD_ID` | Yes | Your Atlassian Cloud ID |
| `ATLASSIAN_SITE_URL` | Yes | Site URL (e.g., `https://acme.atlassian.net`) |
| `ATLASSIAN_USER_EMAIL` | For API token auth | Account email |
| `ATLASSIAN_API_TOKEN` | For API token auth | API token |
| `ATLASSIAN_CLIENT_ID` | For OAuth | OAuth client ID |
| `ATLASSIAN_CLIENT_SECRET` | For OAuth | OAuth client secret |
| `ATLASSIAN_ACCESS_TOKEN` | For OAuth | OAuth access token |
| `ATLASSIAN_REFRESH_TOKEN` | For OAuth | OAuth refresh token |
| `ATLASSIAN_REDIRECT_URI` | For OAuth | OAuth redirect URI |
| `SESSION_CAPTURE_ENABLED` | No | Enable session capture (`true`/`false`) |
| `SESSION_CAPTURE_MODE` | No | Capture mode (`full`/`summary`) |
| `SESSION_AUTO_ARCHIVE` | No | Auto-archive on session end |

### Getting Your Cloud ID

1. Navigate to your Atlassian site (e.g., `https://your-domain.atlassian.net`).
2. Open browser developer tools and run `window._siteConfig?.cloudId`.

### Creating an API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens.
2. Create a token and store it securely.

---

## Enterprise

For enterprise features including multi-model orchestration, analytics dashboards, team memory, and workflow governance, contact **Hidden Leaf Networks**.

[Contact us](https://hiddenleafnetworks.com/contact)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on setting up a development environment, running tests, and submitting pull requests.

---

## License

MIT -- Built by [Hidden Leaf Networks](https://hiddenleafnetworks.com).

---

Part of HLN's AI infrastructure ecosystem.
