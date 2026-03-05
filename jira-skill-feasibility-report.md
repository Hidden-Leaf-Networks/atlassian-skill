# JIRA CLAUDE CODE SKILL: Technical Feasibility Report & Implementation Blueprint

**Version:** 1.0
**Date:** 2026-03-05
**Author:** HLN Engineering Systems
**Classification:** Internal Technical Document

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current State Research](#2-current-state-research)
3. [System Design Proposal](#3-system-design-proposal)
4. [Technical Implementation Plan](#4-technical-implementation-plan)
5. [Prototype Implementation](#5-prototype-implementation)
6. [Security & Enterprise Readiness](#6-security--enterprise-readiness)
7. [Roadmap](#7-roadmap)
8. [Risks & Unknowns](#8-risks--unknowns)

---

## 1. EXECUTIVE SUMMARY

### 1.1 What the Jira Claude Code Skill Is

The Jira Claude Code Skill is a reusable, production-grade Claude Code skill that provides deep bidirectional integration between Claude Code's agentic runtime and Atlassian Jira Cloud. It enables AI-driven engineering workflows where Claude can:

- **Read** Jira projects, boards, sprints, issues, comments, and metadata
- **Write** issues, comments, labels, and field updates using HLN conventions
- **Generate** Jira-ready technical content derived from code context
- **Automate** engineering lifecycle workflows (planning → execution → QA → release)
- **Operate** within enterprise permission boundaries with full audit trails

### 1.2 Why It Matters for Modern AI-Driven Engineering Workflows

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE: FRAGMENTED WORKFLOW                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Developer ──► IDE ──► Git ──► PR ──► Manual Jira Update ──► Slack     │
│                         ▲                     │                         │
│                         │                     ▼                         │
│                    Context Lost          Manual Sync                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    TARGET STATE: UNIFIED AI WORKFLOW                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Developer ◄──► Claude Code ◄──► Jira Skill ◄──► Jira Cloud            │
│       ▲              │                │              │                  │
│       │              ▼                ▼              ▼                  │
│       └──── Contextual Awareness ────┴── Automated Sync ───────────────│
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Value Propositions:**

| Benefit | Impact |
|---------|--------|
| Context Preservation | Code changes automatically generate accurate Jira updates |
| Workflow Automation | Sprint planning, standups, and retrospectives synthesized by AI |
| Cognitive Offload | Engineers focus on code; AI handles project management overhead |
| Consistency | HLN conventions (labels, descriptions, branch linkage) enforced automatically |
| Auditability | Full trace from code change → Jira ticket → deployment |

### 1.3 Where It Fits Into Agent Ecosystems (Aria/Axis)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HLN AGENT ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │     ARIA     │    │     AXIS     │    │   CLAUDE     │              │
│  │  (Planning)  │◄──►│ (Execution)  │◄──►│    CODE      │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    JIRA CLAUDE CODE SKILL                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │   │
│  │  │  Reader  │ │  Writer  │ │ Planner  │ │ Workflow Engine  │    │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘    │   │
│  └───────┼────────────┼────────────┼────────────────┼──────────────┘   │
│          │            │            │                │                   │
│          ▼            ▼            ▼                ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      JIRA CLOUD API                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

The Jira Skill acts as a **shared capability layer** that:
- **Aria** uses for sprint planning, backlog grooming, and roadmap generation
- **Axis** uses for execution tracking, status updates, and release coordination
- **Claude Code** uses directly for developer-initiated Jira operations

---

## 2. CURRENT STATE RESEARCH

### 2.1 Atlassian Platform Analysis

#### 2.1.1 Jira Cloud vs Data Center Differences

| Aspect | Jira Cloud | Jira Data Center |
|--------|------------|------------------|
| **Deployment** | SaaS, Atlassian-hosted | Self-hosted, on-premise/private cloud |
| **API Endpoint** | `api.atlassian.com/ex/jira/<cloudId>` | `<your-domain>/rest/api/2` |
| **Authentication** | OAuth 2.0 (3LO), API tokens, Connect JWT | Basic auth, OAuth 1.0a, PAT |
| **Rate Limits** | Points-based (65k/hr pool), per-second limits | Configurable, typically more permissive |
| **User Limit** | 50,000 (Software), 20,000 (JSM) | Unlimited |
| **AI Features** | Atlassian Intelligence, Rovo | Limited/None |
| **Forge Support** | Full | N/A |
| **Update Cycle** | Continuous delivery | Quarterly releases |

**Recommendation:** Target Jira Cloud as primary platform. Data Center support can be added as a separate adapter.

#### 2.1.2 REST API vs GraphQL vs Forge

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **REST API v3** | Mature, well-documented, broad coverage | Verbose, multiple calls for related data | Direct integrations, scripts |
| **GraphQL** | Efficient data fetching, single request | Limited coverage, still evolving | Read-heavy operations |
| **Forge** | Native platform, managed auth, storage | Atlassian-hosted only, less flexible | Marketplace apps, UI extensions |

**Analysis:**

```
REST API v3 Coverage:
├── Issues ████████████████████ 100%
├── Projects ██████████████████ 95%
├── Boards ████████████████████ 100%
├── Sprints ███████████████████ 98%
├── Comments ██████████████████ 95%
├── Labels ████████████████████ 100%
├── Webhooks ██████████████████ 90%
└── Search (JQL) ██████████████ 95%

GraphQL Coverage:
├── Issues ████████████░░░░░░░░ 60%
├── Projects ██████████░░░░░░░░ 55%
└── Limited expansion ongoing...
```

**Recommendation:** Use REST API v3 as primary integration method. GraphQL optional for optimized read patterns.

#### 2.1.3 OAuth Scopes & Auth Flows

**OAuth 2.0 (3LO) Flow:**

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  User    │────►│ Claude Code  │────►│ Atlassian Auth  │
│          │     │  Skill       │     │ Server          │
└──────────┘     └──────────────┘     └─────────────────┘
     │                  │                     │
     │  1. Initiate     │                     │
     │─────────────────►│                     │
     │                  │  2. Redirect        │
     │                  │────────────────────►│
     │                  │                     │
     │  3. User Consent │◄────────────────────│
     │◄─────────────────│                     │
     │                  │                     │
     │  4. Auth Code    │                     │
     │─────────────────►│  5. Exchange Code   │
     │                  │────────────────────►│
     │                  │  6. Access Token    │
     │                  │◄────────────────────│
     │                  │                     │
     │  7. API Access   │  8. API Requests    │
     │◄─────────────────│────────────────────►│
```

**Required OAuth Scopes for HLN Workflow:**

```yaml
# Minimum Required Scopes
read:jira-work          # Read issues, projects, boards
write:jira-work         # Create/update issues
read:jira-user          # Read user info for assignment
manage:jira-project     # Project-level operations

# Extended Scopes (Optional)
read:sprint:jira-software     # Sprint read access
write:sprint:jira-software    # Sprint modifications
read:board:jira-software      # Board configurations
read:issue-details:jira       # Granular issue data
write:issue:jira              # Granular issue writes

# Recommended Classic Scopes (< 50 total)
classic:read:jira-work
classic:write:jira-work
```

**API Token Fallback:**
- Simpler setup, user-bound
- Less secure (long-lived tokens)
- Suitable for dev/testing environments
- Subject to rate limits as of Nov 2025

#### 2.1.4 Rate Limits and Constraints

**New Points-Based System (Enforcement: March 2, 2026):**

```
┌─────────────────────────────────────────────────────────────────┐
│                    RATE LIMITING ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tier 1: Global Pool                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  65,000 points/hour shared across ALL apps on site      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tier 2: Per-App Limits                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Individual app quotas (varies by app type/tier)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tier 3: Per-Second Burst                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Endpoint-specific requests/second limits               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tier 4: Per-Issue Write Limits                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Restricts modification frequency per individual issue  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Point Costs:**

| Operation | Base Points | Per-Object | Example |
|-----------|-------------|------------|---------|
| GET single issue | 1 | +1 | 2 points |
| GET with expand | 1 | +1 per expand | 3-5 points |
| JQL search (50 results) | 1 | +1 per result | 51 points |
| JQL search (100 results) | 1 | +1 per result | 101 points |
| POST/PUT/DELETE | 1 | 0 | 1 point |
| Bulk operations | Variable | Variable | Check docs |

**Mitigation Strategies:**

1. **Request only needed fields:** Use `fields` parameter
2. **Cache stable responses:** ETags, conditional headers
3. **Use webhooks:** Event-driven vs polling
4. **Batch strategically:** Balance point cost vs HTTP overhead
5. **Implement backoff:** Exponential retry on 429

#### 2.1.5 Webhooks and Event Architecture

**Event Categories:**

```yaml
Issue Events:
  - jira:issue_created
  - jira:issue_updated
  - jira:issue_deleted

Comment Events:
  - comment_created
  - comment_updated
  - comment_deleted

Sprint Events:
  - sprint_created
  - sprint_started
  - sprint_closed
  - sprint_deleted

Board Events:
  - board_created
  - board_updated
  - board_deleted

Project Events:
  - project_created
  - project_updated
  - project_deleted
```

**Webhook Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                       JIRA CLOUD                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Event Bus                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │   │
│  │  │ Issue   │  │ Sprint  │  │ Comment │  │ Project │      │   │
│  │  │ Events  │  │ Events  │  │ Events  │  │ Events  │      │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘      │   │
│  └───────┼────────────┼────────────┼────────────┼───────────┘   │
│          │            │            │            │                │
│          ▼            ▼            ▼            ▼                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Webhook Dispatcher                           │   │
│  │  • JQL Filtering                                          │   │
│  │  • Concurrency Limiter (20 primary / 10 secondary)        │   │
│  │  • Best-effort delivery                                   │   │
│  └────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼ HTTPS POST (JSON payload)
┌───────────────────────────────────────────────────────────────────┐
│                    HLN WEBHOOK RECEIVER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │
│  │ Verify Sig  │─►│ Parse Event │─►│ Route to Skill Handler  │    │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

**Constraints:**
- Delivery is best-effort (not guaranteed)
- 30-second response SLA
- JQL filtering only for issue/comment events
- No filtering for sprint/version events

---

### 2.2 Claude Code Skill Architecture

#### 2.2.1 How Skills Work Internally

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE RUNTIME                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Agentic Loop                          │    │
│  │                                                          │    │
│  │  User Input ──► Context Assembly ──► Model Inference     │    │
│  │       │                 │                    │           │    │
│  │       │                 ▼                    ▼           │    │
│  │       │         Skill Loading          Tool Selection    │    │
│  │       │                 │                    │           │    │
│  │       │                 ▼                    ▼           │    │
│  │       │         ┌─────────────────────────────────┐      │    │
│  │       │         │      Tool Execution Layer       │      │    │
│  │       │         │  ┌──────┐ ┌──────┐ ┌──────────┐ │      │    │
│  │       │         │  │ Bash │ │ Read │ │ Skill    │ │      │    │
│  │       │         │  └──────┘ └──────┘ │ (Custom) │ │      │    │
│  │       │         │                    └──────────┘ │      │    │
│  │       │         └─────────────────────────────────┘      │    │
│  │       │                        │                         │    │
│  │       │                        ▼                         │    │
│  │       └────────────────► Output to User                  │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 Skill File Structure

```
jira-skill/
├── SKILL.md                    # Main skill definition (required)
├── reference/
│   ├── api-reference.md        # Jira API documentation
│   ├── hln-conventions.md      # HLN-specific patterns
│   └── workflow-templates.md   # Workflow definitions
├── scripts/
│   ├── jira-auth.sh           # OAuth helper script
│   ├── jira-api.ts            # API wrapper
│   └── validators.ts          # Input validation
└── examples/
    ├── create-issue.md
    ├── sprint-planning.md
    └── release-workflow.md
```

#### 2.2.3 Skill Definition Schema

```yaml
---
# SKILL.md Frontmatter
name: jira                          # Invoked as /jira
description: |
  Jira integration for HLN engineering workflows.
  Use for: issue management, sprint planning,
  release coordination, workflow automation.
argument-hint: [command] [args...]
disable-model-invocation: false     # Claude can invoke automatically
user-invocable: true                # Users can invoke via /jira
allowed-tools:
  - Read
  - Grep
  - Bash(curl *)
  - Bash(jq *)
model: claude-opus-4-5              # Use Opus for complex reasoning
context: fork                       # Isolated subagent context
agent: general-purpose              # Full tool access
hooks:
  PostToolUse:
    - matcher: Bash
      script: ${CLAUDE_SKILL_DIR}/scripts/audit-log.sh
---

# Skill Content Below...
```

#### 2.2.4 Context Management & Memory Constraints

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT BUDGET ALLOCATION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total Context Window: ~200K tokens                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Skill Descriptions Pool: 2% (~4K tokens)                 │    │
│  │ • All skill descriptions loaded at session start         │    │
│  │ • Fallback: 16,000 characters if percentage calc fails   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Active Skill Content: Variable                           │    │
│  │ • Loaded when skill is invoked                           │    │
│  │ • Recommendation: Keep SKILL.md < 500 lines              │    │
│  │ • Supporting files loaded on-demand                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Tool Results: Dynamic                                    │    │
│  │ • API responses, file contents, etc.                     │    │
│  │ • Subject to context compaction                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Memory Strategies:**

1. **Stateless Design:** Each skill invocation is self-contained
2. **Persistent Storage:** Use `CLAUDE.md` or `.claude/memory.md` for learnings
3. **Session Context:** Skills can inject context via `SessionStart` hooks
4. **Compact Handlers:** Re-inject critical context after compaction

---

### 2.3 Existing Tools Comparison

#### 2.3.1 Competitive Landscape

| Feature | Atlassian Intelligence | GitHub Copilot for Jira | Linear AI | **Jira Claude Code Skill** |
|---------|----------------------|------------------------|-----------|---------------------------|
| **Platform** | Jira Cloud only | Jira Cloud | Linear only | Jira Cloud (primary) |
| **AI Model** | OpenAI + Proprietary | GitHub Copilot | Proprietary | Claude (Opus/Sonnet) |
| **Code Context** | None | Git commits/PRs | Git integration | **Full codebase access** |
| **Natural Language** | JQL conversion | Limited | Search | **Full reasoning** |
| **Automation** | Rule-based | PR→Issue | Event-driven | **Agentic workflows** |
| **Customization** | Limited | Limited | Limited | **Fully customizable** |
| **Enterprise** | Premium/Enterprise | Enterprise | Business+ | **Configurable** |

#### 2.3.2 Atlassian Intelligence Analysis

**Capabilities:**
- Natural language to JQL conversion
- AI work breakdown (epic → stories → tasks)
- Comment summarization
- Automation rule generation from natural language
- Rovo integration for cross-tool search

**Gaps:**
- No direct code context integration
- Cannot generate technical content from code
- Limited to Atlassian ecosystem
- No agentic workflow capabilities
- Closed system, not extensible

#### 2.3.3 Linear AI Analysis

**Capabilities:**
- Triage Intelligence (auto-assignment, labeling)
- Semantic search across issues
- AI-generated daily/weekly summaries
- Duplicate detection
- MCP server with initiative/milestone support

**Gaps:**
- Linear-only (no Jira support)
- Limited to Linear's feature set
- No deep code integration
- Read-heavy, limited write automation

#### 2.3.4 Opportunity Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARKET OPPORTUNITY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Gap 1: Code-Aware Jira Operations                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Current tools cannot:                                    │    │
│  │ • Generate issue descriptions from code changes          │    │
│  │ • Auto-link PRs to issues with context                   │    │
│  │ • Create technical tickets from code patterns            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Gap 2: Agentic Workflow Automation                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Current tools cannot:                                    │    │
│  │ • Execute multi-step workflows autonomously              │    │
│  │ • Reason about project state + take action               │    │
│  │ • Coordinate across planning/execution/release           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Gap 3: Enterprise Customization                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Current tools cannot:                                    │    │
│  │ • Enforce org-specific conventions (HLN labels)          │    │
│  │ • Integrate with custom CI/CD workflows                  │    │
│  │ • Provide full audit trails for compliance               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. SYSTEM DESIGN PROPOSAL

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         JIRA CLAUDE CODE SKILL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        SKILL LAYER                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │   SKILL.md   │  │  Reference   │  │   Hook Handlers      │   │    │
│  │  │  (Entry)     │  │  Documents   │  │   (Audit, Validate)  │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        TOOL LAYER                                │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │    │
│  │  │jira_reader  │ │jira_writer  │ │sprint_planner│ │issue_gen │  │    │
│  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘  │    │
│  │         │               │               │              │         │    │
│  │  ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────────────┴─────┐  │    │
│  │  │release_coord│ │workflow_eng │ │      hln_conventions      │  │    │
│  │  └──────┬──────┘ └──────┬──────┘ └──────────────┬────────────┘  │    │
│  └─────────┼───────────────┼───────────────────────┼───────────────┘    │
│            │               │                       │                     │
│            ▼               ▼                       ▼                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      API LAYER                                   │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │                  JiraApiClient                            │   │    │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐    │   │    │
│  │  │  │ Auth Mgr   │ │ Rate Limit │ │ Request Builder    │    │   │    │
│  │  │  │ (OAuth/PAT)│ │ Handler    │ │ (REST v3)          │    │   │    │
│  │  │  └────────────┘ └────────────┘ └────────────────────┘    │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EXTERNAL SERVICES                             │    │
│  │  ┌─────────────────┐          ┌─────────────────────────────┐   │    │
│  │  │ Jira Cloud API  │          │ Webhook Receiver (Optional) │   │    │
│  │  │ api.atlassian.  │          │ (For real-time events)      │   │    │
│  │  │ com/ex/jira/... │          │                             │   │    │
│  │  └─────────────────┘          └─────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Core Modules

#### 3.2.1 Module Specifications

| Module | Purpose | Primary Operations |
|--------|---------|-------------------|
| `jira_reader` | Read-only Jira data access | Projects, issues, sprints, comments |
| `jira_writer` | Create/update Jira entities | Issues, comments, labels, fields |
| `sprint_planner` | Sprint lifecycle management | Planning, capacity, retrospectives |
| `issue_generator` | AI-powered issue creation | From code, PRs, templates |
| `release_coordinator` | Release management | Versions, changelogs, deployment |
| `workflow_automation_engine` | Complex workflow orchestration | Multi-step automations |
| `hln_conventions` | HLN-specific standards | Labels, descriptions, naming |

#### 3.2.2 Module Dependency Graph

```
                    ┌──────────────────────┐
                    │  hln_conventions     │
                    │  (Standards Layer)   │
                    └──────────┬───────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  issue_generator │ │  sprint_planner  │ │release_coordinator│
│                  │ │                  │ │                  │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │
         │         ┌──────────┴──────────┐         │
         │         │                     │         │
         ▼         ▼                     ▼         ▼
┌──────────────────────┐       ┌──────────────────────┐
│     jira_reader      │       │     jira_writer      │
│   (Read Operations)  │       │  (Write Operations)  │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │    ┌────────────────────┐    │
           └───►│   JiraApiClient    │◄───┘
                │  (API Abstraction) │
                └────────────────────┘
```

### 3.3 Capabilities Matrix

#### 3.3.1 Reader Operations

```typescript
// Project Operations
fetch_project_summary(project_key: string): ProjectSummary
list_projects(filters?: ProjectFilters): Project[]
get_project_components(project_key: string): Component[]
get_project_versions(project_key: string): Version[]

// Board Operations
list_boards(project_key?: string): Board[]
get_board_configuration(board_id: number): BoardConfig
get_active_sprint(board_id: number): Sprint | null
list_sprints(board_id: number, state?: SprintState): Sprint[]

// Issue Operations
get_issue(issue_key: string, expand?: string[]): Issue
search_issues(jql: string, options?: SearchOptions): SearchResult
get_issue_comments(issue_key: string): Comment[]
get_issue_changelog(issue_key: string): ChangelogEntry[]
get_issue_transitions(issue_key: string): Transition[]

// Sprint Operations
get_sprint_issues(sprint_id: number): Issue[]
get_sprint_report(sprint_id: number): SprintReport

// User Operations
get_assignable_users(project_key: string): User[]
search_users(query: string): User[]
```

#### 3.3.2 Writer Operations

```typescript
// Issue Operations
create_issue(payload: CreateIssuePayload): Issue
update_issue(issue_key: string, changes: IssueUpdate): Issue
transition_issue(issue_key: string, transition_id: string): void
delete_issue(issue_key: string): void
assign_issue(issue_key: string, account_id: string): void

// Comment Operations
add_comment(issue_key: string, content: CommentContent): Comment
update_comment(issue_key: string, comment_id: string, content: CommentContent): Comment
delete_comment(issue_key: string, comment_id: string): void

// Label Operations
apply_labels(issue_key: string, labels: string[]): void
remove_labels(issue_key: string, labels: string[]): void
set_labels(issue_key: string, labels: string[]): void

// Field Operations
update_fields(issue_key: string, fields: FieldUpdate): void
set_priority(issue_key: string, priority: string): void
set_story_points(issue_key: string, points: number): void

// Link Operations
create_issue_link(payload: IssueLinkPayload): void
delete_issue_link(link_id: string): void

// Sprint Operations
add_issues_to_sprint(sprint_id: number, issue_keys: string[]): void
move_issues_to_backlog(issue_keys: string[]): void
```

#### 3.3.3 Planning Operations

```typescript
// Sprint Planning
create_sprint(board_id: number, name: string, goal?: string): Sprint
start_sprint(sprint_id: number, start_date: string, end_date: string): void
complete_sprint(sprint_id: number, move_to?: number | 'backlog'): void
update_sprint_goal(sprint_id: number, goal: string): void

// Capacity Planning
calculate_sprint_capacity(sprint_id: number): CapacityReport
suggest_sprint_scope(sprint_id: number, capacity: number): Issue[]

// Backlog Management
rank_issues(issue_keys: string[], position: 'top' | 'bottom' | number): void
estimate_backlog(project_key: string): EstimationReport
```

#### 3.3.4 Release Operations

```typescript
// Version Management
create_version(project_key: string, payload: VersionPayload): Version
release_version(version_id: string, release_date?: string): Version
archive_version(version_id: string): void

// Changelog Generation
generate_changelog(version_id: string): Changelog
generate_release_notes(version_id: string, template?: string): string

// Deployment Tracking
mark_deployed(issue_keys: string[], environment: string): void
get_deployment_status(version_id: string): DeploymentStatus
```

### 3.4 HLN Workflow Integration

#### 3.4.1 Workflow: Auto-Generate Jira Tickets from PRs

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PR → JIRA TICKET WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. TRIGGER: Developer creates/updates PR                                │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ git push → PR opened/updated → Claude Code hook triggered   │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  2. ANALYSIS: Claude analyzes PR content                                 │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Parse diff for changed files                              │     │
│     │ • Extract commit messages                                   │     │
│     │ • Identify affected components                              │     │
│     │ • Determine change type (feature/fix/refactor)              │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  3. GENERATION: Create/update Jira issue                                 │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ IF existing issue linked:                                   │     │
│     │   • Update description with implementation details          │     │
│     │   • Add comment with PR link                                │     │
│     │   • Update labels (add 'in-review')                         │     │
│     │ ELSE:                                                       │     │
│     │   • Create new issue with:                                  │     │
│     │     - HLN-standard description template                     │     │
│     │     - Auto-assigned labels                                  │     │
│     │     - Branch linkage                                        │     │
│     │     - Component assignment                                  │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                    │                                     │
│                                    ▼                                     │
│  4. NOTIFICATION: Update stakeholders                                    │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Add PR author as watcher                                  │     │
│     │ • Mention relevant team members                             │     │
│     │ • Update sprint board if applicable                         │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.4.2 Workflow: Sprint Planning Summaries

```typescript
// Sprint Planning Automation
async function generateSprintPlanningReport(boardId: number): Promise<SprintPlanningReport> {
  // 1. Gather context
  const sprint = await jira.getActiveSprint(boardId);
  const backlog = await jira.getBacklog(boardId);
  const velocity = await jira.getVelocityReport(boardId, { sprints: 3 });
  const capacity = await jira.getTeamCapacity(boardId, sprint.id);

  // 2. AI Analysis
  const analysis = await claude.analyze({
    prompt: `Analyze sprint planning data:
      - Current sprint: ${JSON.stringify(sprint)}
      - Backlog items: ${JSON.stringify(backlog.slice(0, 20))}
      - 3-sprint velocity: ${JSON.stringify(velocity)}
      - Team capacity: ${JSON.stringify(capacity)}

      Generate:
      1. Recommended sprint scope
      2. Risk assessment
      3. Dependency highlights
      4. Capacity warnings`,
    context: 'sprint_planning'
  });

  // 3. Generate structured report
  return {
    sprint: sprint,
    recommendedScope: analysis.scope,
    estimatedVelocity: velocity.average,
    capacityUtilization: analysis.capacityAnalysis,
    risks: analysis.risks,
    dependencies: analysis.dependencies,
    suggestions: analysis.suggestions
  };
}
```

#### 3.4.3 Workflow: Standup Automation

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DAILY STANDUP AUTOMATION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TRIGGER: Scheduled (9:00 AM) or /jira standup                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ GATHER DATA                                                      │    │
│  │ • Issues updated in last 24h                                     │    │
│  │ • Issues transitioned (status changes)                           │    │
│  │ • New comments/blockers                                          │    │
│  │ • Sprint burndown status                                         │    │
│  │ • Team member activity                                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ GENERATE STANDUP REPORT                                          │    │
│  │                                                                   │    │
│  │ ## Sprint X - Day 3/10                                           │    │
│  │ **Burndown:** 42 points remaining (target: 38)                   │    │
│  │                                                                   │    │
│  │ ### Completed Yesterday                                          │    │
│  │ - [PROJ-123] User authentication flow ✓                         │    │
│  │ - [PROJ-124] API rate limiting ✓                                 │    │
│  │                                                                   │    │
│  │ ### In Progress                                                   │    │
│  │ - [PROJ-125] Database migration (80%)                            │    │
│  │ - [PROJ-126] Frontend refactor (50%)                             │    │
│  │                                                                   │    │
│  │ ### Blockers                                                      │    │
│  │ - [PROJ-127] Waiting on design approval @designer                │    │
│  │                                                                   │    │
│  │ ### At Risk                                                       │    │
│  │ - [PROJ-128] No progress in 2 days - needs attention             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.4.4 Workflow: Retrospective Synthesis

```typescript
async function generateRetrospective(sprintId: number): Promise<RetrospectiveReport> {
  // Gather sprint data
  const sprint = await jira.getSprint(sprintId);
  const issues = await jira.getSprintIssues(sprintId);
  const report = await jira.getSprintReport(sprintId);
  const comments = await gatherAllComments(issues);
  const commits = await getSprintCommits(sprint);

  // Analyze patterns
  const analysis = await claude.analyze({
    prompt: `Generate retrospective analysis for sprint:

      Sprint Data:
      - Committed: ${report.committed} points
      - Completed: ${report.completed} points
      - Incomplete: ${report.incomplete.length} issues
      - Scope changes: ${report.scopeChanges.length}

      Issue Timeline:
      ${formatIssueTimeline(issues)}

      Team Comments/Discussions:
      ${formatComments(comments)}

      Generate:
      1. What went well (with evidence)
      2. What needs improvement (with evidence)
      3. Action items for next sprint
      4. Velocity trend analysis
      5. Team sentiment analysis`,
    context: 'retrospective'
  });

  return {
    sprint: sprint,
    metrics: report,
    wentWell: analysis.wentWell,
    improvements: analysis.improvements,
    actionItems: analysis.actionItems,
    velocityTrend: analysis.velocityTrend,
    sentiment: analysis.sentiment
  };
}
```

#### 3.4.5 Workflow: AI-Assisted Backlog Grooming

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKLOG GROOMING AUTOMATION                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  CAPABILITIES:                                                           │
│                                                                          │
│  1. DUPLICATE DETECTION                                                  │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Semantic similarity analysis across backlog               │     │
│     │ • Suggest merging/linking duplicates                        │     │
│     │ • Flag potential conflicts                                  │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  2. ESTIMATION ASSISTANCE                                                │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Compare with historically similar issues                  │     │
│     │ • Suggest story points based on complexity                  │     │
│     │ • Flag estimation outliers                                  │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  3. DEPENDENCY MAPPING                                                   │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Analyze descriptions for implicit dependencies            │     │
│     │ • Suggest issue links                                       │     │
│     │ • Identify blocking relationships                           │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  4. ACCEPTANCE CRITERIA GENERATION                                       │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Generate ACs from user story descriptions                 │     │
│     │ • Ensure testability                                        │     │
│     │ • Follow HLN AC standards                                   │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  5. EPIC BREAKDOWN                                                       │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Suggest child stories for epics                           │     │
│     │ • Ensure complete coverage                                  │     │
│     │ • Apply HLN labeling conventions                            │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. TECHNICAL IMPLEMENTATION PLAN

### 4.1 API Strategy Comparison

| Criteria | Direct REST | Forge Wrapper | Middleware Service |
|----------|-------------|---------------|-------------------|
| **Development Speed** | Fast | Medium | Slow |
| **Deployment** | None (client-side) | Atlassian-hosted | Self-hosted |
| **Auth Management** | Client handles | Forge handles | Service handles |
| **Rate Limit Control** | Full | Limited | Full |
| **Customization** | Full | Moderate | Full |
| **Maintenance** | Low | Low | High |
| **Enterprise Compliance** | Configurable | Atlassian-managed | Full control |
| **Cost** | API calls only | Forge compute | Infrastructure + API |

#### 4.1.1 Recommended Approach: Direct REST with Optional Middleware

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    HYBRID ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRIMARY: Direct REST Integration                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Claude Code Skill ──► REST API v3 ──► Jira Cloud               │    │
│  │                                                                  │    │
│  │ Benefits:                                                        │    │
│  │ • No additional infrastructure                                   │    │
│  │ • Full control over requests                                     │    │
│  │ • Transparent rate limit handling                                │    │
│  │ • Works in any environment                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  OPTIONAL: Middleware for Webhooks/Caching                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Jira Cloud ──► Webhook ──► HLN Middleware ──► Event Processing  │    │
│  │                                                                  │    │
│  │ When to use:                                                     │    │
│  │ • Real-time event processing needed                              │    │
│  │ • Heavy read patterns benefit from caching                       │    │
│  │ • Multi-tenant deployments                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Justification:**

1. **Simplicity:** Direct REST requires no additional infrastructure
2. **Portability:** Works anywhere Claude Code runs
3. **Control:** Full visibility into API usage and rate limits
4. **Flexibility:** Can add middleware layer later if needed
5. **Security:** Token management stays within Claude Code environment

### 4.2 Authentication Model

#### 4.2.1 Primary: OAuth 2.0 (3LO)

```typescript
interface OAuthConfig {
  clientId: string;          // From Atlassian Developer Console
  clientSecret: string;      // Stored securely
  redirectUri: string;       // Callback URL
  scopes: string[];          // Required permissions
}

interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  cloudId: string;
  scopes: string[];
}

class JiraOAuthManager {
  // Authorization URL generation
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      state: state,
      response_type: 'code',
      prompt: 'consent'
    });
    return `https://auth.atlassian.com/authorize?${params}`;
  }

  // Token exchange
  async exchangeCode(code: string): Promise<TokenStore> {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri
      })
    });
    return this.parseTokenResponse(response);
  }

  // Token refresh (rotating refresh tokens)
  async refreshAccessToken(refreshToken: string): Promise<TokenStore> {
    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken
      })
    });
    return this.parseTokenResponse(response);
  }
}
```

#### 4.2.2 Fallback: API Tokens

```typescript
interface ApiTokenConfig {
  email: string;           // Atlassian account email
  apiToken: string;        // Generated from account settings
  baseUrl: string;         // Jira instance URL
}

