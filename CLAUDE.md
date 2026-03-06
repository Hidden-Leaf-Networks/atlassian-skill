# @hidden-leaf/atlassian-skill

## Project Overview
Unified Atlassian integration skill for Claude Code. Provides typed clients for Jira, Confluence, and Bitbucket with SDLC orchestration, session capture, and autonomous planning.

## Architecture
- `src/core/` — HTTP client, OAuth/API token auth, rate limiter, ADF document builder
- `src/jira/` — Jira client, JQL builder, types
- `src/confluence/` — Confluence client, pages, spaces, sync
- `src/bitbucket/` — Bitbucket client, PRs, pipelines, deployments
- `src/orchestration/` — Branch naming, changelog, PR descriptions, PlanExecutor, BoardSync, WorkflowManager, ProjectReset
- `src/autonomous/` — Sprint planning, triage
- `src/session/` — Session capture + archiving
- `src/utils/` — Logger, validators

## Development
- **Build:** `npm run build`
- **Test:** `npm test` (jest + ts-jest, 267 tests)
- **Lint:** `npm run lint`
- **Run scripts:** `npx tsx <script>.ts`
- **Publish:** `npm publish --access public` (requires npm login as hln-dev)

## Conventions
- TypeScript strict mode, ES2022 target, NodeNext modules
- All API clients use factory pattern: `create*FromEnv()` reads from env vars
- ADF documents built with `adf()` and `text()` fluent builders
- Errors: `AtlassianApiError`, `AuthenticationError`, `NotFoundError`, `RateLimitError`, `ValidationError`, `WorkflowLockError`
- `shouldRetry()` skips `AtlassianApiError` to avoid retrying 4xx
- Search uses `POST /rest/api/3/search/jql` (not deprecated `/search`)
- API token auth routes to site URL directly; OAuth routes through `api.atlassian.com`

## Known Issues
- Jira workflow API has a tenant-wide 409 lock bug (ATLSK-62). Use `ProjectReset` as workaround or configure board columns via Jira UI.
- `POST /workflows/create` has an undocumented `links` format — workflow creation via API is impossible.

## Skill Reference
See [SKILL.md](./SKILL.md) for the full API reference that Claude Code uses when this package is installed in other projects.
