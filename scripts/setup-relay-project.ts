/**
 * Setup HLN Relay Jira Project
 * Creates the RELAY project, 6 epics, and all 27 stories across 4 sprints.
 *
 * HLN Relay: AI-powered assessment platform with real-time collaboration
 * via Nexus Flow WebSocket engine and ARIA AXIS agent integration.
 *
 * Usage: npx tsx scripts/setup-relay-project.ts
 */

import 'dotenv/config';
import { createJiraClientFromEnv } from '../src/jira/client.js';
import { adf, text } from '../src/core/adf-builder.js';
import type { AdfDocument } from '../src/core/types.js';

const jira = createJiraClientFromEnv();

// ============================================================================
// Helpers
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createIssueWithRetry(
  input: Parameters<typeof jira.createIssue>[0],
  label: string,
  retries = 3,
): Promise<{ id: string; key: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await jira.createIssue(input);
      console.log(`  [OK] ${label} => ${result.key}`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (i < retries - 1 && (msg.includes('429') || msg.includes('rate'))) {
        console.log(`  [RETRY] ${label} — rate limited, waiting...`);
        await delay(3000 * (i + 1));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${label}`);
}

// ============================================================================
// Epic Descriptions (ADF)
// ============================================================================

const epicDescriptions: Record<string, AdfDocument> = {
  'Platform Foundation': adf()
    .heading(2, 'Platform Foundation')
    .paragraph(
      text()
        .text('Core infrastructure for HLN Relay: monorepo, CI, PostgreSQL schema, Redis, JWT auth, and seed data. This epic establishes the technical baseline for all Sprint 2+ features.')
    )
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'Monorepo scaffold with shared packages and CI pipeline',
      'PostgreSQL schema covering assessments, findings, agents, and users',
      'Redis for session management and live presence state',
      'JWT-based authentication with protected API routes',
      'Seed data for Project Sentinel demo fixture',
    ])
    .heading(3, 'Tech Stack')
    .bulletList([
      'Node.js / TypeScript backend',
      'PostgreSQL (Neon or Railway)',
      'Redis (Upstash or Railway)',
      'GitHub Actions for CI',
    ])
    .build(),

  'Assessment Workspace': adf()
    .heading(2, 'Assessment Workspace')
    .paragraph('The primary UI surface for HLN Relay. Engineers and ARIA agents both operate within the workspace. Layout, routing, design system, and role-adaptive views are defined here.')
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'Shell layout and client-side routing',
      'Design system: color tokens, typography, component primitives',
      'Assessment overview page with live participant status',
      'Role-adaptive UI distinguishing engineer vs. agent perspective',
      'Workspace notification toasts for real-time alerts',
    ])
    .heading(3, 'Design Direction')
    .bulletList([
      'Dark-mode-first, terminal-adjacent aesthetic',
      'Mode colors: Storm=yellow, Axis=purple, Void=magenta',
      'MMO-inspired HUD conventions for live data display',
    ])
    .build(),

  'Nexus Flow — Real-Time Coordination': adf()
    .heading(2, 'Nexus Flow — Real-Time Coordination')
    .paragraph('The WebSocket engine at the heart of HLN Relay. Nexus Flow manages live presence, activity streaming, and event broadcasting across all connected participants — human and agent.')
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'WebSocket server with Nexus Flow connection manager',
      'Presence tracking: join, leave, heartbeat',
      'Live participant list UI with avatars',
      'Activity feed: event stream component',
      'useNexusFlow client hook for React consumption',
    ])
    .heading(3, 'Architecture Notes')
    .bulletList([
      'Single shared WebSocket instance across surfaces',
      'Redis pub/sub for horizontal scaling readiness',
      'Event types versioned for forward compatibility',
    ])
    .build(),

  'ARIA AXIS Agent Integration': adf()
    .heading(2, 'ARIA AXIS Agent Integration')
    .paragraph('Brings ARIA AXIS agents into the assessment workspace. Agents participate as first-class entities: they join sessions, generate attributed findings, and broadcast actions via Nexus Flow.')
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'AXIS agent simulator service for local development and demo',
      'Agent event types and attribution model',
      'Agent presence: Recon agent joins and appears in participant list',
    ])
    .heading(3, 'AXIS Integration Notes')
    .bulletList([
      'Simulator mirrors production AXIS agent behavior',
      'Agent identity resolved via ARIA identity stack (ontology + registry)',
      'Recon agent is Sprint 3 MVP agent class',
    ])
    .build(),

  'Findings Management': adf()
    .heading(2, 'Findings Management')
    .paragraph('Core domain logic for HLN Relay. Findings are the primary artifact: security issues, risks, observations — created manually by engineers or autonomously by ARIA agents.')
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'Finding creation — manual and agent-attributed flows',
      'Findings list — filterable, sortable table',
      'Finding detail — investigation notes and assignment',
      'Finding updates broadcast via Nexus Flow in real time',
    ])
    .heading(3, 'Data Model')
    .bulletList([
      'Finding: id, title, severity, status, created_by (user or agent), assessment_id',
      'Attribution: agent_id + confidence_score for agent-generated findings',
      'History: append-only event log per finding',
    ])
    .build(),

  'Reporting and Demo Polish': adf()
    .heading(2, 'Reporting and Demo Polish')
    .paragraph('Sprint 4 focuses on producing a complete, demo-ready experience. Server-side report generation, a polished report viewer, a scripted Project Sentinel run, and a full end-to-end validation.')
    .rule()
    .heading(3, 'Scope')
    .bulletList([
      'Assessment report — server-side generation (PDF or structured JSON)',
      'Report viewer page in the workspace UI',
      'Demo script — Project Sentinel scripted assessment run',
      'UI polish: loading states, empty states, transitions',
      'End-to-end demo validation — two-browser walkthrough',
    ])
    .heading(3, 'Demo Target')
    .bulletList([
      'Project Sentinel: multi-participant session with Recon agent',
      'Findings created by human + agent, broadcast live',
      'Report generated and viewed inline',
      'Screencast-ready experience',
    ])
    .build(),
};

// ============================================================================
// Story Definitions
// ============================================================================

interface StoryDef {
  summary: string;
  description: AdfDocument;
  labels: string[];
  epic: string;
}

// ---- Sprint 1: Foundation ----

const sprint1Stories: StoryDef[] = [
  {
    epic: 'Platform Foundation',
    summary: 'Monorepo scaffold and CI pipeline [3pts]',
    labels: ['relay-mvp', 'sprint-1', 'infra'],
    description: adf()
      .heading(3, 'Monorepo Scaffold and CI Pipeline')
      .paragraph('Initialize the HLN Relay monorepo with shared packages (types, utils, db, ui) and a GitHub Actions CI pipeline.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Turborepo or pnpm workspaces monorepo initialized',
        'apps/api, apps/web, packages/db, packages/types structure in place',
        'GitHub Actions workflow: lint, typecheck, test on PR',
        'README with local setup instructions',
      ])
      .build(),
  },
  {
    epic: 'Platform Foundation',
    summary: 'PostgreSQL schema — core entities [5pts]',
    labels: ['relay-mvp', 'sprint-1', 'infra', 'database'],
    description: adf()
      .heading(3, 'PostgreSQL Schema — Core Entities')
      .paragraph('Design and migrate the foundational database schema for HLN Relay. All core entities must be present before any API or UI work begins.')
      .heading(4, 'Entities')
      .bulletList([
        'users — id, email, role (engineer | admin), created_at',
        'assessments — id, name, status, created_by, created_at',
        'participants — assessment_id, user_id, joined_at',
        'findings — id, assessment_id, title, severity, status, created_by, agent_id (nullable), created_at',
        'finding_events — id, finding_id, type, payload, created_at',
        'agents — id, name, class, status, joined_at',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Migration files created and applied',
        'Drizzle or Prisma ORM schema matches ERD',
        'Foreign keys and indexes defined',
        'Schema documented in packages/db/README',
      ])
      .build(),
  },
  {
    epic: 'Platform Foundation',
    summary: 'Redis setup for session and presence state [2pts]',
    labels: ['relay-mvp', 'sprint-1', 'infra'],
    description: adf()
      .heading(3, 'Redis Setup — Session and Presence State')
      .paragraph('Configure Redis for two use cases: JWT session store and live presence state for Nexus Flow.')
      .heading(4, 'Key Namespaces')
      .bulletList([
        'relay:session:{userId} — active session metadata',
        'relay:presence:{assessmentId} — connected participant set',
        'relay:heartbeat:{connectionId} — TTL-based heartbeat',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Redis client configured and connected in API server',
        'Environment variable REDIS_URL documented and wired',
        'Session read/write helpers exported from packages/db',
        'Presence helpers (add, remove, list) implemented',
      ])
      .build(),
  },
  {
    epic: 'Platform Foundation',
    summary: 'Auth — JWT login and protected routes [3pts]',
    labels: ['relay-mvp', 'sprint-1', 'auth'],
    description: adf()
      .heading(3, 'Auth — JWT Login and Protected Routes')
      .paragraph('Implement email/password login issuing a signed JWT. All API routes beyond /auth are protected via middleware.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'POST /auth/login returns signed JWT',
        'JWT verified in middleware, attaches user to request context',
        'Unauthorized requests return 401',
        'Token refresh strategy documented (if in scope)',
        'Seed user accounts for demo (engineer@relay.test, admin@relay.test)',
      ])
      .build(),
  },
  {
    epic: 'Platform Foundation',
    summary: 'Seed data — Project Sentinel demo fixture [2pts]',
    labels: ['relay-mvp', 'sprint-1', 'infra'],
    description: adf()
      .heading(3, 'Seed Data — Project Sentinel Demo Fixture')
      .paragraph('Create a deterministic seed script that populates the Project Sentinel demo assessment with users, findings, and agents so the demo can be reset at any time.')
      .heading(4, 'Seed Contents')
      .bulletList([
        'Assessment: "Project Sentinel" — status: active',
        '2 engineer users: alice@relay.test, bob@relay.test',
        '1 agent entry: Recon-01 (Recon class)',
        '3 pre-seeded findings: SQL Injection (critical), Exposed Config (medium), Missing Rate Limit (low)',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'npm run seed runs without errors',
        'Idempotent — safe to run multiple times',
        'Seed script documented in README',
      ])
      .build(),
  },
  {
    epic: 'Assessment Workspace',
    summary: 'Assessment workspace shell — layout and routing [3pts]',
    labels: ['relay-mvp', 'sprint-1', 'ui'],
    description: adf()
      .heading(3, 'Assessment Workspace Shell — Layout and Routing')
      .paragraph('Build the primary shell for the assessment workspace: persistent sidebar, top bar, main content area, and client-side route structure.')
      .heading(4, 'Routes')
      .bulletList([
        '/ — redirect to /assessments',
        '/assessments — list of assessments',
        '/assessments/:id — workspace view',
        '/assessments/:id/findings — findings list',
        '/assessments/:id/report — report viewer',
        '/login — auth page',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Shell renders correctly on desktop (1280px+)',
        'Active route highlighted in sidebar',
        'Authenticated route guard in place',
        'Loading skeleton for async transitions',
      ])
      .build(),
  },
  {
    epic: 'Assessment Workspace',
    summary: 'Design system — color tokens, typography, component primitives [2pts]',
    labels: ['relay-mvp', 'sprint-1', 'design'],
    description: adf()
      .heading(3, 'Design System — Color Tokens, Typography, Component Primitives')
      .paragraph('Establish the HLN Relay design system: CSS custom properties, typography scale, and foundational component primitives that all UI work builds on.')
      .heading(4, 'Tokens')
      .bulletList([
        'Mode colors: Storm yellow (#F5C400), Axis purple (#7C3AED), Void magenta (#C026D3)',
        'Neutrals: dark bg, surface, border, muted, foreground',
        'Severity colors: critical red, high orange, medium yellow, low blue, info gray',
      ])
      .heading(4, 'Primitives')
      .bulletList([
        'Button (primary, secondary, ghost, destructive)',
        'Badge (severity variants)',
        'Card, Separator, Spinner',
        'Typography: heading, body, mono, label',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Tailwind config or CSS vars define all tokens',
        'Primitives exported from packages/ui',
        'Storybook or visual snapshot for each primitive (optional stretch)',
      ])
      .build(),
  },
];

// ---- Sprint 2: Core Collaboration ----

const sprint2Stories: StoryDef[] = [
  {
    epic: 'Nexus Flow — Real-Time Coordination',
    summary: 'WebSocket server — Nexus Flow connection manager [5pts]',
    labels: ['relay-mvp', 'sprint-2', 'websocket'],
    description: adf()
      .heading(3, 'WebSocket Server — Nexus Flow Connection Manager')
      .paragraph('Implement the core Nexus Flow WebSocket server. The connection manager handles authentication, connection lifecycle, and routes messages to the correct assessment room.')
      .heading(4, 'Message Protocol')
      .bulletList([
        '{ type: "presence:join", assessmentId, userId }',
        '{ type: "presence:leave", assessmentId, userId }',
        '{ type: "activity", assessmentId, event }',
        '{ type: "finding:update", assessmentId, finding }',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'WS server starts alongside API server',
        'JWT token validated on WS upgrade (query param or header)',
        'Clients assigned to assessment rooms by assessmentId',
        'Connection/disconnection events logged',
        'Unit tests for message routing logic',
      ])
      .build(),
  },
  {
    epic: 'Nexus Flow — Real-Time Coordination',
    summary: 'Presence tracking — join, leave, heartbeat [3pts]',
    labels: ['relay-mvp', 'sprint-2', 'websocket'],
    description: adf()
      .heading(3, 'Presence Tracking — Join, Leave, Heartbeat')
      .paragraph('Implement presence state using Redis. When a user connects to an assessment room, their presence is registered. Heartbeats keep the entry alive; disconnect removes it.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Redis presence set updated on join and leave',
        'Heartbeat interval (every 15s) resets TTL',
        'Stale presence entries expire after 60s without heartbeat',
        'presence:join and presence:leave events broadcast to room members',
      ])
      .build(),
  },
  {
    epic: 'Nexus Flow — Real-Time Coordination',
    summary: 'Presence UI — live participant list with avatars [3pts]',
    labels: ['relay-mvp', 'sprint-2', 'ui', 'websocket'],
    description: adf()
      .heading(3, 'Presence UI — Live Participant List with Avatars')
      .paragraph('Render the live participant list in the workspace sidebar. Each connected participant shows an avatar (initials-based), display name, and role badge.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Participant list updates in real time without page refresh',
        'Avatar: colored circle with initials, deterministic color by user ID',
        'Agent participants distinguished with a bot icon',
        'Smooth enter/exit animations (fade or slide)',
        'Empty state: "No participants yet"',
      ])
      .build(),
  },
  {
    epic: 'Nexus Flow — Real-Time Coordination',
    summary: 'Live activity feed — event stream component [3pts]',
    labels: ['relay-mvp', 'sprint-2', 'ui', 'websocket'],
    description: adf()
      .heading(3, 'Live Activity Feed — Event Stream Component')
      .paragraph('A reverse-chronological feed of assessment events: participants joining, findings created/updated, agent actions. Renders in the workspace sidebar or main area.')
      .heading(4, 'Event Types Displayed')
      .bulletList([
        'User joined / left the assessment',
        'Finding created (by user or agent)',
        'Finding status changed',
        'Agent action taken',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'New events prepend to top of feed in real time',
        'Each event shows: actor avatar, description, timestamp (relative)',
        'Feed capped at 50 visible events (older events culled from DOM)',
        'Scroll position locked to top when new events arrive unless user has scrolled up',
      ])
      .build(),
  },
  {
    epic: 'Nexus Flow — Real-Time Coordination',
    summary: 'Nexus Flow client hook — useNexusFlow [2pts]',
    labels: ['relay-mvp', 'sprint-2', 'websocket'],
    description: adf()
      .heading(3, 'Nexus Flow Client Hook — useNexusFlow')
      .paragraph('React hook that manages WebSocket connection lifecycle and exposes a typed event interface for components to consume Nexus Flow data.')
      .heading(4, 'API')
      .bulletList([
        'useNexusFlow(assessmentId) — connects on mount, disconnects on unmount',
        'Returns: { participants, activityFeed, send, connectionStatus }',
        'send(type, payload) — typed message sender',
        'connectionStatus: "connecting" | "connected" | "disconnected" | "error"',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Hook exported from packages/ui or apps/web/hooks',
        'Auto-reconnect on disconnect (exponential backoff, max 5 retries)',
        'Token passed on initial connection',
        'Unit tests for reconnect logic',
      ])
      .build(),
  },
  {
    epic: 'Assessment Workspace',
    summary: 'Assessment overview page — live participant status [3pts]',
    labels: ['relay-mvp', 'sprint-2', 'ui'],
    description: adf()
      .heading(3, 'Assessment Overview Page — Live Participant Status')
      .paragraph('The main landing page for an open assessment. Shows assessment metadata, live participant count/list, recent activity, and quick-links to findings and report.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Assessment name, status badge, and created date displayed',
        'Live participant list (from useNexusFlow) rendered in sidebar',
        'Recent activity feed visible below assessment header',
        'Quick links: View Findings, Generate Report',
        'Page refreshes participant count without reload',
      ])
      .build(),
  },
  {
    epic: 'Assessment Workspace',
    summary: 'Role-adaptive UI — engineer vs. agent view distinction [2pts]',
    labels: ['relay-mvp', 'sprint-2', 'ui'],
    description: adf()
      .heading(3, 'Role-Adaptive UI — Engineer vs. Agent View Distinction')
      .paragraph('The workspace renders differently based on the authenticated participant\'s role. Engineers see action controls; agent views (for demo/simulation) show a read-oriented intelligence HUD.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Role resolved from JWT claims: engineer | agent | admin',
        'Engineer view: full controls, create finding button, assignment dropdowns',
        'Agent view: read-only with highlighted agent-attributed findings',
        'Role badge visible in top bar',
        'No role-leaking: agent cannot trigger engineer actions via UI',
      ])
      .build(),
  },
];

// ---- Sprint 3: Agent + Findings ----

const sprint3Stories: StoryDef[] = [
  {
    epic: 'ARIA AXIS Agent Integration',
    summary: 'AXIS agent simulator service [5pts]',
    labels: ['relay-mvp', 'sprint-3', 'agent'],
    description: adf()
      .heading(3, 'AXIS Agent Simulator Service')
      .paragraph('A deterministic simulator that mimics the behavior of a production ARIA AXIS agent. Used for local development, testing, and demo scripting without requiring a live AXIS runtime.')
      .heading(4, 'Behaviors Simulated')
      .bulletList([
        'Connect to Nexus Flow as an agent participant',
        'Emit agent presence events on join',
        'Scan findings and emit attributed finding events on a schedule',
        'Respond to assessment state changes with agent actions',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Simulator starts as a standalone process (npx relay-agent-sim)',
        'Configurable: assessmentId, agent class, scan interval, finding templates',
        'Uses same Nexus Flow WS protocol as human clients',
        'Deterministic in demo mode (scripted event sequence)',
      ])
      .build(),
  },
  {
    epic: 'ARIA AXIS Agent Integration',
    summary: 'Agent event types and attribution model [3pts]',
    labels: ['relay-mvp', 'sprint-3', 'agent'],
    description: adf()
      .heading(3, 'Agent Event Types and Attribution Model')
      .paragraph('Define the full event type taxonomy for agent actions and the attribution model that links findings and activity to the responsible agent.')
      .heading(4, 'Event Types')
      .bulletList([
        'agent:joined — agent connected to assessment',
        'agent:scan_started — agent began analysis',
        'agent:finding_attributed — agent created a finding with confidence score',
        'agent:action — generic agent action with type and payload',
      ])
      .heading(4, 'Attribution Model')
      .bulletList([
        'finding.agent_id — FK to agents table',
        'finding.confidence_score — 0.0–1.0 float',
        'finding.attribution_metadata — JSON blob (model, reasoning, evidence)',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Event types exported from packages/types',
        'Attribution fields present in findings schema (migration)',
        'UI renders confidence badge on agent-attributed findings',
      ])
      .build(),
  },
  {
    epic: 'ARIA AXIS Agent Integration',
    summary: 'Agent presence — Recon agent joins assessment [2pts]',
    labels: ['relay-mvp', 'sprint-3', 'agent', 'ui'],
    description: adf()
      .heading(3, 'Agent Presence — Recon Agent Joins Assessment')
      .paragraph('Wire the Recon agent (from simulator or AXIS runtime) into the presence system. The agent appears in the participant list alongside human engineers with a distinct visual treatment.')
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Agent entry appears in participant list on join',
        'Agent avatar: bot icon, Axis purple color, "Recon" label',
        'Agent presence persisted in Redis with appropriate TTL',
        'activity feed shows "Recon-01 joined the assessment"',
      ])
      .build(),
  },
  {
    epic: 'Findings Management',
    summary: 'Finding creation — manual and agent-attributed [5pts]',
    labels: ['relay-mvp', 'sprint-3', 'findings'],
    description: adf()
      .heading(3, 'Finding Creation — Manual and Agent-Attributed')
      .paragraph('Two creation paths: engineers use a form to create findings manually; agents emit attributed findings via the Nexus Flow event protocol.')
      .heading(4, 'Manual Creation Flow')
      .bulletList([
        'Create Finding button opens slide-over panel',
        'Fields: title, severity (critical/high/medium/low/info), description, assignee',
        'POST /api/assessments/:id/findings',
        'On success: finding appears in list, activity event broadcast',
      ])
      .heading(4, 'Agent Attribution Flow')
      .bulletList([
        'Agent emits agent:finding_attributed event via WS',
        'Server validates and persists finding with agent_id + confidence_score',
        'Finding broadcast to all room participants',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Both paths tested end-to-end',
        'Manual creation optimistic UI update',
        'Agent findings marked with confidence badge',
        'Created finding appears in list within 500ms',
      ])
      .build(),
  },
  {
    epic: 'Findings Management',
    summary: 'Findings list — filterable, sortable table [3pts]',
    labels: ['relay-mvp', 'sprint-3', 'findings', 'ui'],
    description: adf()
      .heading(3, 'Findings List — Filterable, Sortable Table')
      .paragraph('The findings list is the primary data view. Engineers and agents can filter by severity, status, and assignee, and sort by date, severity, or status.')
      .heading(4, 'Columns')
      .bulletList([
        'Severity badge',
        'Title (links to detail)',
        'Status (open, in_progress, resolved, false_positive)',
        'Assignee avatar',
        'Source (engineer name or agent badge)',
        'Created at (relative time)',
      ])
      .heading(4, 'Filters')
      .bulletList([
        'Severity: multi-select (critical, high, medium, low, info)',
        'Status: multi-select',
        'Source: human | agent | all',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Filter state reflected in URL params',
        'Sort by any column header click',
        'New findings from Nexus Flow appended to list in real time',
        'Empty state with illustration when no findings match filters',
      ])
      .build(),
  },
  {
    epic: 'Findings Management',
    summary: 'Finding detail — investigation and assignment [3pts]',
    labels: ['relay-mvp', 'sprint-3', 'findings', 'ui'],
    description: adf()
      .heading(3, 'Finding Detail — Investigation and Assignment')
      .paragraph('The finding detail page (or slide-over) shows full finding context, attribution info, investigation notes, and assignment controls.')
      .heading(4, 'Sections')
      .bulletList([
        'Header: title, severity badge, status dropdown',
        'Attribution: created by (user or agent + confidence score)',
        'Description: markdown rendered',
        'Assignment: assignee picker with user search',
        'Investigation notes: append-only markdown editor',
        'Event history: timeline of status changes and updates',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Status change persisted and broadcast via Nexus Flow',
        'Investigation notes saved on submit (PATCH /api/findings/:id)',
        'Assignee change reflected in findings list immediately',
        'Agent confidence score and metadata displayed when applicable',
      ])
      .build(),
  },
  {
    epic: 'Findings Management',
    summary: 'Finding updates broadcast via Nexus Flow [2pts]',
    labels: ['relay-mvp', 'sprint-3', 'findings', 'websocket'],
    description: adf()
      .heading(3, 'Finding Updates Broadcast via Nexus Flow')
      .paragraph('Whenever a finding is created, updated, or has its status changed, the update is broadcast to all participants in the assessment room via Nexus Flow.')
      .heading(4, 'Events')
      .bulletList([
        'finding:created — broadcast on POST success',
        'finding:updated — broadcast on PATCH (status, assignee, notes)',
        'finding:resolved — specialized event for resolution',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'All mutating API routes emit corresponding WS event',
        'Findings list updates in real time across two browser sessions',
        'Activity feed logs each finding event with actor info',
        'No duplicate events on the originating client',
      ])
      .build(),
  },
];

// ---- Sprint 4: Reporting + Polish ----

const sprint4Stories: StoryDef[] = [
  {
    epic: 'Reporting and Demo Polish',
    summary: 'Assessment report — server-side generation [5pts]',
    labels: ['relay-mvp', 'sprint-4', 'reporting'],
    description: adf()
      .heading(3, 'Assessment Report — Server-Side Generation')
      .paragraph('Generate a structured assessment report server-side on demand. The report aggregates all findings, participant activity, and agent contributions for an assessment.')
      .heading(4, 'Report Contents')
      .bulletList([
        'Assessment metadata: name, dates, participants, status',
        'Finding summary by severity (counts, breakdown chart data)',
        'Full findings list: title, severity, status, attribution, description',
        'Agent contribution summary: findings attributed per agent, confidence distribution',
        'Timeline: first finding to report generation',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'GET /api/assessments/:id/report returns structured JSON',
        'Report JSON follows a documented schema (types in packages/types)',
        'Generation completes in under 3 seconds for Project Sentinel fixture',
        'PDF export stretch goal (react-pdf or Puppeteer)',
      ])
      .build(),
  },
  {
    epic: 'Reporting and Demo Polish',
    summary: 'Report viewer page in workspace [3pts]',
    labels: ['relay-mvp', 'sprint-4', 'reporting', 'ui'],
    description: adf()
      .heading(3, 'Report Viewer Page in Workspace')
      .paragraph('In-workspace report view at /assessments/:id/report. Renders the generated report in a clean, print-ready layout.')
      .heading(4, 'Sections')
      .bulletList([
        'Executive summary: severity breakdown, participant count, agent count',
        'Findings table: sortable, all findings with status and attribution',
        'Agent intelligence panel: per-agent contributions and confidence scores',
        'Recommendations (if included in report JSON)',
        'Print / Export to PDF button',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Page loads report data from API on mount',
        'Report generates fresh on each page visit (no stale cache)',
        'Print-friendly layout (CSS @media print)',
        'Empty state if assessment has no findings',
      ])
      .build(),
  },
  {
    epic: 'Reporting and Demo Polish',
    summary: 'Demo script — Project Sentinel scripted run [2pts]',
    labels: ['relay-mvp', 'sprint-4', 'demo'],
    description: adf()
      .heading(3, 'Demo Script — Project Sentinel Scripted Run')
      .paragraph('A documented, reproducible script for running the Project Sentinel demo. Covers environment reset, simulator startup, scripted user actions, and expected outcomes at each step.')
      .heading(4, 'Script Sections')
      .bulletList([
        '1. Reset: run npm run seed to restore fixture',
        '2. Launch: start API, WS server, web, and agent simulator',
        '3. Alice (engineer): log in, open Project Sentinel workspace',
        '4. Bob (engineer): log in second browser, join assessment',
        '5. Recon-01 (agent): simulator connects, joins participant list',
        '6. Recon-01: emits 2 attributed findings (SQL Injection critical, Missing Rate Limit low)',
        '7. Alice: creates 1 manual finding (Exposed Config medium)',
        '8. Bob: assigns SQL Injection finding to Alice, adds investigation note',
        '9. Alice: generates report, views in workspace',
        '10. Screenshot / screen recording guide',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Script documented in DEMO.md at repo root',
        'All steps reproducible from a clean environment',
        'Expected screenshots noted per step',
      ])
      .build(),
  },
  {
    epic: 'Reporting and Demo Polish',
    summary: 'UI polish pass — loading states, empty states, transitions [3pts]',
    labels: ['relay-mvp', 'sprint-4', 'ui', 'polish'],
    description: adf()
      .heading(3, 'UI Polish Pass — Loading States, Empty States, Transitions')
      .paragraph('Audit every data-loading surface in the workspace and add skeleton loaders, empty states, and smooth transitions. Eliminates jarring layout shifts and blank screens.')
      .heading(4, 'Surfaces to Polish')
      .bulletList([
        'Assessment list page — skeleton cards while loading',
        'Participant list — ghost avatars during connection',
        'Findings list — skeleton rows, empty state illustration',
        'Finding detail — skeleton on first load',
        'Activity feed — skeleton items on initial fetch',
        'Report viewer — full-page skeleton while generating',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'No flash of unstyled content on any route',
        'Skeleton loaders match final layout dimensions',
        'Empty states have supporting copy and CTA',
        'Page transitions are under 200ms perceived',
      ])
      .build(),
  },
  {
    epic: 'Reporting and Demo Polish',
    summary: 'End-to-end demo validation — two-browser walkthrough [2pts]',
    labels: ['relay-mvp', 'sprint-4', 'demo', 'qa'],
    description: adf()
      .heading(3, 'End-to-End Demo Validation — Two-Browser Walkthrough')
      .paragraph('Execute the full Project Sentinel demo script in two browser windows simultaneously. Document any bugs, timing issues, or visual regressions found.')
      .heading(4, 'Validation Checklist')
      .bulletList([
        'Both browsers connect to WS and show each other in participant list',
        'Recon-01 agent appears in both browsers\' participant lists',
        'Agent-attributed findings appear in real time on both browsers',
        'Manual finding creation broadcasts to second browser within 500ms',
        'Status change in Browser A reflected in Browser B\'s findings list',
        'Report generation completes without error',
        'All loading/empty states render correctly throughout',
        'No console errors during full walkthrough',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Walkthrough completed with zero blocking bugs',
        'Any non-blocking issues documented and triaged',
        'Screen recording captured as demo artifact',
      ])
      .build(),
  },
  {
    epic: 'Assessment Workspace',
    summary: 'Workspace notification toasts — real-time alerts [2pts]',
    labels: ['relay-mvp', 'sprint-4', 'ui', 'websocket'],
    description: adf()
      .heading(3, 'Workspace Notification Toasts — Real-Time Alerts')
      .paragraph('Surface Nexus Flow events as non-blocking toast notifications in the workspace. Users get ambient awareness of activity without the activity feed requiring full attention.')
      .heading(4, 'Toast Triggers')
      .bulletList([
        'New participant joined: "{Name} joined the assessment"',
        'Critical finding created: "Recon-01 found a critical issue: {title}"',
        'Finding assigned to you: "{Name} assigned {title} to you"',
        'Report ready: "Assessment report has been generated"',
      ])
      .heading(4, 'Acceptance Criteria')
      .bulletList([
        'Toasts appear in top-right corner (MMO convention)',
        'Auto-dismiss after 5s, with manual close button',
        'Critical severity toasts have red accent',
        'Maximum 3 toasts visible simultaneously (queue remaining)',
        'Toasts suppressed when user is active on the relevant page',
      ])
      .build(),
  },
];

// ============================================================================
// Epic Ordering (for numbered progress logging)
// ============================================================================

const EPICS_ORDER = [
  'Platform Foundation',
  'Assessment Workspace',
  'Nexus Flow — Real-Time Coordination',
  'ARIA AXIS Agent Integration',
  'Findings Management',
  'Reporting and Demo Polish',
] as const;

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('=== HLN Relay — Jira Project Setup ===');
  console.log('Project: RELAY | 6 epics | 27 stories | 4 sprints\n');

  // Step 1: Get current user
  console.log('[1/4] Getting current user...');
  const me = await jira.getCurrentUser();
  console.log(`  Authenticated as: ${me.displayName} (${me.accountId})\n`);

  // Step 2: Create project
  console.log('[2/4] Creating RELAY project...');
  const projectKey = 'RELAY';
  try {
    const project = await jira.createProject({
      key: projectKey,
      name: 'HLN Relay',
      description: 'HLN Relay — AI-powered assessment platform with real-time collaboration via Nexus Flow WebSocket engine and ARIA AXIS agent integration.',
      projectTypeKey: 'software',
      projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic',
      leadAccountId: me.accountId,
    });
    console.log(`  [OK] Project created: ${project.key} (id: ${project.id})\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already exists') || msg.includes('409') || msg.includes('project with that key')) {
      console.log('  [SKIP] Project RELAY already exists. Continuing with issue creation.\n');
    } else {
      console.error(`  [ERROR] Could not create project: ${msg}`);
      try {
        const existing = await jira.getProject(projectKey);
        console.log(`  [OK] Found existing project: ${existing.key}\n`);
      } catch {
        console.error('  [FATAL] RELAY project does not exist and could not be created.');
        process.exit(1);
      }
    }
  }

  await delay(1000);

  // Step 3: Create all epics
  console.log('[3/4] Creating 6 epics...');
  const epicKeys: Record<string, string> = {};

  for (const epicName of EPICS_ORDER) {
    const epic = await createIssueWithRetry(
      {
        project: projectKey,
        issuetype: 'Epic',
        summary: epicName,
        description: epicDescriptions[epicName],
        labels: ['relay-mvp'],
      },
      `Epic: ${epicName}`,
    );
    epicKeys[epicName] = epic.key;
    await delay(500);
  }

  console.log('\n  Epic keys:');
  for (const [name, key] of Object.entries(epicKeys)) {
    console.log(`    ${key} — ${name}`);
  }

  // Step 4: Create all stories
  console.log('\n[4/4] Creating 27 stories across 4 sprints...');

  const allStories: StoryDef[] = [
    ...sprint1Stories,
    ...sprint2Stories,
    ...sprint3Stories,
    ...sprint4Stories,
  ];

  const allCreated: { key: string; summary: string }[] = [];

  for (const story of allStories) {
    await delay(300);
    const parentKey = epicKeys[story.epic];
    if (!parentKey) {
      console.warn(`  [WARN] No epic key found for "${story.epic}" — skipping: ${story.summary}`);
      continue;
    }
    const result = await createIssueWithRetry(
      {
        project: projectKey,
        issuetype: 'Story',
        summary: story.summary,
        description: story.description,
        labels: story.labels,
        parent: parentKey,
      },
      `Story: ${story.summary}`,
    );
    allCreated.push({ key: result.key, summary: story.summary });
  }

  // Summary
  console.log('\n=== COMPLETE ===');
  console.log(`Project: ${projectKey} — HLN Relay`);
  console.log(`\nEpics (${EPICS_ORDER.length}):`);
  for (const name of EPICS_ORDER) {
    console.log(`  ${epicKeys[name]} — ${name}`);
  }
  console.log(`\nStories created (${allCreated.length}/27):`);
  for (const issue of allCreated) {
    console.log(`  ${issue.key} — ${issue.summary}`);
  }
  console.log(`\nView board: https://hiddenleafnetworks.atlassian.net/jira/software/projects/${projectKey}/board`);
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