class JiraApiTokenAuth {
  getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }
}
```

#### 4.2.3 Scoped Permission Design

```yaml
# Minimum Viable Scopes (Read-Heavy Workflows)
read_scopes:
  - read:jira-work              # Issues, projects
  - read:jira-user              # User information
  - read:sprint:jira-software   # Sprint data
  - read:board:jira-software    # Board configurations

# Full Workflow Scopes (Read + Write)
write_scopes:
  - write:jira-work             # Create/update issues
  - write:sprint:jira-software  # Modify sprints

# Admin Scopes (Release Management)
admin_scopes:
  - manage:jira-project         # Project administration
  - manage:jira-configuration   # Issue types, workflows
```

### 4.3 Skill Tool Definitions

#### 4.3.1 Tool Schema Format

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  returns: JSONSchema;
  errors: ErrorDefinition[];
  rateLimit: RateLimitInfo;
  permissions: string[];
}
```

#### 4.3.2 Input Validation Rules

```typescript
const ValidationRules = {
  // Project key validation
  projectKey: {
    pattern: /^[A-Z][A-Z0-9_]{1,9}$/,
    message: 'Project key must be 2-10 uppercase alphanumeric characters'
  },

  // Issue key validation
  issueKey: {
    pattern: /^[A-Z][A-Z0-9_]+-\d+$/,
    message: 'Issue key must be in format PROJECT-123'
  },

  // Label validation (HLN conventions)
  label: {
    pattern: /^[a-z][a-z0-9-]{2,49}$/,
    message: 'Labels must be lowercase, 3-50 chars, start with letter'
  },

  // Summary validation
  summary: {
    minLength: 5,
    maxLength: 255,
    message: 'Summary must be 5-255 characters'
  },

  // Description validation
  description: {
    maxLength: 32767,
    format: 'atlassian-document-format',
    message: 'Description exceeds maximum length'
  }
};
```

