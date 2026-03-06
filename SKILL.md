# Atlassian Skill

## When to use this skill

Activate this skill when the user:
- Mentions Jira, Confluence, Bitbucket, or Atlassian
- Asks to create, update, search, or transition tickets/issues
- Asks to create a PR, link work to a ticket, or generate branch names
- Wants to plan work, create epics, organize tasks, or manage sprints
- Asks to archive or document a coding session
- Mentions sprint planning, backlog grooming, velocity, or triage
- Wants to generate changelogs or PR descriptions from Jira data
- Asks to sync the board, update issue statuses, or review project status
- Asks to create or update Confluence pages

## Setup

The skill reads configuration from environment variables. See `.env.example` for the full list. At minimum, you need:
- `ATLASSIAN_CLOUD_ID` and `ATLASSIAN_SITE_URL`
- Either `ATLASSIAN_USER_EMAIL` + `ATLASSIAN_API_TOKEN` (dev) or OAuth tokens (prod)

## Capabilities

### Jira Operations

Use `JiraClient` (or `createJiraClientFromEnv()` factory) for all Jira API calls.

**Issue CRUD:**
- `getIssue(key)` -- fetch a single issue by key (e.g., "PROJ-123")
- `createIssue(input)` -- create an issue; accepts `project` (key string), `issuetype` (name string), `summary`, `description` (ADF document), `priority`, `labels`, `components`, `parent`, `duedate`, `customFields`
- `updateIssue(key, input)` -- update fields, add/remove labels
- `deleteIssue(key)` -- delete an issue
- `assignIssue(key, accountId)` -- assign to a user (pass `null` to unassign)

**Search with JQL:**
- `searchIssues({ jql, fields, maxResults })` -- search using JQL
- Build JQL with the fluent `JqlBuilder` via `jql()`:
  ```ts
  import { jql, JqlFunctions } from '@hidden-leaf/atlassian-skill';
  const query = jql()
    .equals('project', 'PROJ')
    .in('status', ['To Do', 'In Progress'])
    .equals('assignee', JqlFunctions.currentUser())
    .orderBy('priority', 'DESC')
    .build();
  ```
- Use `JqlTemplates` for common queries: `myOpenIssues(project?)`, `recentlyUpdated(days?, project?)`, `openBugs(project, priorities?)`, `currentSprint(project?)`, `unassigned(project)`, `dueSoon(days?, project?)`, `overdue(project?)`, `createdToday(project?)`, `blocked(project?)`

**Transitions and Comments:**
- `getTransitions(key)` -- list available transitions for an issue
- `transitionIssue(key, { transitionId, comment?, fields? })` -- move issue to new status
- `addComment(key, input)` -- add a comment (body in ADF format)
- `getComments(key)` -- list comments

**Labels:**
- `addLabels(key, labels)` -- append labels
- `removeLabels(key, labels)` -- remove specific labels
- `setLabels(key, labels)` -- replace all labels

**Sprints and Boards (Agile):**
- `listBoards({ projectKeyOrId?, type? })` -- list boards
- `getBoard(boardId)` -- get board details
- `listSprints(boardId, { state? })` -- list sprints (state: 'future' | 'active' | 'closed')
- `getSprint(sprintId)` -- get sprint details
- `getSprintIssues(sprintId)` -- get issues in a sprint
- `moveIssuesToSprint(sprintId, issueKeys)` -- move issues into a sprint

**Users:**
- `getCurrentUser()` -- get the authenticated user
- `searchUsers(query)` -- search users
- `getAssignableUsers(projectKey)` -- get users assignable in a project

### ADF Document Builder

Use `AdfBuilder` (or `adf()` shorthand) to construct Atlassian Document Format for issue descriptions, comments, and Confluence pages:

```ts
import { AdfBuilder, TextBuilder } from '@hidden-leaf/atlassian-skill';
const doc = new AdfBuilder()
  .heading(2, 'Problem')
  .paragraph(p => p.text('Description here...'))
  .codeBlock('const x = 1;', 'typescript')
  .bulletList(['Item 1', 'Item 2'])
  .table(['Header A', 'Header B'], [['cell1', 'cell2']])
  .panel('info', 'Note: important context')
  .build();
```

Utility functions: `textToAdf(string)`, `markdownToAdf(string)`, `adfToText(adfDoc)`.

### Confluence Operations

