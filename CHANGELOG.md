# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Confluence**: Client, page operations, space management, and documentation sync module
- **Bitbucket**: Client with OAuth 2.0 and App Password auth, pull request operations, repository and branch management, pipelines CI/CD integration, and deployment tracking
- **Orchestration**: Changelog generator from Jira issues, PR description generator with diff analysis, branch naming conventions tied to Jira issues
- **Autonomous**: Intelligent issue triage with duplicate detection and assignee suggestions, predictive sprint planning with velocity analysis and risk assessment
- **Session**: Session archiver for persisting transcripts to Confluence and Jira
- **Utilities**: Validation utilities with HLN label convention support

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