#### 4.3.3 Structured JSON Outputs

```typescript
// Standard response envelope
interface JiraToolResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    rateLimitRemaining: number;
  };
}

// Issue response
interface IssueResponse {
  key: string;
  id: string;
  self: string;
  fields: {
    summary: string;
    description: object | null;
    status: StatusField;
    priority: PriorityField;
    assignee: UserField | null;
    labels: string[];
    created: string;
    updated: string;
    // ... additional fields
  };
}
```

#### 4.3.4 Error Handling Flows

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING MATRIX                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HTTP 400 - Bad Request                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Parse error details, provide actionable feedback        │    │
│  │ Retry: No                                                       │    │
│  │ Example: "Field 'customfield_10001' is required"                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  HTTP 401 - Unauthorized                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Attempt token refresh, re-authenticate if needed        │    │
│  │ Retry: Yes (after refresh)                                      │    │
│  │ Escalate: If refresh fails, prompt user re-auth                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  HTTP 403 - Forbidden                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Check scopes, inform user of missing permissions        │    │
│  │ Retry: No                                                       │    │
│  │ Example: "Missing scope: write:jira-work"                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  HTTP 404 - Not Found                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Validate input, suggest corrections                     │    │
│  │ Retry: No                                                       │    │
│  │ Example: "Issue PROJ-999 not found. Did you mean PROJ-99?"      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  HTTP 429 - Rate Limited                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Exponential backoff with Retry-After header             │    │
│  │ Retry: Yes (with delay)                                         │    │
│  │ Strategy: 1s, 2s, 4s, 8s, 16s (max 5 retries)                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  HTTP 5xx - Server Error                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Action: Log error, retry with backoff                           │    │
│  │ Retry: Yes (limited)                                            │    │
│  │ Escalate: If persistent, check Atlassian status                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Example Tool Contracts

#### 4.4.1 create_jira_issue

```typescript
/**
 * Creates a new Jira issue with HLN conventions applied
 */
interface CreateJiraIssueInput {
  /** Jira project key (e.g., "PROJ") */
  project_key: string;

  /** Issue summary/title (5-255 chars) */
  summary: string;

  /** Issue description in markdown or ADF format */
  description: string;

  /** HLN-compliant labels (lowercase, hyphenated) */
  labels: string[];

  /** Issue type: "Story" | "Bug" | "Task" | "Epic" | "Subtask" */
  issue_type: string;

  /** Optional: Priority level */
  priority?: "Highest" | "High" | "Medium" | "Low" | "Lowest";

  /** Optional: Assignee account ID */
  assignee_id?: string;

  /** Optional: Story points estimate */
  story_points?: number;

  /** Optional: Parent issue key (for subtasks) */
  parent_key?: string;

  /** Optional: Sprint ID to add issue to */
  sprint_id?: number;

  /** Optional: Fix version(s) */
  fix_versions?: string[];

  /** Optional: Components */
  components?: string[];

  /** Optional: Custom fields (key-value pairs) */
  custom_fields?: Record<string, unknown>;
}

interface CreateJiraIssueOutput {
  success: boolean;
  issue: {
    key: string;
    id: string;
    self: string;
    summary: string;
    status: string;
    labels: string[];
    created: string;
  };
  warnings?: string[];  // Non-fatal issues (e.g., label not found, created)
}

// Example usage
const result = await jira.create_issue({
  project_key: "HLN",
  summary: "Implement OAuth 2.0 token refresh",
  description: `## Overview
    Implement automatic token refresh for Jira API integration.

    ## Acceptance Criteria
    - [ ] Tokens refresh 5 minutes before expiry
    - [ ] Failed refresh triggers re-authentication flow
    - [ ] Refresh attempts logged for debugging

    ## Technical Notes
    - Use rotating refresh tokens per Atlassian spec
    - Store tokens securely in environment`,
  labels: ["auth", "security", "backend"],
  issue_type: "Story",
  priority: "High",
  story_points: 5,
  sprint_id: 42
});
```

#### 4.4.2 update_jira_issue

```typescript
interface UpdateJiraIssueInput {
  /** Issue key to update (e.g., "PROJ-123") */
  issue_key: string;

  /** Fields to update (partial update) */
  changes: {
    summary?: string;
    description?: string;
    priority?: string;
    assignee_id?: string | null;  // null to unassign
    labels?: {
      add?: string[];
      remove?: string[];
      set?: string[];  // Replace all labels
    };
    story_points?: number;
    fix_versions?: {
      add?: string[];
      remove?: string[];
    };
    components?: {
      add?: string[];
      remove?: string[];
    };
    custom_fields?: Record<string, unknown>;
  };

  /** Optional: Add comment with update */
  comment?: string;

  /** Optional: Transition to new status */
  transition_to?: string;
}

interface UpdateJiraIssueOutput {
  success: boolean;
  issue: {
    key: string;
    updated_fields: string[];
    new_status?: string;
    comment_id?: string;
  };
  warnings?: string[];
}
```

#### 4.4.3 search_issues

```typescript
interface SearchIssuesInput {
  /** JQL query string */
  jql: string;

  /** Fields to return (default: key,summary,status,assignee) */
  fields?: string[];

  /** Expand options: changelog, renderedFields, transitions */
  expand?: string[];

  /** Pagination */
  start_at?: number;
  max_results?: number;  // Default: 50, Max: 100

  /** Order by (JQL ORDER BY clause) */
  order_by?: string;
}

interface SearchIssuesOutput {
  success: boolean;
  issues: Array<{
    key: string;
    summary: string;
    status: string;
    assignee: string | null;
    priority: string;
    labels: string[];
    created: string;
    updated: string;
    // Additional requested fields
    [key: string]: unknown;
  }>;
  pagination: {
    start_at: number;
    max_results: number;
    total: number;
    has_more: boolean;
  };
  jql_validated: string;  // Actual JQL executed
}

// Example: Natural language to JQL
// User: "Show me high priority bugs assigned to me in the current sprint"
// Generated JQL: project = HLN AND type = Bug AND priority in (High, Highest)
//                AND assignee = currentUser() AND sprint in openSprints()
```

#### 4.4.4 apply_hln_labels

```typescript
interface ApplyHlnLabelsInput {
  /** Issue key */
  issue_key: string;

  /** Labels to apply (will be validated against HLN conventions) */
  labels: string[];

  /** Label operation mode */
  mode: "add" | "remove" | "set";

  /** Auto-create labels if they don't exist in project */
  create_if_missing?: boolean;
}

interface ApplyHlnLabelsOutput {
  success: boolean;
  applied: string[];
  rejected: Array<{
    label: string;
    reason: string;
  }>;
  created: string[];  // Labels that were auto-created
  final_labels: string[];  // All labels on issue after operation
}

// HLN Label Categories (enforced by skill)
const HLN_LABEL_PREFIXES = {
  team: ["frontend", "backend", "devops", "qa", "design"],
  type: ["feature", "bug", "tech-debt", "spike", "doc"],
  status: ["blocked", "needs-review", "in-progress", "ready"],
  priority: ["p0-critical", "p1-high", "p2-medium", "p3-low"],
  component: ["api", "ui", "db", "auth", "infra"]
};
```

---

## 5. PROTOTYPE IMPLEMENTATION

### 5.1 Folder Structure

```
jira-skill/
├── SKILL.md                          # Main skill entry point
├── .env.template                     # Environment variable template
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript configuration
│
├── src/
│   ├── index.ts                      # Main exports
│   │
│   ├── api/
│   │   ├── client.ts                 # JiraApiClient core
│   │   ├── auth.ts                   # Authentication handlers
│   │   ├── rate-limiter.ts           # Rate limit management
│   │   └── types.ts                  # API type definitions
│   │
│   ├── modules/
│   │   ├── reader.ts                 # jira_reader module
│   │   ├── writer.ts                 # jira_writer module
│   │   ├── sprint-planner.ts         # sprint_planner module
│   │   ├── issue-generator.ts        # issue_generator module
│   │   ├── release-coordinator.ts    # release_coordinator module
│   │   └── workflow-engine.ts        # workflow_automation_engine
│   │
│   ├── conventions/
│   │   ├── hln-labels.ts             # HLN label validation
│   │   ├── hln-templates.ts          # Issue templates
│   │   └── hln-workflows.ts          # Standard workflows
│   │
│   ├── utils/
│   │   ├── jql-builder.ts            # JQL query builder
│   │   ├── adf-builder.ts            # Atlassian Document Format
│   │   ├── validators.ts             # Input validation
│   │   └── logger.ts                 # Logging utilities
│   │
│   └── tools/
│       ├── definitions.ts            # Tool schemas for Claude
│       └── handlers.ts               # Tool execution handlers
│
├── reference/
│   ├── api-reference.md              # Jira API documentation
│   ├── hln-conventions.md            # HLN standards
│   └── workflow-templates.md         # Workflow definitions
│
├── scripts/
│   ├── setup-oauth.sh                # OAuth setup helper
│   ├── test-connection.sh            # Connection tester
│   └── audit-log.sh                  # Audit logging hook
│
└── tests/
    ├── api/
    ├── modules/
    └── integration/
```

### 5.2 TypeScript Implementation Plan

#### 5.2.1 Phase 1: Core API Client

```typescript
// src/api/client.ts
import { RateLimiter } from './rate-limiter';
import { JiraAuth, AuthConfig } from './auth';
import { JiraApiError, RateLimitError } from './errors';

interface JiraClientConfig {
  cloudId: string;
  auth: AuthConfig;
  rateLimitStrategy?: 'aggressive' | 'conservative';
  retryConfig?: RetryConfig;
}

export class JiraApiClient {
  private baseUrl: string;
  private auth: JiraAuth;
  private rateLimiter: RateLimiter;
  private retryConfig: RetryConfig;

  constructor(config: JiraClientConfig) {
    this.baseUrl = `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`;
    this.auth = new JiraAuth(config.auth);
    this.rateLimiter = new RateLimiter(config.rateLimitStrategy);
    this.retryConfig = config.retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions
  ): Promise<JiraResponse<T>> {
    await this.rateLimiter.acquire();

    const headers = {
      'Authorization': await this.auth.getAuthHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers
    };

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined
      });

      this.rateLimiter.updateFromResponse(response);

      if (!response.ok) {
        return this.handleError(response);
      }

      return {
        success: true,
        data: await response.json(),
        metadata: this.extractMetadata(response)
      };
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  // Convenience methods
  async get<T>(path: string, params?: QueryParams): Promise<JiraResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    return this.request('GET', `${path}${queryString}`);
  }

  async post<T>(path: string, body: unknown): Promise<JiraResponse<T>> {
    return this.request('POST', path, { body });
  }

  async put<T>(path: string, body: unknown): Promise<JiraResponse<T>> {
    return this.request('PUT', path, { body });
  }

  async delete(path: string): Promise<JiraResponse<void>> {
    return this.request('DELETE', path);
  }
}
```

#### 5.2.2 Phase 2: Module Implementation

