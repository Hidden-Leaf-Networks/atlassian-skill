# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-03-16

First stable release. Open-core foundation for AI-native SDLC automation.

### Added

- **Confluence**: Client (API v2), page CRUD, space management, CQL search, and documentation sync module
- **Bitbucket**: Client with OAuth 2.0 and App Password auth, pull request lifecycle, repository and branch management, pipelines CI/CD integration, and deployment tracking
- **Orchestration**: Changelog generator from Jira issues, PR description generator with diff analysis, branch naming conventions tied to Jira issues, WorkflowManager with presets, BoardSync for label-driven status transitions, PlanExecutor, ProjectReset for project lifecycle management
- **Autonomous**: Intelligent issue triage with duplicate detection and assignee suggestions, predictive sprint planning with velocity analysis and risk assessment
- **Session**: Session capture system with full archival to Confluence pages and Jira issues via real API clients
- **Utilities**: Validation utilities with HLN label convention support

### Changed

- **Session**: `SessionArchiver` now uses real `ConfluenceClient` and `JiraClient` instead of placeholder stubs
- **Session**: `createArchiverFromEnv()` accepts optional client instances for Confluence/Jira archival

### Known Issues

- Jira Cloud workflow API has a tenant-wide 409 lock bug — `POST /workflows/update` may fail. Use `ProjectReset` as a workaround or configure board columns via Jira UI. (ATLSK-62)
- `POST /workflows/create` has an undocumented `links` format — workflow creation via API is not possible.

## [0.1.0] - 2026-03-05

### Added

- Initial project structure and build configuration
- **Core**: Base Atlassian API client with rate limiting (65k points/hour), retries, and structured error handling
- **Core**: OAuth 2.0 (3LO) authentication manager with token refresh and secure storage
- **Core**: API token authentication support
- **Core**: Points-based rate limiter for Atlassian API compliance
- **Core**: ADF (Atlassian Document Format) builder with fluent API and markdown conversion
- **Core**: Typed error hierarchy (AuthenticationError, AuthorizationError, NotFoundError, RateLimitError, ValidationError)
- **Jira**: Full Jira Cloud API client -- issues, projects, boards, sprints, transitions, comments, worklogs
- **Jira**: JQL query builder with fluent API, operator support, and pre-built templates
- **Session**: Session capture system for recording Claude Code session events
- **Utilities**: Structured logger with configurable levels and formats
