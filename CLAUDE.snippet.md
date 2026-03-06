# Atlassian Integration

This project uses `@hidden-leaf/atlassian-skill` for Jira, Confluence, and Bitbucket operations.

## Setup
- Credentials are in `.env` (see `node_modules/@hidden-leaf/atlassian-skill/.env.example`)
- Required: `ATLASSIAN_CLOUD_ID`, `ATLASSIAN_SITE_URL`, `ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN`

## Usage
When the user asks about Jira tickets, Confluence pages, Bitbucket PRs, sprint planning, or any Atlassian operation — use this skill. Full API reference:

See node_modules/@hidden-leaf/atlassian-skill/SKILL.md

## Quick Patterns
```typescript
import { createJiraClientFromEnv, jql, adf, text } from '@hidden-leaf/atlassian-skill';

const jira = createJiraClientFromEnv();

// Search issues
const results = await jira.searchIssues({ jql: jql().equals('project', 'PROJ').build() });

// Create issue
await jira.createIssue({ project: 'PROJ', issuetype: 'Task', summary: 'Do the thing' });

// Transition issue
const transitions = await jira.getTransitions('PROJ-123');
await jira.transitionIssue('PROJ-123', { transitionId: transitions[0].id });

// Add comment with rich formatting
await jira.addComment('PROJ-123', {
  body: adf().heading(3, 'Update').paragraph(text().text('Done: ').bold('shipped')).build()
});
```