```typescript
// src/modules/reader.ts
import { JiraApiClient } from '../api/client';
import {
  Project,
  Issue,
  Sprint,
  Board,
  SearchResult
} from '../api/types';

export class JiraReader {
  constructor(private client: JiraApiClient) {}

  async getProject(projectKey: string): Promise<Project> {
    const response = await this.client.get<Project>(
      `/project/${projectKey}`,
      { expand: 'description,lead,components,versions' }
    );
    if (!response.success) throw new JiraError(response.error);
    return response.data;
  }

  async getIssue(
    issueKey: string,
    options?: GetIssueOptions
  ): Promise<Issue> {
    const params: QueryParams = {};
    if (options?.fields) params.fields = options.fields.join(',');
    if (options?.expand) params.expand = options.expand.join(',');

    const response = await this.client.get<Issue>(
      `/issue/${issueKey}`,
      params
    );
    if (!response.success) throw new JiraError(response.error);
    return response.data;
  }

  async searchIssues(
    jql: string,
    options?: SearchOptions
  ): Promise<SearchResult> {
    const response = await this.client.post<SearchResult>('/search', {
      jql,
      fields: options?.fields ?? ['key', 'summary', 'status', 'assignee', 'labels'],
      expand: options?.expand,
      startAt: options?.startAt ?? 0,
      maxResults: Math.min(options?.maxResults ?? 50, 100)
    });
    if (!response.success) throw new JiraError(response.error);
    return response.data;
  }

  async getActiveSprint(boardId: number): Promise<Sprint | null> {
    const response = await this.client.get<{ values: Sprint[] }>(
      `/agile/1.0/board/${boardId}/sprint`,
      { state: 'active' }
    );
    if (!response.success) throw new JiraError(response.error);
    return response.data.values[0] ?? null;
  }

  async getSprintIssues(sprintId: number): Promise<Issue[]> {
    const response = await this.client.get<{ issues: Issue[] }>(
      `/agile/1.0/sprint/${sprintId}/issue`,
      {
        fields: 'key,summary,status,assignee,labels,priority,customfield_10016',
        maxResults: 100
      }
    );
    if (!response.success) throw new JiraError(response.error);
    return response.data.issues;
  }
}
```

```typescript
// src/modules/writer.ts
import { JiraApiClient } from '../api/client';
import { HlnConventions } from '../conventions/hln-labels';
import {
  CreateIssuePayload,
  UpdateIssuePayload,
  Issue
} from '../api/types';

export class JiraWriter {
  constructor(
    private client: JiraApiClient,
    private conventions: HlnConventions
  ) {}

  async createIssue(payload: CreateIssuePayload): Promise<Issue> {
    // Validate and transform labels
    const validatedLabels = this.conventions.validateLabels(payload.labels);
    if (validatedLabels.rejected.length > 0) {
      console.warn('Rejected labels:', validatedLabels.rejected);
    }

    // Build Jira API payload
    const apiPayload = {
      fields: {
        project: { key: payload.project_key },
        summary: payload.summary,
        description: this.formatDescription(payload.description),
        issuetype: { name: payload.issue_type },
        labels: validatedLabels.accepted,
        ...(payload.priority && { priority: { name: payload.priority } }),
        ...(payload.assignee_id && { assignee: { accountId: payload.assignee_id } }),
        ...(payload.story_points && { customfield_10016: payload.story_points }),
        ...(payload.parent_key && { parent: { key: payload.parent_key } }),
        ...(payload.components && {
          components: payload.components.map(c => ({ name: c }))
        }),
        ...(payload.fix_versions && {
          fixVersions: payload.fix_versions.map(v => ({ name: v }))
        }),
        ...payload.custom_fields
      }
    };

    const response = await this.client.post<Issue>('/issue', apiPayload);
    if (!response.success) throw new JiraError(response.error);

    // Add to sprint if specified
    if (payload.sprint_id) {
      await this.addToSprint(response.data.key, payload.sprint_id);
    }

    return response.data;
  }

  async updateIssue(
    issueKey: string,
    changes: UpdateIssuePayload
  ): Promise<Issue> {
    const update: any = {};
    const fields: any = {};

    // Handle simple field updates
    if (changes.summary) fields.summary = changes.summary;
    if (changes.description) fields.description = this.formatDescription(changes.description);
    if (changes.priority) fields.priority = { name: changes.priority };
    if (changes.assignee_id !== undefined) {
      fields.assignee = changes.assignee_id
        ? { accountId: changes.assignee_id }
        : null;
    }

    // Handle label operations
    if (changes.labels) {
      if (changes.labels.set) {
        const validated = this.conventions.validateLabels(changes.labels.set);
        fields.labels = validated.accepted;
      } else {
        if (changes.labels.add) {
          update.labels = update.labels ?? [];
          const validated = this.conventions.validateLabels(changes.labels.add);
          update.labels.push(...validated.accepted.map(l => ({ add: l })));
        }
        if (changes.labels.remove) {
          update.labels = update.labels ?? [];
          update.labels.push(...changes.labels.remove.map(l => ({ remove: l })));
        }
      }
    }

    const response = await this.client.put<void>(
      `/issue/${issueKey}`,
      { fields, update }
    );
    if (!response.success) throw new JiraError(response.error);

    // Handle transition if specified
    if (changes.transition_to) {
      await this.transitionIssue(issueKey, changes.transition_to);
    }

    // Add comment if specified
    if (changes.comment) {
      await this.addComment(issueKey, changes.comment);
    }

    return this.getIssue(issueKey);
  }

  async addComment(issueKey: string, body: string): Promise<Comment> {
    const response = await this.client.post<Comment>(
      `/issue/${issueKey}/comment`,
      { body: this.formatDescription(body) }
    );
    if (!response.success) throw new JiraError(response.error);
    return response.data;
  }

  async applyLabels(
    issueKey: string,
    labels: string[],
    mode: 'add' | 'remove' | 'set' = 'add'
  ): Promise<ApplyLabelsResult> {
    const validated = this.conventions.validateLabels(labels);

    const update = mode === 'set'
      ? { fields: { labels: validated.accepted } }
      : { update: { labels: validated.accepted.map(l => ({ [mode]: l })) } };

    const response = await this.client.put<void>(`/issue/${issueKey}`, update);
    if (!response.success) throw new JiraError(response.error);

    const issue = await this.getIssue(issueKey);
    return {
      applied: validated.accepted,
      rejected: validated.rejected,
      finalLabels: issue.fields.labels
    };
  }

  private formatDescription(markdown: string): object {
    // Convert markdown to Atlassian Document Format (ADF)
    return markdownToAdf(markdown);
  }
}
```

### 5.3 Sample Working API Wrapper

```typescript
// src/index.ts - Complete working example

import { JiraApiClient } from './api/client';
import { JiraReader } from './modules/reader';
import { JiraWriter } from './modules/writer';
import { HlnConventions } from './conventions/hln-labels';

export interface JiraSkillConfig {
  cloudId: string;
  auth: {
    type: 'oauth' | 'api_token';
    // OAuth config
    accessToken?: string;
    refreshToken?: string;
    // API token config
    email?: string;
    apiToken?: string;
  };
}

export class JiraSkill {
  private client: JiraApiClient;
  public reader: JiraReader;
  public writer: JiraWriter;
  private conventions: HlnConventions;

  constructor(config: JiraSkillConfig) {
    this.client = new JiraApiClient({
      cloudId: config.cloudId,
      auth: config.auth
    });
    this.conventions = new HlnConventions();
    this.reader = new JiraReader(this.client);
    this.writer = new JiraWriter(this.client, this.conventions);
  }

  // High-level convenience methods

  async getProjectSummary(projectKey: string): Promise<ProjectSummary> {
    const project = await this.reader.getProject(projectKey);
    const boards = await this.reader.listBoards(projectKey);
    const activeSprint = boards[0]
      ? await this.reader.getActiveSprint(boards[0].id)
      : null;

    return {
      project,
      boards,
      activeSprint,
      sprintIssues: activeSprint
        ? await this.reader.getSprintIssues(activeSprint.id)
        : []
    };
  }

  async createIssueFromPR(prData: PullRequestData): Promise<Issue> {
    const labels = this.conventions.inferLabelsFromPR(prData);
    const description = this.conventions.generateIssueDescription(prData);

    return this.writer.createIssue({
      project_key: prData.projectKey,
      summary: prData.title,
      description,
      labels,
      issue_type: this.conventions.inferIssueType(prData),
      priority: 'Medium'
    });
  }

  async generateStandupReport(boardId: number): Promise<StandupReport> {
    const sprint = await this.reader.getActiveSprint(boardId);
    if (!sprint) throw new Error('No active sprint');

    const issues = await this.reader.getSprintIssues(sprint.id);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return {
      sprint: sprint.name,
      day: `Day ${this.calculateSprintDay(sprint)}`,
      completed: issues.filter(i =>
        i.fields.status.name === 'Done' &&
        new Date(i.fields.updated) > yesterday
      ),
      inProgress: issues.filter(i =>
        i.fields.status.statusCategory.name === 'In Progress'
      ),
      blocked: issues.filter(i =>
        i.fields.labels.includes('blocked')
      ),
      atRisk: this.identifyAtRiskIssues(issues)
    };
  }
}

// Export for Claude Code skill registration
export const tools = {
  create_jira_issue: {
    handler: async (input: CreateJiraIssueInput) => {
      const skill = getJiraSkill();
      return skill.writer.createIssue(input);
    },
    schema: CreateJiraIssueSchema
  },

  search_jira_issues: {
    handler: async (input: SearchIssuesInput) => {
      const skill = getJiraSkill();
      return skill.reader.searchIssues(input.jql, input);
    },
    schema: SearchIssuesSchema
  },

  update_jira_issue: {
    handler: async (input: UpdateJiraIssueInput) => {
      const skill = getJiraSkill();
      return skill.writer.updateIssue(input.issue_key, input.changes);
    },
    schema: UpdateJiraIssueSchema
  },

  apply_hln_labels: {
    handler: async (input: ApplyHlnLabelsInput) => {
      const skill = getJiraSkill();
      return skill.writer.applyLabels(
        input.issue_key,
        input.labels,
        input.mode
      );
    },
    schema: ApplyHlnLabelsSchema
  },

  generate_standup: {
    handler: async (input: { board_id: number }) => {
      const skill = getJiraSkill();
      return skill.generateStandupReport(input.board_id);
    },
    schema: GenerateStandupSchema
  }
};
```

### 5.4 Claude Code Tool Registration Config

```yaml
# SKILL.md
---
name: jira
description: |
  Jira integration for HLN engineering workflows. Provides:
  - Issue management (create, update, search, transition)
  - Sprint operations (planning, tracking, reports)
  - Release coordination (versions, changelogs)
  - Workflow automation (PR→ticket, standups, retros)

  Use when: working with Jira issues, planning sprints,
  generating reports, or automating engineering workflows.

argument-hint: [command] [options...]

disable-model-invocation: false
user-invocable: true

allowed-tools:
  - Read
  - Grep
  - Bash(curl https://api.atlassian.com/*)
  - Bash(jq *)

model: claude-opus-4-5
context: fork
agent: general-purpose

hooks:
  PostToolUse:
    - matcher: Bash(curl *)
      script: ${CLAUDE_SKILL_DIR}/scripts/audit-log.sh
---

# Jira Claude Code Skill

## Available Commands

### Issue Operations
- `/jira issue create <project> <summary>` - Create new issue
- `/jira issue get <issue-key>` - Get issue details
- `/jira issue update <issue-key>` - Update issue fields
- `/jira issue search <jql>` - Search with JQL
- `/jira issue transition <issue-key> <status>` - Change status

### Sprint Operations
- `/jira sprint current <board-id>` - Get current sprint
- `/jira sprint report <board-id>` - Generate sprint report
- `/jira sprint plan <board-id>` - Sprint planning summary

### Workflow Operations
- `/jira standup <board-id>` - Generate standup report
- `/jira retro <sprint-id>` - Generate retrospective
- `/jira pr-to-issue` - Create issue from current PR

### Label Operations
- `/jira labels add <issue-key> <labels...>` - Add HLN labels
- `/jira labels set <issue-key> <labels...>` - Set labels

## HLN Label Conventions

Labels must follow HLN naming:
- Lowercase with hyphens: `feature-auth`, `bug-critical`
- Team prefixes: `team-frontend`, `team-backend`
- Type prefixes: `type-feature`, `type-bug`, `type-spike`
- Priority: `p0-critical`, `p1-high`, `p2-medium`, `p3-low`

## Environment Setup

Required environment variables:
```
JIRA_CLOUD_ID=your-cloud-id
JIRA_AUTH_TYPE=oauth|api_token
JIRA_ACCESS_TOKEN=...
JIRA_REFRESH_TOKEN=...
# OR
JIRA_EMAIL=...
JIRA_API_TOKEN=...
```

See [reference/api-reference.md](reference/api-reference.md) for API details.
See [reference/hln-conventions.md](reference/hln-conventions.md) for standards.
```

### 5.5 Environment Variable Template

```bash
# .env.template
# Jira Claude Code Skill Configuration

# ============================================
# JIRA CLOUD CONNECTION
# ============================================

# Your Jira Cloud ID (found in URL: your-domain.atlassian.net)
# Get from: https://api.atlassian.com/oauth/token/accessible-resources
JIRA_CLOUD_ID=

# Jira instance base URL (for reference/logging)
JIRA_BASE_URL=https://your-domain.atlassian.net

# ============================================
# AUTHENTICATION
# ============================================

# Auth type: "oauth" or "api_token"
JIRA_AUTH_TYPE=oauth

# OAuth 2.0 Configuration (recommended for production)
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_REDIRECT_URI=http://localhost:3000/callback
JIRA_ACCESS_TOKEN=
JIRA_REFRESH_TOKEN=
JIRA_TOKEN_EXPIRES_AT=

# API Token Configuration (simpler, for dev/testing)
# JIRA_AUTH_TYPE=api_token
# JIRA_EMAIL=your-email@company.com
# JIRA_API_TOKEN=

# ============================================
# OAUTH SCOPES
# ============================================

# Space-separated list of OAuth scopes
JIRA_OAUTH_SCOPES="read:jira-work write:jira-work read:jira-user read:sprint:jira-software write:sprint:jira-software"

# ============================================
# RATE LIMITING
# ============================================

# Strategy: "aggressive" (faster, risk 429s) or "conservative" (slower, safer)
JIRA_RATE_LIMIT_STRATEGY=conservative

# Max retries on 429 errors
JIRA_MAX_RETRIES=5

# Base delay for exponential backoff (ms)
JIRA_RETRY_BASE_DELAY=1000

# ============================================
# HLN CONVENTIONS
# ============================================

# Default project key for operations
HLN_DEFAULT_PROJECT=HLN

# Label prefix enforcement (comma-separated)
HLN_LABEL_PREFIXES=team,type,priority,component,status

# Required labels for issue creation (comma-separated)
HLN_REQUIRED_LABELS=team,type

# ============================================
# LOGGING & AUDIT
# ============================================

# Log level: debug, info, warn, error
JIRA_LOG_LEVEL=info

# Enable audit logging
JIRA_AUDIT_ENABLED=true

# Audit log path
JIRA_AUDIT_LOG_PATH=./logs/jira-audit.log

# ============================================
# OPTIONAL: WEBHOOK RECEIVER
# ============================================

# Enable webhook receiver for real-time events
JIRA_WEBHOOK_ENABLED=false

# Webhook receiver port
JIRA_WEBHOOK_PORT=3001

# Webhook secret for signature verification
JIRA_WEBHOOK_SECRET=

# ============================================
# OPTIONAL: CACHING
# ============================================

# Enable response caching
JIRA_CACHE_ENABLED=true

# Cache TTL in seconds
JIRA_CACHE_TTL=300

# Cache max size (entries)
JIRA_CACHE_MAX_SIZE=1000
```

---

## 6. SECURITY & ENTERPRISE READINESS