Use `ConfluenceClient` (or `createConfluenceClientFromEnv()` factory). This client uses the Confluence Cloud API v2.

**Spaces:**
- `listSpaces(options?)` -- list accessible spaces
- `getSpace(spaceId)` -- get space by ID
- `getSpaceByKey(spaceKey)` -- get space by key (e.g., "ENG")

**Pages:**
- `createPage({ spaceId, title, body, parentId?, representation? })` -- create a page; body can be ADF document or storage-format HTML string
- `getPage(pageId, { bodyFormat? })` -- get a page
- `updatePage({ id, title?, body?, version, versionMessage? })` -- update; must pass current version number (the client increments it)
- `deletePage(pageId)` -- delete a page
- `getPageChildren(pageId)` -- get child pages
- `getSpacePages(spaceId, { depth? })` -- list pages in a space

**Search:**
- `searchByCQL(cql, { limit? })` -- search using Confluence Query Language

**Connection:**
- `testConnection()` -- verify credentials work

### Bitbucket Operations

Use `BitbucketClient` (or `createBitbucketClient(config)` factory). Supports OAuth access token or username/app-password auth.

**HTTP Methods:**
- `get<T>(path, params?)`, `post<T>(path, body?)`, `put<T>(path, body?)`, `delete<T>(path)`, `patch<T>(path, body?)`
- `getDiff(path)` -- get raw diff text
- `getAllPages<T>(path, options?)` -- auto-paginate through all results

**Common Bitbucket API paths:**
- Repositories: `/repositories/{workspace}/{repo_slug}`
- Pull Requests: `/repositories/{workspace}/{repo_slug}/pullrequests`
- Branches: `/repositories/{workspace}/{repo_slug}/refs/branches`
- Pipelines: `/repositories/{workspace}/{repo_slug}/pipelines`
- Deployments: `/repositories/{workspace}/{repo_slug}/deployments`

**Token management:**
- `setAccessToken(token)` -- update the access token
- `refreshAccessToken()` -- refresh OAuth token (requires clientId/clientSecret in auth config)

### Branch Naming

Generate and parse branch names following HLN conventions:

- `generateBranchName(issue, options?)` -- generates `{type}/{ISSUE-KEY}-{short-summary}` (e.g., `feature/PROJ-123-add-user-auth`)
- `generateReleaseBranchName(version)` -- generates `release/v{version}`
- `generateHotfixBranchName(issue)` -- generates `hotfix/{ISSUE-KEY}-{desc}`
- `extractIssueKeyFromBranch(branchName)` -- extracts `PROJ-123` from a branch name
- `parseBranchName(branchName)` -- returns `{ workType, issueKey, description, version, isStandardFormat }`
- `validateBranchName(branchName)` -- returns `{ valid, errors, warnings }`

### Changelog and PR Description Generation

- `generatePRDescription(options)` -- generate a full PR description from Jira context, session data, and diff analysis
- `generatePRTitle(issue, template?)` -- generate a PR title
- `generateQuickPRDescription(issue)` -- minimal PR description
- `generatePRDescriptionFromSession(session, issue?)` -- build description from captured session
- `analyzeDiff(diff)` -- analyze a diff for summary stats
- `suggestPRLabels(diff, issue?)` -- suggest labels based on changes

Changelog:
- `generateChangelog(issues, options?)` -- generate changelog from Jira issues; formats: `'markdown' | 'confluence' | 'plain' | 'html'`

### Workflow Management

Use `WorkflowManager` (or `createWorkflowManager(jiraClient)`) to configure board statuses and workflows:

**Read operations:**
- `getProjectWorkflow(projectKey)` -- get current workflow statuses and transitions
- `listStatuses()` -- list all statuses in the Jira instance
- `getProjectStatuses(projectKey)` -- get statuses available per issue type
- `getBoardColumns(boardId)` -- get board column configuration
- `isWorkflowLocked(projectKey)` -- check if the workflow is locked (409 from Jira)

**Write operations:**
- `ensureStatuses(statuses)` -- create statuses that don't exist yet; returns created + existing
- `updateWorkflow(projectKey, statuses)` -- update the project's workflow with new statuses and global transitions; throws `WorkflowLockError` if locked
- `applyPreset(projectKey, presetName)` -- apply a workflow preset (creates statuses + updates workflow)
- `applyWorkflowPreset(projectKey, preset)` -- apply a custom WorkflowPreset

