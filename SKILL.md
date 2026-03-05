# Atlassian Skill

A comprehensive Claude Code skill for integrating with Atlassian products: Jira, Confluence, and Bitbucket.

## Overview

This skill enables Claude Code to:
- **Read/Write Jira**: Search issues, create/update tickets, manage sprints, transition workflows
- **Manage Confluence**: Create/update pages, sync documentation, archive session transcripts
- **Integrate Bitbucket**: Create PRs, monitor pipelines, link commits to Jira issues
- **Orchestrate SDLC**: Automate branch naming, changelog generation, PR descriptions
- **Capture Sessions**: Archive Claude Code session transcripts to Confluence/Jira

## Setup

### Environment Variables

Create a `.env` file with your Atlassian credentials:

```bash
# Required: Atlassian Cloud Configuration
ATLASSIAN_CLOUD_ID=your-cloud-id
ATLASSIAN_SITE_URL=https://your-domain.atlassian.net

# Option 1: OAuth 2.0 (Recommended for production)
ATLASSIAN_CLIENT_ID=your-client-id
ATLASSIAN_CLIENT_SECRET=your-client-secret
ATLASSIAN_REDIRECT_URI=http://localhost:3000/callback
ATLASSIAN_ACCESS_TOKEN=your-access-token
ATLASSIAN_REFRESH_TOKEN=your-refresh-token

# Option 2: API Token (Simpler setup)
ATLASSIAN_USER_EMAIL=your-email@company.com
ATLASSIAN_API_TOKEN=your-api-token

# Optional: Session Capture
SESSION_CAPTURE_ENABLED=true
SESSION_CAPTURE_MODE=full
SESSION_AUTO_ARCHIVE=false
```

### Getting Your Cloud ID

1. Go to your Atlassian site (e.g., `https://your-domain.atlassian.net`)
2. Open browser developer tools (F12)
3. Run: `window._siteConfig?.cloudId` or check the URL in API requests

### Creating an API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name and copy the token

## Usage Examples

### Search Jira Issues

```typescript
import { JiraClient, jql, JqlFunctions } from '@hidden-leaf/atlassian-skill';

const client = new JiraClient({ /* config */ });

// Using JQL builder
const query = jql()
  .equals('project', 'HLN')
  .in('status', ['To Do', 'In Progress'])
  .equals('assignee', JqlFunctions.currentUser())
  .orderBy('priority', 'DESC')
  .build();

const results = await client.searchIssues({ jql: query });
```

### Create a Jira Issue

```typescript
import { JiraClient, AdfBuilder } from '@hidden-leaf/atlassian-skill';

const client = new JiraClient({ /* config */ });

const description = new AdfBuilder()
  .heading(2, 'Problem')
  .paragraph(p => p.text('Description of the issue...'))
  .heading(2, 'Steps to Reproduce')
  .orderedList([
    [{ text: 'Step 1' }],
    [{ text: 'Step 2' }],
  ])
  .build();

const issue = await client.createIssue({
  project: 'HLN',
  issuetype: 'Bug',
  summary: 'Fix login flow error',
  description,
  priority: 'High',
  labels: ['bug', 'auth'],
});
```

### Capture and Archive Session

```typescript
import { SessionCapture, SessionArchiver } from '@hidden-leaf/atlassian-skill';

const capture = new SessionCapture();
capture.startSession({ projectName: 'My Project' });

// ... during session ...
capture.captureUserMessage('Help me fix the auth bug');
capture.captureToolUse('Read', 'tool-123', { file_path: '/src/auth.ts' });
capture.captureFileOperation('edit', '/src/auth.ts', true, 15);

// End session
const transcript = capture.endSession('Fixed authentication flow');

// Archive to Confluence
const archiver = new SessionArchiver();
await archiver.archive(transcript, {
  destination: 'confluence',
  confluenceSpaceKey: 'ENG',
  format: 'full',
  includeFullTranscript: true,
});
```

## Available Commands

When this skill is active, you can ask Claude Code to:

### Jira Operations
- "Show me my open tickets in project HLN"
- "Create a bug ticket for the login error"
- "Move HLN-123 to In Progress"
- "Add a comment to HLN-456"
- "What's in the current sprint?"
- "Find all high priority bugs assigned to me"

### Confluence Operations
- "Create a design doc for the new feature"
- "Update the README sync in Confluence"
- "Archive this session to the Engineering space"

### Bitbucket Operations
- "Create a PR for this branch"
- "Link this PR to HLN-123"
- "Check the pipeline status"

### Orchestration
- "Generate a branch name for HLN-123"
- "Create a changelog from recent commits"
- "Generate a PR description"

## HLN Label Conventions

This skill enforces Hidden Leaf Network labeling standards:

| Category | Labels |
|----------|--------|
| Team | `frontend`, `backend`, `devops`, `qa`, `design` |
| Type | `feature`, `bug`, `tech-debt`, `spike`, `doc` |
| Status | `blocked`, `needs-review`, `in-progress`, `ready` |
| Priority | `p0-critical`, `p1-high`, `p2-medium`, `p3-low` |
| Component | `api`, `ui`, `db`, `auth`, `infra` |

## API Reference

### JiraClient

| Method | Description |
|--------|-------------|
| `getIssue(key)` | Get issue by key |
| `searchIssues(options)` | Search with JQL |
| `createIssue(input)` | Create new issue |
| `updateIssue(key, input)` | Update issue |
| `transitionIssue(key, input)` | Change issue status |
| `addComment(key, input)` | Add comment |
| `addLabels(key, labels)` | Add labels |
| `getSprint(id)` | Get sprint details |
| `getSprintIssues(id)` | Get issues in sprint |

### JQL Builder

```typescript
jql()
  .equals(field, value)      // field = value
  .notEquals(field, value)   // field != value
  .in(field, values)         // field IN (values)
  .contains(field, text)     // field ~ "text"
  .greaterThan(field, value) // field > value
  .is(field, 'EMPTY')        // field IS EMPTY
  .orderBy(field, 'DESC')    // ORDER BY field DESC
  .build()                   // Returns JQL string
```

### ADF Builder

```typescript
adf()
  .heading(level, text)      // Add heading
  .paragraph(builder)        // Add paragraph
  .bulletList(items)         // Add bullet list
  .orderedList(items)        // Add numbered list
  .codeBlock(code, lang)     // Add code block
  .table(rows)               // Add table
  .panel(type, builder)      // Add info/warning panel
  .build()                   // Returns ADF document
```

## Security

- Never commit `.env` files or credentials
- Use OAuth for production deployments
- API tokens are scoped to your user permissions
- Session transcripts may contain sensitive data - use redaction patterns

## Troubleshooting

### "Authentication failed"
- Check your API token or OAuth credentials
- Verify the Cloud ID matches your site
- Ensure your user has necessary permissions

### "Rate limit exceeded"
- The skill includes automatic rate limiting
- Reduce concurrent operations if hitting limits
- Consider caching frequently accessed data

### "Issue not found"
- Verify the issue key format (PROJECT-123)
- Check you have permission to view the issue
- Ensure the project exists

## Contributing

See the main repository for contribution guidelines.

## License

MIT - Hidden Leaf Network