### 6.1 RBAC Alignment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION MODEL ALIGNMENT                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  JIRA PERMISSIONS              SKILL OPERATIONS                          │
│  ───────────────              ────────────────                           │
│                                                                          │
│  Browse Projects        ──►   fetch_project_summary                      │
│                               list_projects                              │
│                               search_issues (read)                       │
│                                                                          │
│  Create Issues          ──►   create_issue                               │
│                               create_subtask                             │
│                                                                          │
│  Edit Issues            ──►   update_issue                               │
│                               apply_labels                               │
│                               transition_issue                           │
│                                                                          │
│  Delete Issues          ──►   delete_issue                               │
│                               (disabled by default)                      │
│                                                                          │
│  Manage Sprints         ──►   create_sprint                              │
│                               start_sprint                               │
│                               complete_sprint                            │
│                                                                          │
│  Administer Projects    ──►   create_version                             │
│                               release_version                            │
│                               manage_components                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation Strategy:**

1. **Scope-Based Access Control:**
   - Skill operations map directly to OAuth scopes
   - Operations fail gracefully with permission errors
   - User informed of missing permissions

2. **Project-Level Restrictions:**
   - Configure allowed projects in environment
   - Default project enforcement
   - Cross-project operations require explicit scope

3. **Operation Whitelisting:**
   - Destructive operations (delete) disabled by default
   - Require explicit enablement flag
   - Audit all destructive operations

### 6.2 Audit Logging Strategy

```typescript
interface AuditLogEntry {
  timestamp: string;           // ISO 8601
  session_id: string;          // Claude Code session
  user_id: string;             // Jira account ID
  operation: string;           // e.g., "create_issue"
  target: string;              // e.g., "PROJ-123"
  input_hash: string;          // SHA-256 of input (no PII)
  result: 'success' | 'failure';
  error_code?: string;
  duration_ms: number;
  rate_limit_remaining: number;
}

// Audit log format (JSONL for easy ingestion)
{"timestamp":"2026-03-05T10:30:00Z","session_id":"abc123","user_id":"5f3...","operation":"create_issue","target":"PROJ-456","input_hash":"a1b2c3...","result":"success","duration_ms":234,"rate_limit_remaining":64500}
```

**Log Retention:**
- Local logs: 30 days rolling
- Shipped to enterprise SIEM: Configurable
- PII-free by design (hashed inputs, no descriptions)

### 6.3 Data Minimization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA MINIMIZATION PRINCIPLES                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. REQUEST ONLY NEEDED FIELDS                                           │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Default: key, summary, status, assignee, labels              │     │
│     │ Expanded: Only when explicitly requested                     │     │
│     │ Never: Sensitive custom fields without whitelist             │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  2. NO PERSISTENT STORAGE OF ISSUE CONTENT                               │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Issue descriptions not cached                              │     │
│     │ • Comments not persisted                                     │     │
│     │ • Attachments never downloaded                               │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  3. TOKEN SECURITY                                                       │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Tokens stored in environment only                          │     │
│     │ • Never logged or transmitted beyond auth headers            │     │
│     │ • Refresh tokens rotated per Atlassian spec                  │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  4. CONTEXT WINDOW HYGIENE                                               │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ • Large responses truncated before context injection         │     │
│     │ • Sensitive fields redacted in logs                          │     │
│     │ • Search results limited to metadata                         │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Rate Limiting Mitigation

```typescript
class RateLimiter {
  private pointsRemaining: number = 65000;
  private requestsThisSecond: number = 0;
  private lastSecond: number = 0;

  async acquire(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Reset per-second counter
    if (now > this.lastSecond) {
      this.requestsThisSecond = 0;
      this.lastSecond = now;
    }

    // Check per-second limit
    if (this.requestsThisSecond >= this.maxRequestsPerSecond) {
      await this.waitForNextSecond();
    }

    // Check points budget (conservative mode)
    if (this.strategy === 'conservative' && this.pointsRemaining < 1000) {
      await this.waitForPointsRefresh();
    }

    this.requestsThisSecond++;
  }

  updateFromResponse(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (remaining) {
      this.pointsRemaining = parseInt(remaining, 10);
    }

    // Handle 429 with Retry-After
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      this.scheduleRetry(retryAfter);
    }
  }

  private async exponentialBackoff(attempt: number): Promise<void> {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt),
      this.maxDelay
    );
    await sleep(delay + Math.random() * 1000);
  }
}
```

### 6.5 Enterprise Deployment Considerations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTERPRISE DEPLOYMENT CHECKLIST                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  □ NETWORK CONFIGURATION                                                 │
│    ├─ Allowlist api.atlassian.com egress                                │
│    ├─ Allowlist auth.atlassian.com egress                               │
│    └─ Configure proxy if required                                        │
│                                                                          │
│  □ AUTHENTICATION SETUP                                                  │
│    ├─ Register OAuth app in Atlassian Developer Console                 │
│    ├─ Configure redirect URIs for your environment                      │
│    ├─ Store client secrets in secure vault                              │
│    └─ Implement token rotation handling                                  │
│                                                                          │
│  □ PERMISSIONS REVIEW                                                    │
│    ├─ Minimum scopes documented and justified                           │
│    ├─ Project-level access controls configured                          │
│    └─ Destructive operations disabled by default                        │
│                                                                          │
│  □ MONITORING & ALERTING                                                 │
│    ├─ Rate limit usage dashboards                                       │
│    ├─ Error rate alerting (>5% threshold)                               │
│    ├─ Audit log shipping to SIEM                                        │
│    └─ Token expiration monitoring                                        │
│                                                                          │
│  □ COMPLIANCE                                                            │
│    ├─ Data residency requirements met                                   │
│    ├─ Audit logging enabled and shipped                                 │
│    ├─ No PII in logs                                                    │
│    └─ Retention policies configured                                      │
│                                                                          │
│  □ DISASTER RECOVERY                                                     │
│    ├─ Token backup/recovery procedures                                  │
│    ├─ Graceful degradation on API unavailability                        │
│    └─ Manual fallback procedures documented                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. ROADMAP

### 7.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION ROADMAP                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Research + PoC                                                 │
│  ══════════════════════                                                  │
│  ├─ Validate API integration patterns                                    │
│  ├─ Prototype core read/write operations                                 │
│  ├─ Test OAuth flow end-to-end                                          │
│  └─ Deliverable: Working demo with 5 core operations                    │
│                                                                          │
│  PHASE 2: Core Skill MVP                                                 │
│  ═══════════════════════                                                 │
│  ├─ Full jira_reader module                                              │
│  ├─ Full jira_writer module                                              │
│  ├─ HLN conventions enforcement                                          │
│  ├─ Error handling and rate limiting                                     │
│  └─ Deliverable: Production-ready skill for basic workflows             │
│                                                                          │
│  PHASE 3: HLN Workflow Automation                                        │
│  ════════════════════════════════                                        │
│  ├─ Sprint planning automation                                           │
│  ├─ Standup report generation                                            │
│  ├─ PR → Jira ticket automation                                          │
│  ├─ Backlog grooming assistance                                          │
│  └─ Deliverable: Automated daily engineering workflows                  │
│                                                                          │
│  PHASE 4: Aria + Axis Integration                                        │
│  ════════════════════════════════                                        │
│  ├─ Shared capability registration                                       │
│  ├─ Cross-agent workflow orchestration                                   │
│  ├─ Context passing between agents                                       │
│  └─ Deliverable: Unified multi-agent Jira operations                    │
│                                                                          │
│  PHASE 5: Autonomous Engineering Workflows                               │
│  ══════════════════════════════════════════                              │
│  ├─ End-to-end release automation                                        │
│  ├─ Intelligent backlog prioritization                                   │
│  ├─ Predictive sprint planning                                           │
│  ├─ Autonomous issue triage                                              │
│  └─ Deliverable: Self-driving engineering operations                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Phase Details

#### Phase 1: Research + PoC

**Objectives:**
- Validate Jira Cloud API integration feasibility
- Test OAuth 2.0 (3LO) flow in Claude Code environment
- Prototype 5 core operations

**Deliverables:**
| Deliverable | Description |
|-------------|-------------|
| API wrapper prototype | Basic JiraApiClient with auth |
| OAuth flow demo | End-to-end token acquisition |
| Core operations | get_issue, create_issue, search_issues, add_comment, apply_labels |
| Rate limit testing | Behavior under load |
| Documentation | API findings, blockers, recommendations |

**Success Criteria:**
- [ ] Successfully authenticate with OAuth 2.0
- [ ] Read issue data from test project
- [ ] Create and update issues programmatically
- [ ] Demonstrate rate limit handling

#### Phase 2: Core Skill MVP

**Objectives:**
- Complete jira_reader and jira_writer modules
- Implement HLN convention enforcement
- Production-grade error handling

**Deliverables:**
| Deliverable | Description |
|-------------|-------------|
| jira_reader | All read operations (issues, sprints, boards, projects) |
| jira_writer | All write operations (create, update, transition, comment) |
| hln_conventions | Label validation, templates, naming enforcement |
| SKILL.md | Complete skill definition with tool registration |
| Test suite | Unit and integration tests |
| Documentation | User guide, API reference |

**Success Criteria:**
- [ ] All reader operations functional
- [ ] All writer operations functional
- [ ] HLN labels enforced on all writes
- [ ] 80%+ test coverage
- [ ] Deployed to HLN engineering team

#### Phase 3: HLN Workflow Automation

**Objectives:**
- Automate daily engineering workflows
- Reduce manual Jira overhead

**Deliverables:**
| Deliverable | Description |
|-------------|-------------|
| sprint_planner | Planning reports, capacity analysis |
| Standup automation | Daily status reports |
| PR→Jira integration | Automatic ticket creation/linking |
| Backlog grooming | Duplicate detection, estimation assist |
| Retrospective synthesis | AI-generated retro insights |

**Success Criteria:**
- [ ] Standup reports generated automatically
- [ ] PR-to-ticket flow operational
- [ ] Sprint planning time reduced by 50%
- [ ] Team adoption >80%

#### Phase 4: Aria + Axis Integration

**Objectives:**
- Enable multi-agent Jira operations
- Unified context across agent ecosystem

**Deliverables:**
| Deliverable | Description |
|-------------|-------------|
| Shared capability API | Cross-agent Jira access |
| Context protocol | Jira context passing standard |
| Workflow orchestration | Multi-step cross-agent flows |
| Integration tests | Aria/Axis compatibility |

**Success Criteria:**
- [ ] Aria can read/write Jira through skill
- [ ] Axis can update Jira during execution
- [ ] Context preserved across agent boundaries
- [ ] No duplicate API calls

#### Phase 5: Autonomous Engineering Workflows

**Objectives:**
- Enable AI-driven engineering operations
- Minimize human intervention for routine tasks

**Deliverables:**
| Deliverable | Description |
|-------------|-------------|
| Release automation | End-to-end release coordination |
| Intelligent triage | Auto-categorization, assignment |
| Predictive planning | AI-recommended sprint scope |
| Anomaly detection | Blocked/at-risk issue identification |

**Success Criteria:**
- [ ] Releases coordinated without manual intervention
- [ ] Issue triage accuracy >90%
- [ ] Sprint planning recommendations adopted >70%
- [ ] Engineering velocity increased measurably

---

## 8. RISKS & UNKNOWNS

### 8.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Rate limit exhaustion** | Medium | High | Conservative limits, caching, webhook-driven |
| **OAuth token expiry during long sessions** | Medium | Medium | Proactive refresh, graceful re-auth |
| **API breaking changes** | Low | High | Version pinning, change monitoring |
| **Context window exhaustion** | Medium | Medium | Response truncation, pagination |
| **Forge migration (2025)** | Low | Medium | REST API remains supported |

### 8.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Jira Cloud downtime** | Low | High | Graceful degradation, retry logic |
| **Permission drift** | Medium | Medium | Periodic scope audits |
| **Token compromise** | Low | Critical | Rotation, secure storage, monitoring |
| **Audit log gaps** | Low | Medium | Redundant logging, SIEM integration |

### 8.3 Adoption Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **User resistance** | Medium | Medium | Gradual rollout, training |
| **Workflow mismatch** | Medium | Medium | Customizable conventions |
| **Over-automation concerns** | Medium | Low | Transparency, manual overrides |
| **Learning curve** | Medium | Low | Documentation, examples |

### 8.4 Unknowns Requiring Investigation

1. **Atlassian Intelligence Interaction**
   - How does the skill coexist with native AI features?
   - Potential for conflicting automations?

2. **MCP Protocol Integration**
   - Atlassian announced MCP investments (Feb 2026)
   - Could provide native Claude integration path
   - Need to monitor and potentially pivot

3. **Multi-Tenant Scenarios**
   - How to handle users with access to multiple Jira Cloud instances?
   - Cloud ID switching mechanism needed?

4. **Webhook Security at Scale**
   - If webhooks are added, how to secure receiver endpoint?
   - Signature verification implementation details?

5. **Data Residency Implications**
   - Does skill operation comply with data residency requirements?
   - Are there geographic restrictions on API access?

---

## APPENDIX A: API ENDPOINT REFERENCE

```
Jira Cloud REST API v3 Base: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3

Issues:
  GET    /issue/{issueIdOrKey}
  POST   /issue
  PUT    /issue/{issueIdOrKey}
  DELETE /issue/{issueIdOrKey}
  POST   /search

Comments:
  GET    /issue/{issueIdOrKey}/comment
  POST   /issue/{issueIdOrKey}/comment
  PUT    /issue/{issueIdOrKey}/comment/{id}
  DELETE /issue/{issueIdOrKey}/comment/{id}

Projects:
  GET    /project
  GET    /project/{projectIdOrKey}

Boards (Agile):
  GET    /agile/1.0/board
  GET    /agile/1.0/board/{boardId}

Sprints:
  GET    /agile/1.0/board/{boardId}/sprint
  GET    /agile/1.0/sprint/{sprintId}
  POST   /agile/1.0/sprint
  PUT    /agile/1.0/sprint/{sprintId}
  POST   /agile/1.0/sprint/{sprintId}/issue

Versions:
  GET    /project/{projectIdOrKey}/versions
  POST   /version
  PUT    /version/{id}
```

---

## APPENDIX B: HLN LABEL TAXONOMY

```yaml
# HLN Standard Labels

team:
  - team-frontend
  - team-backend
  - team-devops
  - team-qa
  - team-design
  - team-data

type:
  - type-feature
  - type-bug
  - type-tech-debt
  - type-spike
  - type-doc
  - type-test

priority:
  - p0-critical    # Production down
  - p1-high        # Major impact
  - p2-medium      # Normal priority
  - p3-low         # Nice to have

status:
  - status-blocked
  - status-needs-review
  - status-needs-design
  - status-needs-qa
  - status-ready

component:
  - component-api
  - component-ui
  - component-db
  - component-auth
  - component-infra
  - component-ci

release:
  - release-v{major}.{minor}
  - release-hotfix
  - release-scheduled
```

---

## APPENDIX C: REFERENCES