**Presets:**
- `listPresets()` -- list available workflow presets
- `getPresetLabelMapping(presetName)` -- get label-to-status mapping for BoardSync integration

**Lock detection:** `applyPreset` returns `workflowLocked: true` if Jira's workflow API is locked (known platform bug). When locked, statuses are still created — users just need to configure board columns manually via Jira UI.

Available presets:
- `hln-sdlc` -- Full SDLC: Todo -> In Planning -> In Development -> Development Complete -> Ready for QA -> In QA -> Verified in QA -> Done
- `simple-kanban` -- Default Kanban: Backlog -> Selected for Development -> In Progress -> Done
- `dev-review` -- Dev + Review: Todo -> In Progress -> In Review -> Done

### Sprint Planning (Autonomous)

Use `SprintPlanner` (via `createSprintPlanner(jiraClient, aiPlanner, logger)`) for AI-assisted planning:

- `analyzeVelocity(boardId, sprintCount?)` -- analyze velocity trends over recent sprints; returns average, median, trend, predicted next velocity
- `suggestSprintScope(boardId, capacity)` -- recommend which backlog issues to pull into a sprint given team capacity
- `identifyRisks(sprintId)` -- identify risks in a sprint (blocked issues, missing estimates, unassigned work, dependency risks)
- `estimateIssue(issueKey)` -- suggest story points based on similar completed issues
- `generateSprintGoal(issues)` -- generate a sprint goal from planned issues

### Issue Triage (Autonomous)

Use `IssueTriage` (via `createIssueTriage(jiraClient, aiAnalyzer, logger)`) for intelligent issue routing:

- `triageIssue(issueKey)` -- full triage: classify, find similar issues, detect duplicates, suggest assignee, generate recommendations
- `findSimilarIssues(issueKey)` -- find similar issues by content analysis
- `suggestAssignee(issueKey)` -- suggest best assignee based on expertise and workload
- `detectDuplicates(issueKey)` -- detect potential duplicate issues

Triage can operate in `SUGGEST` mode (adds a comment with recommendations) or `AUTO` mode (applies changes above confidence threshold).

### Session Capture and Archiving

**Capture** session events with `SessionCapture` (or `createSessionCaptureFromEnv()`):

```ts
const capture = new SessionCapture();
capture.startSession({ projectName: 'My Project' });
capture.captureUserMessage('Fix the auth bug');
capture.captureToolUse('Read', 'tool-id', { file_path: '/src/auth.ts' });
capture.captureFileOperation('edit', '/src/auth.ts', true, 15);
capture.captureCommand('npm test', 0, 'All tests pass');
const transcript = capture.endSession('Fixed auth flow');
```

**Archive** transcripts with `SessionArchiver` (or `createArchiverFromEnv()`):

```ts
const archiver = new SessionArchiver({ confluenceClient, jiraClient });
const result = await archiver.archive(transcript, {
  destination: 'confluence',  // or 'jira' or 'both'
  confluenceSpaceKey: 'ENG',
  format: 'full',
  includeFullTranscript: true,
});
```

## Usage Patterns

### "Create a ticket for this"
1. Extract context from the conversation (summary, description, type, priority).
2. Build an ADF description using `AdfBuilder`.
3. Call `jiraClient.createIssue({ project: 'PROJ', issuetype: 'Task', summary, description })`.
4. Return the issue key and URL to the user.

### "Plan this as an epic with subtasks"
1. Parse the user's plan into an epic summary and child task summaries.
2. Create the epic: `jiraClient.createIssue({ project, issuetype: 'Epic', summary })`.
3. Create each child task with `parent` set to the epic key.
4. Return all created issue keys.

### "Move PROJ-123 to In Progress"
1. Call `jiraClient.getTransitions('PROJ-123')` to find the transition ID for "In Progress".
2. Call `jiraClient.transitionIssue('PROJ-123', { transitionId })`.
3. Confirm the transition to the user.

### "What's in the current sprint?"
1. Find the board: `jiraClient.listBoards({ projectKeyOrId: 'PROJ' })`.
2. Get active sprints: `jiraClient.listSprints(boardId, { state: 'active' })`.
3. Get sprint issues: `jiraClient.getSprintIssues(sprintId)`.
4. Format and present the results (key, summary, status, assignee, story points).