### Atlassian Documentation
- [Jira Cloud REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [OAuth 2.0 (3LO) Apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira Scopes](https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/)
- [Rate Limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
- [Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
- [Forge Platform](https://developer.atlassian.com/cloud/jira/platform/forge/)

### Claude Code Documentation
- Claude Code Skills Documentation
- Claude Code Hooks Guide
- Claude Agent SDK Reference

### Industry Resources
- [Atlassian 2025 Platform Changes](https://www.atlassian.com/blog/platform/evolving-api-rate-limits)
- [Agents in Jira Announcement](https://www.businesswire.com/news/home/20260224033792/en/)
- [Linear AI Workflows](https://linear.app/ai)

---

---

# EXTENSION: UNIFIED ATLASSIAN SDLC SKILL

## 9. BITBUCKET CLOUD INTEGRATION

### 9.1 Platform Overview

Bitbucket Cloud provides the SCM and CI/CD layer of the Atlassian ecosystem. Integration enables:

- **Pull Request Automation:** Create, update, approve, merge PRs programmatically
- **Pipeline Orchestration:** Trigger builds, deployments, and custom pipelines
- **Branch Management:** Create feature branches, enforce policies
- **Code Review Automation:** AI-assisted review comments, approval workflows
- **Deployment Tracking:** Environment-aware deployment status

### 9.2 API Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BITBUCKET CLOUD API 2.0                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Base URL: https://api.bitbucket.org/2.0/                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ REPOSITORIES                                                     │    │
│  │ /repositories/{workspace}/{repo_slug}                           │    │
│  │ ├── /src/{commit}/{path}     # Source browsing                  │    │
│  │ ├── /refs/branches           # Branch management                │    │
│  │ ├── /refs/tags               # Tag management                   │    │
│  │ ├── /commits                 # Commit history                   │    │
│  │ └── /diff/{spec}             # Diff generation                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PULL REQUESTS                                                    │    │
│  │ /repositories/{workspace}/{repo_slug}/pullrequests              │    │
│  │ ├── POST /                   # Create PR                        │    │
│  │ ├── GET /{id}                # Get PR details                   │    │
│  │ ├── PUT /{id}                # Update PR                        │    │
│  │ ├── POST /{id}/approve       # Approve PR                       │    │
│  │ ├── POST /{id}/merge         # Merge PR                         │    │
│  │ ├── GET /{id}/diff           # PR diff                          │    │
│  │ ├── GET /{id}/commits        # PR commits                       │    │
│  │ └── /comments                # PR comments                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PIPELINES                                                        │    │
│  │ /repositories/{workspace}/{repo_slug}/pipelines                 │    │
│  │ ├── POST /                   # Trigger pipeline                 │    │
│  │ ├── GET /{uuid}              # Pipeline status                  │    │
│  │ ├── GET /{uuid}/steps        # Pipeline steps                   │    │
│  │ └── POST /{uuid}/stopPipeline # Stop pipeline                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ DEPLOYMENTS                                                      │    │
│  │ /repositories/{workspace}/{repo_slug}/deployments               │    │
│  │ ├── GET /                    # List deployments                 │    │
│  │ ├── /environments            # Environment configs              │    │
│  │ └── /deployments_config      # Deployment variables             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Authentication (2025-2026 Changes)

**Critical Timeline:**

| Date | Change |
|------|--------|
| Sep 9, 2025 | New app passwords disabled |
| Jun 9, 2026 | All app passwords disabled |
| Ongoing | API tokens required |

**OAuth 2.0 for Bitbucket:**

```typescript
interface BitbucketOAuthConfig {
  clientId: string;
  clientSecret: string;
  // Scopes are defined on consumer, not per-request
  // Available scopes: repository, repository:write,
  // pullrequest, pullrequest:write, pipeline, pipeline:write
}

// Token exchange endpoint
const tokenUrl = 'https://bitbucket.org/site/oauth2/access_token';

// API authentication
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

**API Token (Alternative):**

```bash
# Using API token with email
curl -u "email@company.com:API_TOKEN" \
  https://api.bitbucket.org/2.0/repositories/{workspace}

# Git clone with token
git clone https://x-token-auth:{access_token}@bitbucket.org/workspace/repo.git
```

### 9.4 Bitbucket Module Capabilities

```typescript
// Pull Request Operations
interface BitbucketPROperations {
  create_pull_request(payload: {
    workspace: string;
    repo_slug: string;
    title: string;
    source_branch: string;
    destination_branch?: string;  // defaults to main
    description?: string;
    reviewers?: string[];         // account IDs
    close_source_branch?: boolean;
  }): Promise<PullRequest>;

  update_pull_request(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    changes: Partial<PullRequest>
  ): Promise<PullRequest>;

  add_pr_comment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    content: string,
    inline?: { path: string; line: number }
  ): Promise<Comment>;

  approve_pull_request(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<void>;

  merge_pull_request(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    options?: {
      merge_strategy?: 'merge_commit' | 'squash' | 'fast_forward';
      close_source_branch?: boolean;
      message?: string;
    }
  ): Promise<PullRequest>;

  get_pr_diff(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<string>;
}

// Pipeline Operations
interface BitbucketPipelineOperations {
  trigger_pipeline(payload: {
    workspace: string;
    repo_slug: string;
    target: {
      type: 'pipeline_ref_target' | 'pipeline_pullrequest_target';
      ref_type?: 'branch' | 'tag';
      ref_name?: string;
      selector?: { type: 'custom'; pattern: string };
      // For PR pipelines
      source?: string;
      destination?: string;
    };
    variables?: Array<{ key: string; value: string; secured?: boolean }>;
  }): Promise<Pipeline>;

  get_pipeline_status(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string
  ): Promise<Pipeline>;

  get_pipeline_steps(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string
  ): Promise<PipelineStep[]>;

  stop_pipeline(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string
  ): Promise<void>;

  wait_for_pipeline(
    workspace: string,
    repo_slug: string,
    pipeline_uuid: string,
    options?: { timeout_ms?: number; poll_interval_ms?: number }
  ): Promise<Pipeline>;
}

// Branch Operations
interface BitbucketBranchOperations {
  create_branch(
    workspace: string,
    repo_slug: string,
    name: string,
    target: string  // commit hash or branch name
  ): Promise<Branch>;

  delete_branch(
    workspace: string,
    repo_slug: string,
    name: string
  ): Promise<void>;

  list_branches(
    workspace: string,
    repo_slug: string,
    options?: { pattern?: string; sort?: string }
  ): Promise<Branch[]>;
}

// Deployment Operations
interface BitbucketDeploymentOperations {
  list_environments(
    workspace: string,
    repo_slug: string
  ): Promise<Environment[]>;

  get_deployment_status(
    workspace: string,
    repo_slug: string,
    environment_uuid: string
  ): Promise<Deployment>;

  set_deployment_variable(
    workspace: string,
    repo_slug: string,
    environment_uuid: string,
    key: string,
    value: string,
    secured?: boolean
  ): Promise<void>;
}
```

### 9.5 Jira-Bitbucket Integration Patterns

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    JIRA ↔ BITBUCKET WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. ISSUE → BRANCH                                                       │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Jira Issue: PROJ-123 "Add user authentication"              │     │
│     │                           │                                  │     │
│     │                           ▼                                  │     │
│     │ Auto-create branch: feature/PROJ-123-add-user-auth          │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  2. COMMITS → ISSUE UPDATES                                              │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Commit: "PROJ-123: Implement OAuth flow"                    │     │
│     │                           │                                  │     │
│     │                           ▼                                  │     │
│     │ Jira: Add development info, transition to "In Progress"     │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  3. PR → ISSUE TRANSITION                                                │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ PR Created for PROJ-123                                     │     │
│     │                           │                                  │     │
│     │                           ▼                                  │     │
│     │ Jira: Transition to "In Review", add PR link                │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  4. MERGE → DONE                                                         │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ PR Merged                                                    │     │
│     │                           │                                  │     │
│     │                           ▼                                  │     │
│     │ Jira: Transition to "Done", add resolution comment          │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  5. PIPELINE → DEPLOYMENT TRACKING                                       │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ Pipeline deploys to staging                                 │     │
│     │                           │                                  │     │
│     │                           ▼                                  │     │
│     │ Jira: Update deployment field, add environment label        │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.6 Example Tool Contracts

#### create_pull_request

```typescript
interface CreatePullRequestInput {
  /** Bitbucket workspace */
  workspace: string;

  /** Repository slug */
  repo_slug: string;

  /** PR title (will prepend Jira key if detected) */
  title: string;

  /** Source branch name */
  source_branch: string;

  /** Destination branch (default: main/master) */
  destination_branch?: string;

  /** PR description (markdown) */
  description?: string;

  /** Reviewer account IDs or emails */
  reviewers?: string[];

  /** Close source branch after merge */
  close_source_branch?: boolean;

  /** Jira issue key to link */
  jira_issue_key?: string;
}

interface CreatePullRequestOutput {
  success: boolean;
  pull_request: {
    id: number;
    title: string;
    url: string;
    source_branch: string;
    destination_branch: string;
    state: 'OPEN' | 'MERGED' | 'DECLINED';
    author: string;
    created_on: string;
  };
  jira_updated?: boolean;
  jira_transition?: string;
}

// Example usage in Claude Code session
const pr = await bitbucket.create_pull_request({
  workspace: "hln",
  repo_slug: "core-api",
  title: "PROJ-123: Implement OAuth 2.0 token refresh",
  source_branch: "feature/PROJ-123-oauth-refresh",
  description: `## Summary
Implements automatic token refresh for Jira API integration.

## Changes
- Add token refresh logic in \`src/auth/oauth.ts\`
- Update token storage with expiry tracking
- Add retry logic for 401 responses

## Testing
- Unit tests added for refresh flow
- Integration tests with mock Jira API

## Jira
Resolves PROJ-123`,
  reviewers: ["5f3abc123"],
  close_source_branch: true,
  jira_issue_key: "PROJ-123"
});
```

#### trigger_pipeline

```typescript
interface TriggerPipelineInput {
  /** Bitbucket workspace */
  workspace: string;

  /** Repository slug */
  repo_slug: string;

  /** Branch or tag to run pipeline on */
  ref_name: string;

  /** Pipeline selector (custom pipeline name) */
  pipeline_name?: string;

  /** Pipeline variables */
  variables?: Record<string, string>;

  /** Wait for completion */
  wait?: boolean;

  /** Timeout in ms (if waiting) */
  timeout_ms?: number;
}

interface TriggerPipelineOutput {
  success: boolean;
  pipeline: {
    uuid: string;
    build_number: number;
    state: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    result?: 'SUCCESSFUL' | 'FAILED' | 'STOPPED';
    url: string;
    duration_seconds?: number;
  };
  steps?: Array<{
    name: string;
    state: string;
    result?: string;
  }>;
}
```

---

## 10. CONFLUENCE CLOUD INTEGRATION

### 10.1 Platform Overview

Confluence provides the documentation layer. Integration enables:

- **Auto-Generated Documentation:** README sync, API docs, changelogs
- **Decision Records:** Capture architectural decisions from sessions
- **Runbooks:** Generate operational documentation from code
- **Release Notes:** Auto-generate from Jira releases
- **Session Transcripts:** Archive Claude Code sessions as knowledge

### 10.2 API Architecture (REST v2)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONFLUENCE CLOUD REST API v2                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Base URL: https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PAGES                                                            │    │
│  │ /pages                                                           │    │
│  │ ├── POST /                   # Create page                      │    │
│  │ ├── GET /{id}                # Get page                         │    │
│  │ ├── PUT /{id}                # Update page                      │    │
│  │ ├── DELETE /{id}             # Delete page                      │    │
│  │ ├── GET /{id}/children       # Child pages                      │    │
│  │ └── GET /{id}/versions       # Version history                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ SPACES                                                           │    │
│  │ /spaces                                                          │    │
│  │ ├── GET /                    # List spaces                      │    │
│  │ ├── GET /{id}                # Get space                        │    │
│  │ └── GET /{id}/pages          # Space pages                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ CONTENT                                                          │    │
│  │ /content                                                         │    │
│  │ ├── /{id}/labels             # Page labels                      │    │
│  │ ├── /{id}/properties         # Page properties                  │    │
│  │ └── /search                  # Content search (CQL)             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Performance: v2 API is up to 30x faster for bulk operations            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Content Format

Confluence uses **Atlassian Document Format (ADF)** - same as Jira:

```typescript
interface ConfluencePageBody {
  representation: 'atlas_doc_format' | 'storage' | 'wiki';
  value: string;  // ADF JSON string or storage format XML
}

// ADF Example
const adfDocument = {
  version: 1,
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Page Title' }]
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Content here...' }]
    },
    {
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [{ type: 'text', text: 'const x = 1;' }]
    }
  ]
};
```

### 10.4 OAuth Scopes for Confluence

```yaml
# Read Operations
read:confluence-content.all    # Read all content
read:confluence-content.summary # Read summaries only
read:confluence-space.summary   # Read space info
read:confluence-user            # Read user info

# Write Operations
write:confluence-content        # Create/update content
write:confluence-space          # Create/update spaces
write:confluence-file           # Upload attachments

# Admin Operations
manage:confluence-configuration # Space settings
```

### 10.5 Confluence Module Capabilities

```typescript
interface ConfluenceOperations {
  // Page Operations
  create_page(payload: {
    space_id: string;
    title: string;
    body: string;           // Markdown - converted to ADF
    parent_id?: string;     // For nested pages
    status?: 'current' | 'draft';
  }): Promise<Page>;

  update_page(
    page_id: string,
    payload: {
      title?: string;
      body?: string;
      version_message?: string;
    }
  ): Promise<Page>;

  get_page(
    page_id: string,
    options?: {
      body_format?: 'atlas_doc_format' | 'storage' | 'view';
      include_version?: boolean;
    }
  ): Promise<Page>;

  search_pages(
    cql: string,  // Confluence Query Language
    options?: { limit?: number; space_key?: string }
  ): Promise<Page[]>;

  // Sync Operations
  sync_readme_to_confluence(
    repo_path: string,
    space_id: string,
    parent_id?: string
  ): Promise<SyncResult>;

  sync_directory_to_confluence(
    local_path: string,
    space_id: string,
    options?: {
      file_patterns?: string[];
      parent_id?: string;
      recursive?: boolean;
    }
  ): Promise<SyncResult>;

  // Session Archive
  archive_session_transcript(
    session_id: string,
    transcript_path: string,
    space_id: string,
    options?: {
      summarize?: boolean;
      include_tool_calls?: boolean;
      parent_page_id?: string;
    }
  ): Promise<Page>;
}
```

### 10.6 Auto-Sync Patterns

#### README → Confluence Sync

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    README AUTO-SYNC WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐       ┌─────────────────┐       ┌──────────────┐   │
│  │   README.md     │       │  Claude Code    │       │  Confluence  │   │
│  │   (Git repo)    │──────►│  PostToolUse    │──────►│  Page        │   │
│  │                 │       │  Hook           │       │              │   │
│  └─────────────────┘       └─────────────────┘       └──────────────┘   │
│                                                                          │
│  Trigger: File edit detected on README.md or docs/**                     │
│                                                                          │
│  Process:                                                                │
│  1. Hook detects Write/Edit on documentation files                       │
│  2. Parse markdown content                                               │
│  3. Convert to ADF format                                                │
│  4. Find or create corresponding Confluence page                         │
│  5. Update page with new content                                         │
│  6. Add version comment with commit context                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Session → Knowledge Base Archive

```typescript
// Hook handler for SessionEnd
async function archiveSessionToConfluence(
  sessionId: string,
  transcriptPath: string
): Promise<void> {
  const transcript = await parseTranscript(transcriptPath);

  // Generate session summary
  const summary = await generateSessionSummary(transcript);

  // Create Confluence page
  const page = await confluence.create_page({
    space_id: ENGINEERING_SPACE_ID,
    title: `Session: ${summary.title} - ${formatDate(new Date())}`,
    body: `
## Session Summary
${summary.overview}

## Key Decisions
${summary.decisions.map(d => `- ${d}`).join('\n')}

## Files Modified
${summary.filesModified.map(f => `- \`${f}\``).join('\n')}

## Tools Used
${summary.toolsUsed.map(t => `- ${t.name}: ${t.count} times`).join('\n')}

## Issues Referenced
${summary.jiraIssues.map(i => `- [${i}](${JIRA_URL}/browse/${i})`).join('\n')}

---

<details>
<summary>Full Transcript</summary>

\`\`\`
${transcript.raw}
\`\`\`

</details>
`,
    parent_id: SESSION_ARCHIVE_PARENT_ID
  });

  // Link to Jira issues mentioned
  for (const issueKey of summary.jiraIssues) {
    await jira.add_comment(issueKey,
      `Session archived: [View in Confluence](${page.url})`
    );
  }
}
```

---

## 11. SESSION ARTIFACT CAPTURE SYSTEM

### 11.1 Architecture Overview

The Session Artifact Capture System transforms ephemeral Claude Code sessions into persistent, searchable engineering artifacts.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SESSION ARTIFACT CAPTURE SYSTEM                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CLAUDE CODE SESSION                           │    │
│  │                                                                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │    │
│  │  │ User     │  │ Claude   │  │ Tool     │  │ Tool         │     │    │
│  │  │ Prompts  │  │ Response │  │ Calls    │  │ Results      │     │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘     │    │
│  │       │             │             │               │              │    │
│  │       ▼             ▼             ▼               ▼              │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │              TRANSCRIPT.JSONL                            │    │    │
│  │  │  (Persistent session log)                                │    │    │
│  │  └────────────────────────┬────────────────────────────────┘    │    │
│  └───────────────────────────┼─────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    HOOK EVENT STREAM                             │    │
│  │                                                                  │    │
│  │  SessionStart ──► UserPromptSubmit ──► PreToolUse ──►           │    │
│  │  PostToolUse ──► Stop ──► ... ──► SessionEnd                    │    │
│  │                                                                  │    │
│  └────────────────────────┬─────────────────────────────────────────┘    │
│                           │                                              │
│                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                 ARTIFACT PROCESSOR                               │    │
│  │                                                                  │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │    │
│  │  │ Real-time     │  │ Session-end   │  │ Scheduled         │    │    │
│  │  │ Streaming     │  │ Summary       │  │ Aggregation       │    │    │
│  │  │ (PostToolUse) │  │ (SessionEnd)  │  │ (Daily/Sprint)    │    │    │
│  │  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘    │    │
│  │          │                  │                    │               │    │
│  └──────────┼──────────────────┼────────────────────┼───────────────┘    │
│             │                  │                    │                    │
│             ▼                  ▼                    ▼                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ATLASSIAN DESTINATIONS                        │    │
│  │                                                                  │    │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐      │    │
│  │  │    JIRA     │    │  BITBUCKET  │    │   CONFLUENCE    │      │    │
│  │  │             │    │             │    │                 │      │    │
│  │  │ • Comments  │    │ • PR Desc   │    │ • Session Pages │      │    │
│  │  │ • Labels    │    │ • Comments  │    │ • Doc Updates   │      │    │
│  │  │ • Worklogs  │    │ • Commits   │    │ • Changelogs    │      │    │
│  │  │ • Transitions│   │ • Pipelines │    │ • Decisions     │      │    │
│  │  └─────────────┘    └─────────────┘    └─────────────────┘      │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Hook Configuration for Full Capture

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/session-init.sh",
            "timeout": 10000
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/log-activity.sh",
            "timeout": 5000,
            "async": true
          }
        ]
      }
    ],

    "PostToolUseFailure": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/log-failure.sh",
            "timeout": 5000,
            "async": true
          }
        ]
      }
    ],

    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/session-summary.sh",
            "timeout": 120000
          }
        ]
      }
    ]
  }
}
```

### 11.3 Transcript Parser

```typescript
// lib/transcript-parser.ts

interface TranscriptEntry {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system';
  timestamp?: string;
  content?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
}

interface ParsedSession {
  sessionId: string;
  startTime: Date;
  endTime?: Date;

  // Aggregated data
  userPrompts: string[];
  toolCalls: Array<{
    name: string;
    input: unknown;
    output: unknown;
    success: boolean;
    timestamp: string;
  }>;
  filesModified: string[];
  filesRead: string[];
  commandsExecuted: string[];
  errors: string[];

  // Inferred context
  jiraIssues: string[];      // Extracted from prompts/commits
  gitBranches: string[];     // From git commands
  testResults: Array<{ passed: number; failed: number; }>;
}

export async function parseTranscript(path: string): Promise<ParsedSession> {
  const lines = await readLines(path);
  const session: ParsedSession = {
    sessionId: extractSessionId(path),
    startTime: new Date(),
    userPrompts: [],
    toolCalls: [],
    filesModified: [],
    filesRead: [],
    commandsExecuted: [],
    errors: [],
    jiraIssues: [],
    gitBranches: [],
    testResults: []
  };

  for (const line of lines) {
    const entry: TranscriptEntry = JSON.parse(line);

    switch (entry.type) {
      case 'user':
        session.userPrompts.push(entry.content || '');
        session.jiraIssues.push(...extractJiraKeys(entry.content || ''));
        break;

      case 'tool_use':
        const toolCall = {
          name: entry.tool_name!,
          input: entry.tool_input,
          output: null,
          success: true,
          timestamp: entry.timestamp || new Date().toISOString()
        };

        // Track file operations
        if (entry.tool_name === 'Write' || entry.tool_name === 'Edit') {
          session.filesModified.push((entry.tool_input as any).file_path);
        }
        if (entry.tool_name === 'Read') {
          session.filesRead.push((entry.tool_input as any).file_path);
        }
        if (entry.tool_name === 'Bash') {
          session.commandsExecuted.push((entry.tool_input as any).command);
        }

        session.toolCalls.push(toolCall);
        break;

      case 'tool_result':
        // Associate with last tool call
        const lastTool = session.toolCalls[session.toolCalls.length - 1];
        if (lastTool) {
          lastTool.output = entry.content;
          lastTool.success = !entry.content?.includes('Error');
        }
        break;
    }
  }

  return session;
}

function extractJiraKeys(text: string): string[] {
  const pattern = /[A-Z][A-Z0-9]+-\d+/g;
  return [...new Set(text.match(pattern) || [])];
}
```

### 11.4 Real-Time Activity Logger

```bash
#!/bin/bash
# .claude/hooks/log-activity.sh

set -e

INPUT=$(cat)

# Parse hook input
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')
CWD=$(echo "$INPUT" | jq -r '.cwd')
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Extract Jira issue from context (branch name, recent files, etc.)
JIRA_ISSUE=""
if [[ -d "$CWD/.git" ]]; then
  BRANCH=$(git -C "$CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [[ "$BRANCH" =~ ([A-Z][A-Z0-9]+-[0-9]+) ]]; then
    JIRA_ISSUE="${BASH_REMATCH[1]}"
  fi
fi

# Build activity payload
PAYLOAD=$(jq -n \
  --arg session "$SESSION_ID" \
  --arg tool "$TOOL_NAME" \
  --arg timestamp "$TIMESTAMP" \
  --arg cwd "$CWD" \
  --arg jira "$JIRA_ISSUE" \
  --argjson input "$TOOL_INPUT" \
  '{
    sessionId: $session,
    tool: $tool,
    timestamp: $timestamp,
    workingDirectory: $cwd,
    jiraIssue: $jira,
    toolInput: $input
  }')

# Send to activity log endpoint (async)
if [[ -n "$JIRA_ISSUE" && -n "$JIRA_API_TOKEN" ]]; then
  # Add work log entry to Jira
  WORK_DESCRIPTION="[Claude Code] $TOOL_NAME operation"

  case "$TOOL_NAME" in
    Write|Edit)
      FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // .file')
      WORK_DESCRIPTION="[Claude Code] Modified: ${FILE_PATH##*/}"
      ;;
    Bash)
      COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command' | head -c 100)
      WORK_DESCRIPTION="[Claude Code] Executed: $COMMAND"
      ;;
  esac

  # Queue for batch update (don't spam Jira)
  echo "$PAYLOAD" >> "/tmp/claude-jira-queue-$SESSION_ID.jsonl"
fi

exit 0
```

### 11.5 Session Summary Generator

```bash
#!/bin/bash
# .claude/hooks/session-summary.sh

set -e

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')
END_REASON=$(echo "$INPUT" | jq -r '.reason')

# Check if transcript exists
if [[ ! -f "$TRANSCRIPT_PATH" ]]; then
  echo "No transcript found at $TRANSCRIPT_PATH" >&2
  exit 0
fi

# Parse transcript for summary
TOOL_CALLS=$(cat "$TRANSCRIPT_PATH" | jq -s '[.[] | select(.type == "tool_use") | .tool_name] | group_by(.) | map({tool: .[0], count: length})')
FILES_MODIFIED=$(cat "$TRANSCRIPT_PATH" | jq -s '[.[] | select(.type == "tool_use" and (.tool_name == "Write" or .tool_name == "Edit")) | .tool_input.file_path] | unique')
COMMANDS=$(cat "$TRANSCRIPT_PATH" | jq -s '[.[] | select(.type == "tool_use" and .tool_name == "Bash") | .tool_input.command] | unique | .[:10]')

# Extract Jira issues mentioned
JIRA_ISSUES=$(cat "$TRANSCRIPT_PATH" | jq -rs 'map(select(.content) | .content) | join(" ")' | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | sort -u)

# Generate summary
SUMMARY=$(cat <<EOF
## Claude Code Session Summary

**Session ID:** $SESSION_ID
**End Reason:** $END_REASON
**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

### Tool Usage
$(echo "$TOOL_CALLS" | jq -r '.[] | "- \(.tool): \(.count) calls"')

### Files Modified
$(echo "$FILES_MODIFIED" | jq -r '.[] | "- `\(.)`"')

### Commands Executed
$(echo "$COMMANDS" | jq -r '.[] | "- `\(.)`"')

---
*Generated automatically by Claude Code Session Capture*
EOF
)

# Update Jira issues with session summary
if [[ -n "$JIRA_ISSUES" && -n "$JIRA_API_TOKEN" ]]; then
  for ISSUE in $JIRA_ISSUES; do
    curl -s -X POST \
      -H "Authorization: Bearer $JIRA_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg body "$SUMMARY" '{body: {type: "doc", version: 1, content: [{type: "paragraph", content: [{type: "text", text: $body}]}]}}')" \
      "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$ISSUE/comment" \
      > /dev/null 2>&1 || true
  done
fi

# Archive to Confluence if configured
if [[ -n "$CONFLUENCE_SPACE_ID" && -n "$CONFLUENCE_API_TOKEN" ]]; then
  # Create session archive page
  curl -s -X POST \
    -H "Authorization: Bearer $CONFLUENCE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg space "$CONFLUENCE_SPACE_ID" \
      --arg title "Session $SESSION_ID - $(date +%Y-%m-%d)" \
      --arg body "$SUMMARY" \
      '{
        spaceId: $space,
        status: "current",
        title: $title,
        body: {
          representation: "storage",
          value: ("<h1>Session Summary</h1><pre>" + $body + "</pre>")
        }
      }')" \
    "https://api.atlassian.com/ex/confluence/$CONFLUENCE_CLOUD_ID/wiki/api/v2/pages" \
    > /dev/null 2>&1 || true
fi

exit 0
```

---

## 12. UNIFIED ATLASSIAN SKILL ARCHITECTURE

### 12.1 Consolidated Structure

```
atlassian-skill/
├── SKILL.md                          # Unified entry point
├── .env.template                     # Combined environment config
├── package.json
├── tsconfig.json
│
├── src/
│   ├── index.ts                      # Main exports
│   │
│   ├── core/
│   │   ├── client.ts                 # Unified AtlassianClient
│   │   ├── auth.ts                   # Shared OAuth manager
│   │   ├── rate-limiter.ts           # Cross-product rate limiting
│   │   └── adf-builder.ts            # Atlassian Document Format
│   │
│   ├── jira/
│   │   ├── reader.ts
│   │   ├── writer.ts
│   │   ├── sprint-planner.ts
│   │   ├── issue-generator.ts
│   │   └── workflow-engine.ts
│   │
│   ├── bitbucket/
│   │   ├── repository.ts
│   │   ├── pull-requests.ts
│   │   ├── pipelines.ts
│   │   └── deployments.ts
│   │
│   ├── confluence/
│   │   ├── pages.ts
│   │   ├── spaces.ts
│   │   ├── sync.ts                   # README/doc sync
│   │   └── archive.ts                # Session archival
│   │
│   ├── session/
│   │   ├── capture.ts                # Session artifact capture
│   │   ├── transcript-parser.ts
│   │   └── summary-generator.ts
│   │
│   ├── orchestration/
│   │   ├── sdlc-workflow.ts          # Full SDLC automation
│   │   ├── cross-product-sync.ts     # Jira↔BB↔Confluence sync
│   │   └── event-handlers.ts         # Webhook/hook handlers
│   │
│   └── conventions/
│       ├── hln-labels.ts
│       ├── hln-templates.ts
│       └── hln-workflows.ts
│
├── hooks/
│   ├── session-init.sh
│   ├── log-activity.sh
│   ├── log-failure.sh
│   ├── session-summary.sh
│   └── hooks.json                    # Hook configuration
│
├── reference/
│   ├── jira-api.md
│   ├── bitbucket-api.md
│   ├── confluence-api.md
│   └── hln-conventions.md
│
└── tests/
    ├── jira/
    ├── bitbucket/
    ├── confluence/
    └── integration/
```

### 12.2 Unified SKILL.md

```yaml
---
name: atlassian
description: |
  Unified Atlassian integration for full SDLC automation.

  Capabilities:
  - JIRA: Issue management, sprints, workflows, labels
  - BITBUCKET: PRs, pipelines, deployments, branches
  - CONFLUENCE: Documentation sync, session archival
  - SESSION: Automatic activity capture and logging

  Use for: Any Atlassian operations, PR workflows,
  documentation updates, or engineering automation.

argument-hint: [product] [command] [options...]

disable-model-invocation: false
user-invocable: true

allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(curl https://api.atlassian.com/*)
  - Bash(curl https://api.bitbucket.org/*)
  - Bash(git *)
  - Bash(jq *)

model: claude-opus-4-5
context: fork
agent: general-purpose

hooks:
  PostToolUse:
    - matcher: "Write|Edit|Bash"
      hooks:
        - type: command
          command: "${CLAUDE_SKILL_DIR}/hooks/log-activity.sh"
          async: true
          timeout: 5000
---

# Atlassian Unified Skill

## Quick Commands

### Jira
- `/atlassian jira issue create <project> <summary>`
- `/atlassian jira issue search <jql>`
- `/atlassian jira sprint current`
- `/atlassian jira standup`

### Bitbucket
- `/atlassian bb pr create [--title <title>]`
- `/atlassian bb pr merge <pr-id>`
- `/atlassian bb pipeline run [--branch <branch>]`
- `/atlassian bb pipeline status <uuid>`

### Confluence
- `/atlassian confluence sync-readme`
- `/atlassian confluence create-page <title>`
- `/atlassian confluence archive-session`

### Cross-Product
- `/atlassian workflow start-feature <jira-key>`
- `/atlassian workflow complete-feature <jira-key>`
- `/atlassian workflow release <version>`

## SDLC Automation

The skill automatically:
1. Links Jira issues to branches and PRs
2. Transitions Jira on PR events
3. Updates Confluence docs on file changes
4. Logs all activity to Jira work logs
5. Archives sessions to Confluence

See [reference/hln-conventions.md](reference/hln-conventions.md) for standards.
```

### 12.3 Unified OAuth Configuration

```typescript
// src/core/auth.ts

interface AtlassianAuthConfig {
  // Shared OAuth credentials (single app registration)
  clientId: string;
  clientSecret: string;
  redirectUri: string;

  // Cloud identifiers
  jiraCloudId: string;
  confluenceCloudId: string;  // Often same as Jira
  bitbucketWorkspace: string;

  // Token storage
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// Combined scopes for full SDLC access
const UNIFIED_SCOPES = [
  // Jira
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'read:sprint:jira-software',
  'write:sprint:jira-software',

  // Confluence
  'read:confluence-content.all',
  'write:confluence-content',
  'read:confluence-space.summary',

  // Bitbucket (separate OAuth flow required)
  // Scopes defined on Bitbucket consumer
].join(' ');

export class UnifiedAtlassianAuth {
  private jiraAuth: JiraOAuthManager;
  private bitbucketAuth: BitbucketOAuthManager;

  async getJiraHeaders(): Promise<Headers> {
    return {
      'Authorization': `Bearer ${await this.jiraAuth.getAccessToken()}`,
      'Content-Type': 'application/json'
    };
  }

  async getBitbucketHeaders(): Promise<Headers> {
    return {
      'Authorization': `Bearer ${await this.bitbucketAuth.getAccessToken()}`,
      'Content-Type': 'application/json'
    };
  }

  // Confluence uses same token as Jira (same Atlassian Cloud)
  async getConfluenceHeaders(): Promise<Headers> {
    return this.getJiraHeaders();
  }
}
```

### 12.4 Cross-Product Orchestration

```typescript
// src/orchestration/sdlc-workflow.ts

export class SDLCWorkflow {
  constructor(
    private jira: JiraClient,
    private bitbucket: BitbucketClient,
    private confluence: ConfluenceClient,
    private session: SessionCapture
  ) {}

  /**
   * Start Feature Workflow
   * 1. Fetch Jira issue details
   * 2. Create feature branch
   * 3. Transition Jira to "In Progress"
   * 4. Log session start
   */
  async startFeature(issueKey: string): Promise<FeatureContext> {
    // Get issue details
    const issue = await this.jira.getIssue(issueKey);

    // Generate branch name
    const branchName = this.generateBranchName(issue);

    // Create branch in Bitbucket
    await this.bitbucket.createBranch(
      this.config.workspace,
      this.config.repoSlug,
      branchName,
      'main'
    );

    // Transition Jira
    await this.jira.transitionIssue(issueKey, 'In Progress');

    // Add label
    await this.jira.applyLabels(issueKey, ['in-development']);

    // Log to session
    await this.session.log({
      event: 'feature_started',
      issueKey,
      branch: branchName,
      timestamp: new Date()
    });

    return {
      issue,
      branch: branchName,
      startedAt: new Date()
    };
  }

  /**
   * Complete Feature Workflow
   * 1. Create PR with context
   * 2. Link PR to Jira
   * 3. Transition Jira to "In Review"
   * 4. Update Confluence docs
   * 5. Generate summary
   */
  async completeFeature(issueKey: string): Promise<CompletionResult> {
    const issue = await this.jira.getIssue(issueKey);
    const branch = await this.getCurrentBranch();

    // Generate PR description from session
    const sessionSummary = await this.session.generateSummary();
    const prDescription = this.generatePRDescription(issue, sessionSummary);

    // Create PR
    const pr = await this.bitbucket.createPullRequest({
      workspace: this.config.workspace,
      repo_slug: this.config.repoSlug,
      title: `${issueKey}: ${issue.fields.summary}`,
      source_branch: branch,
      description: prDescription,
      reviewers: await this.getDefaultReviewers(),
      close_source_branch: true
    });

    // Update Jira
    await this.jira.transitionIssue(issueKey, 'In Review');
    await this.jira.applyLabels(issueKey, ['in-review'], 'add');
    await this.jira.applyLabels(issueKey, ['in-development'], 'remove');
    await this.jira.addComment(issueKey,
      `PR created: [${pr.title}](${pr.url})\n\n${sessionSummary.brief}`
    );

    // Sync documentation if README changed
    if (sessionSummary.filesModified.some(f => f.includes('README'))) {
      await this.confluence.syncReadme(
        this.config.repoPath,
        this.config.confluenceSpaceId
      );
    }

    // Archive session
    await this.confluence.archiveSession(
      this.session.sessionId,
      this.session.transcriptPath,
      this.config.confluenceSpaceId
    );

    return {
      pullRequest: pr,
      jiraTransition: 'In Review',
      confluenceUpdated: true,
      sessionArchived: true
    };
  }

  /**
   * Release Workflow
   * 1. Gather all issues in version
   * 2. Generate changelog
   * 3. Create release PR
   * 4. Trigger deployment pipeline
   * 5. Update Jira version
   * 6. Publish Confluence release notes
   */
  async release(version: string): Promise<ReleaseResult> {
    // Get issues in version
    const issues = await this.jira.searchIssues(
      `fixVersion = "${version}" AND status = Done`
    );

    // Generate changelog
    const changelog = await this.generateChangelog(issues);

    // Create release branch and PR
    const releaseBranch = `release/${version}`;
    await this.bitbucket.createBranch(
      this.config.workspace,
      this.config.repoSlug,
      releaseBranch,
      'develop'
    );

    // Update version files
    await this.updateVersionFiles(version);

    // Create release PR
    const pr = await this.bitbucket.createPullRequest({
      workspace: this.config.workspace,
      repo_slug: this.config.repoSlug,
      title: `Release ${version}`,
      source_branch: releaseBranch,
      destination_branch: 'main',
      description: changelog
    });

    // Trigger deployment pipeline
    const pipeline = await this.bitbucket.triggerPipeline({
      workspace: this.config.workspace,
      repo_slug: this.config.repoSlug,
      ref_name: releaseBranch,
      pipeline_name: 'release',
      variables: { VERSION: version }
    });

    // Release Jira version
    await this.jira.releaseVersion(version);

    // Publish release notes to Confluence
    await this.confluence.createPage({
      space_id: this.config.confluenceSpaceId,
      title: `Release Notes - ${version}`,
      body: changelog,
      parent_id: this.config.releaseNotesParentId
    });

    return {
      version,
      pullRequest: pr,
      pipeline,
      issueCount: issues.length,
      changelogPublished: true
    };
  }
}
```

---

## 13. UPDATED ROADMAP

### 13.1 Revised Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED ATLASSIAN SKILL ROADMAP                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Foundation                                                     │
│  ════════════════════                                                    │
│  ├─ Unified OAuth architecture                                           │
│  ├─ Core Jira operations (read/write)                                   │
│  ├─ Session capture hooks (basic)                                        │
│  └─ Deliverable: Working Jira + session logging                         │
│                                                                          │
│  PHASE 2: Bitbucket Integration                                          │
│  ══════════════════════════════                                          │
│  ├─ PR operations (create, update, merge)                               │
│  ├─ Pipeline triggering and monitoring                                   │
│  ├─ Jira ↔ Bitbucket linking                                            │
│  └─ Deliverable: Jira-linked PR automation                              │
│                                                                          │
│  PHASE 3: Confluence + Session Archival                                  │
│  ═══════════════════════════════════════                                 │
│  ├─ Page create/update operations                                        │
│  ├─ README auto-sync                                                     │
│  ├─ Session transcript archival                                          │
│  └─ Deliverable: Self-documenting engineering                           │
│                                                                          │
│  PHASE 4: SDLC Orchestration                                             │
│  ═══════════════════════════                                             │
│  ├─ Cross-product workflows                                              │
│  ├─ Feature start/complete automation                                    │
│  ├─ Release workflow automation                                          │
│  └─ Deliverable: End-to-end SDLC automation                             │
│                                                                          │
│  PHASE 5: Aria/Axis + Autonomous Engineering                             │
│  ═══════════════════════════════════════════                             │
│  ├─ Multi-agent capability sharing                                       │
│  ├─ Predictive planning                                                  │
│  ├─ Autonomous triage and assignment                                     │
│  └─ Deliverable: Self-driving engineering ops                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Phase Dependencies

```
Phase 1 ──────┬──────► Phase 2 ──────┬──────► Phase 4
(Jira Core)   │       (Bitbucket)    │       (SDLC)
              │                      │           │
              └──────► Phase 3 ──────┘           │
                      (Confluence)               │
                                                 │
                                                 ▼
                                            Phase 5
                                            (Autonomous)
```

---

## 14. ADDITIONAL RISKS

### 14.1 Multi-Product Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Bitbucket OAuth separate from Jira** | Certain | Medium | Implement dual OAuth flow |
| **Rate limits across 3 products** | High | High | Unified rate limit tracking |
| **ADF format inconsistencies** | Medium | Medium | Shared ADF builder with tests |
| **Session capture performance** | Medium | Medium | Async hooks, batching |
| **Transcript size in long sessions** | High | Low | Streaming parser, summarization |

### 14.2 Session Capture Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Hook failures silently ignored** | Medium | Medium | Health monitoring, alerts |
| **Sensitive data in transcripts** | Medium | High | Content filtering, redaction |
| **Storage costs for archives** | Low | Low | Retention policies, compression |
| **Confluence page sprawl** | Medium | Low | Organized hierarchy, cleanup jobs |

---

## APPENDIX D: BITBUCKET API ENDPOINT REFERENCE

```
Bitbucket Cloud REST API 2.0 Base: https://api.bitbucket.org/2.0

Repositories:
  GET    /repositories/{workspace}/{repo_slug}
  GET    /repositories/{workspace}/{repo_slug}/src/{commit}/{path}
  GET    /repositories/{workspace}/{repo_slug}/refs/branches
  POST   /repositories/{workspace}/{repo_slug}/refs/branches
  DELETE /repositories/{workspace}/{repo_slug}/refs/branches/{name}

Pull Requests:
  GET    /repositories/{workspace}/{repo_slug}/pullrequests
  POST   /repositories/{workspace}/{repo_slug}/pullrequests
  GET    /repositories/{workspace}/{repo_slug}/pullrequests/{id}
  PUT    /repositories/{workspace}/{repo_slug}/pullrequests/{id}
  POST   /repositories/{workspace}/{repo_slug}/pullrequests/{id}/approve
  DELETE /repositories/{workspace}/{repo_slug}/pullrequests/{id}/approve
  POST   /repositories/{workspace}/{repo_slug}/pullrequests/{id}/merge
  GET    /repositories/{workspace}/{repo_slug}/pullrequests/{id}/diff
  GET    /repositories/{workspace}/{repo_slug}/pullrequests/{id}/commits
  GET    /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments
  POST   /repositories/{workspace}/{repo_slug}/pullrequests/{id}/comments

Pipelines:
  GET    /repositories/{workspace}/{repo_slug}/pipelines
  POST   /repositories/{workspace}/{repo_slug}/pipelines
  GET    /repositories/{workspace}/{repo_slug}/pipelines/{uuid}
  POST   /repositories/{workspace}/{repo_slug}/pipelines/{uuid}/stopPipeline
  GET    /repositories/{workspace}/{repo_slug}/pipelines/{uuid}/steps
  GET    /repositories/{workspace}/{repo_slug}/pipelines/{uuid}/steps/{step_uuid}/logs

Deployments:
  GET    /repositories/{workspace}/{repo_slug}/deployments
  GET    /repositories/{workspace}/{repo_slug}/environments
  GET    /repositories/{workspace}/{repo_slug}/deployments_config/environments/{uuid}/variables
  POST   /repositories/{workspace}/{repo_slug}/deployments_config/environments/{uuid}/variables
```

---

## APPENDIX E: CONFLUENCE API ENDPOINT REFERENCE

```
Confluence Cloud REST API v2 Base: https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2

Pages:
  GET    /pages
  POST   /pages
  GET    /pages/{id}
  PUT    /pages/{id}
  DELETE /pages/{id}
  GET    /pages/{id}/children
  GET    /pages/{id}/versions

Spaces:
  GET    /spaces
  GET    /spaces/{id}
  GET    /spaces/{id}/pages

Content (v1 - still useful):
  GET    /content
  POST   /content
  GET    /content/{id}
  PUT    /content/{id}
  GET    /content/search?cql={query}
  GET    /content/{id}/label
  POST   /content/{id}/label
```

---

## APPENDIX F: ENVIRONMENT TEMPLATE (UNIFIED)

```bash
# .env.template - Unified Atlassian Skill

# ============================================
# ATLASSIAN CLOUD IDENTIFIERS
# ============================================
ATLASSIAN_CLOUD_ID=                    # Jira + Confluence cloud ID
BITBUCKET_WORKSPACE=                   # Bitbucket workspace name

# ============================================
# JIRA + CONFLUENCE OAUTH
# ============================================
ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=
ATLASSIAN_REDIRECT_URI=http://localhost:3000/callback
ATLASSIAN_ACCESS_TOKEN=
ATLASSIAN_REFRESH_TOKEN=

# ============================================
# BITBUCKET OAUTH (Separate consumer)
# ============================================
BITBUCKET_CLIENT_ID=
BITBUCKET_CLIENT_SECRET=
BITBUCKET_ACCESS_TOKEN=
BITBUCKET_REFRESH_TOKEN=

# ============================================
# DEFAULT RESOURCES
# ============================================
JIRA_DEFAULT_PROJECT=HLN
BITBUCKET_DEFAULT_REPO=core-api
CONFLUENCE_SPACE_ID=
CONFLUENCE_SESSION_ARCHIVE_PARENT_ID=
CONFLUENCE_RELEASE_NOTES_PARENT_ID=

# ============================================
# SESSION CAPTURE
# ============================================
SESSION_CAPTURE_ENABLED=true
SESSION_ARCHIVE_TO_CONFLUENCE=true
SESSION_LOG_TO_JIRA=true
SESSION_ASYNC_BATCH_SIZE=10
SESSION_ASYNC_BATCH_INTERVAL_MS=5000

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_STRATEGY=conservative
MAX_RETRIES=5
RETRY_BASE_DELAY_MS=1000

# ============================================
# LOGGING
# ============================================
LOG_LEVEL=info
AUDIT_ENABLED=true
AUDIT_LOG_PATH=./logs/atlassian-audit.log
```

---

**Document Control:**
- Version: 2.0
- Last Updated: 2026-03-05
- Review Cycle: Quarterly
- Owner: HLN Engineering Systems