### "Search for bugs assigned to me"
1. Build JQL: `jql().equals('project', 'PROJ').equals('issuetype', 'Bug').equals('assignee', JqlFunctions.currentUser()).orderBy('priority', 'DESC').build()`.
2. Execute: `jiraClient.searchIssues({ jql: query })`.
3. Present results.

### "Create a PR for this branch"
1. Get the current branch name and extract the issue key with `extractIssueKeyFromBranch()`.
2. Fetch the Jira issue for context: `jiraClient.getIssue(issueKey)`.
3. Generate PR title: `generatePRTitle(issue)`.
4. Generate PR description: `generatePRDescription({ issue, template: 'standard' })`.
5. Use `BitbucketClient` to create the PR, or output the title/description for the user to use with `gh pr create`.

### "Generate a branch name for PROJ-123"
1. Fetch the issue: `jiraClient.getIssue('PROJ-123')`.
2. Generate: `generateBranchName(issue)`.
3. Return the branch name (e.g., `feature/PROJ-123-add-user-authentication`).

### "Create a Confluence page documenting this"
1. Get the space: `confluenceClient.getSpaceByKey('ENG')`.
2. Build content with `AdfBuilder` or pass HTML in storage format.
3. Create the page: `confluenceClient.createPage({ spaceId: space.id, title, body })`.
4. Return the page URL.

### "Archive this session"
1. End the session capture: `const transcript = capture.endSession('Summary of work')`.
2. Archive: `archiver.archive(transcript, { destination: 'confluence', confluenceSpaceKey: 'ENG', format: 'full' })`.
3. Return the Confluence page URL or Jira issue key.

### "Analyze sprint risks"
1. Find the active sprint via `listSprints(boardId, { state: 'active' })`.
2. Run `sprintPlanner.identifyRisks(sprintId)`.
3. Present risk factors, affected issues, and recommendations.

### "Triage this new issue"
1. Run `issueTriage.triageIssue('PROJ-456')`.
2. Present recommendations (priority, type, labels, assignee, potential duplicates).
3. If in auto mode, confirm what was applied.

### "Sync the board" / "Update issue statuses"
1. Use `createBoardSync(jiraClient, 'PROJ')` — auto-detects board transitions.
2. Call `boardSync.sync()` — transitions issues based on labels:
   - `done` label -> Done column
   - `next` label -> Selected for Development
   - `in-progress` label -> In Progress
   - `future` label -> stays in Backlog
3. Returns summary with counts of transitioned/skipped/errored issues.
4. Custom label-to-status mappings can be passed via config.

### "Set up a workflow for this project" / "Apply the SDLC workflow"
1. Create the workflow manager: `const wfm = createWorkflowManager(jiraClient)`.
2. List presets: `wfm.listPresets()` — show user available options.
3. Apply chosen preset: `const result = await wfm.applyPreset('PROJ', 'hln-sdlc')`.
4. Present the result summary (created statuses, workflow status, board columns).
5. For BoardSync integration, get the label mapping: `wfm.getPresetLabelMapping('hln-sdlc')`.

### "Review code and update the board"
1. Analyze the codebase to determine what's implemented vs planned.
2. Use `PlanExecutor` to create new issues for discovered work.
3. Use `BoardSync` to transition existing issues to correct statuses.
4. Report what was updated.

## Error Handling

- **AuthenticationError** (401): Check API token or OAuth credentials. Verify `ATLASSIAN_CLOUD_ID` matches the site.
- **AuthorizationError** (403): The user lacks permission for the operation. Check Jira/Confluence project permissions.
- **NotFoundError** (404): Verify the issue key, page ID, or project key exists and is accessible.
- **RateLimitError** (429): The client handles rate limiting automatically with exponential backoff. If persistent, reduce concurrent operations.
- **ValidationError** (400): Check field values -- common causes are invalid issue type names, missing required fields, or malformed ADF.

All error classes are exported from the package: `AtlassianApiError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `RateLimitError`, `ValidationError`.

## HLN Label Conventions

| Category  | Labels                                                   |
|-----------|----------------------------------------------------------|
| Team      | `frontend`, `backend`, `devops`, `qa`, `design`         |
| Type      | `feature`, `bug`, `tech-debt`, `spike`, `doc`            |
| Status    | `blocked`, `needs-review`, `in-progress`, `ready`        |
| Priority  | `p0-critical`, `p1-high`, `p2-medium`, `p3-low`         |
| Component | `api`, `ui`, `db`, `auth`, `infra`                       |
