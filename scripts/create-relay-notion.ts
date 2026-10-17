import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// Load .env manually (same pattern as import-to-notion.ts)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const NOTION_TOKEN = process.env.NOTION_API_TOKEN!;
const NOTION_BASE = 'api.notion.com';
const NOTION_VERSION = '2022-06-28';
const DELAY_MS = 350;

if (!NOTION_TOKEN) {
  console.error('Missing NOTION_API_TOKEN in .env');
  process.exit(1);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function notionRequest(method: string, urlPath: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: NOTION_BASE,
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${urlPath}: ${JSON.stringify(parsed).slice(0, 400)}`));
            return;
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error ${method} ${urlPath}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Rich text helpers ────────────────────────────────────────────────────────

interface RichText {
  type: 'text';
  text: { content: string; link?: { url: string } };
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean };
}

function t(content: string, annotations?: RichText['annotations']): RichText {
  const rt: RichText = { type: 'text', text: { content } };
  if (annotations) rt.annotations = annotations;
  return rt;
}

function bold(content: string): RichText { return t(content, { bold: true }); }
function italic(content: string): RichText { return t(content, { italic: true }); }

// ─── Block builders ───────────────────────────────────────────────────────────

type Block = any;

function h1(text: string): Block {
  return { object: 'block', type: 'heading_1', heading_1: { rich_text: [t(text)] } };
}

function h2(text: string): Block {
  return { object: 'block', type: 'heading_2', heading_2: { rich_text: [t(text)] } };
}

function h3(text: string): Block {
  return { object: 'block', type: 'heading_3', heading_3: { rich_text: [t(text)] } };
}

function p(rich_text: RichText[]): Block {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: rich_text.length > 0 ? rich_text : [t('')] } };
}

function bullet(rich_text: RichText[]): Block {
  return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text } };
}

function divider(): Block {
  return { object: 'block', type: 'divider', divider: {} };
}

function quote(rich_text: RichText[]): Block {
  return { object: 'block', type: 'quote', quote: { rich_text } };
}

function code(content: string, language = 'plain text'): Block {
  return { object: 'block', type: 'code', code: { rich_text: [t(content.slice(0, 2000))], language } };
}

function table(rows: string[][]): Block {
  if (rows.length === 0) return divider();
  const tableWidth = rows[0].length;
  const tableRows = rows.map(row => ({
    object: 'block',
    type: 'table_row',
    table_row: {
      cells: row.map(cell => [{ type: 'text', text: { content: cell.slice(0, 2000) } }]),
    },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: tableWidth,
      has_column_header: true,
      has_row_header: false,
      children: tableRows,
    },
  };
}

// ─── Page creation with batching ──────────────────────────────────────────────

async function createPage(title: string, blocks: Block[]): Promise<string> {
  console.log(`Creating page: "${title}" with ${blocks.length} blocks...`);

  const first100 = blocks.slice(0, 100);
  const body: any = {
    parent: { workspace: true },
    properties: {
      title: [{ text: { content: title.slice(0, 2000) } }],
    },
  };
  if (first100.length > 0) body.children = first100;

  const result = await notionRequest('POST', '/v1/pages', body);
  await sleep(DELAY_MS);
  const pageId: string = result.id;
  console.log(`  Page created: ${pageId}`);

  let remaining = blocks.slice(100);
  let batchNum = 2;
  while (remaining.length > 0) {
    const batch = remaining.slice(0, 100);
    remaining = remaining.slice(100);
    console.log(`  Appending batch ${batchNum} (${batch.length} blocks)...`);
    await notionRequest('PATCH', `/v1/blocks/${pageId}/children`, { children: batch });
    await sleep(DELAY_MS);
    batchNum++;
  }

  return pageId;
}

// ─── HLN Relay product spec blocks ───────────────────────────────────────────

function buildRelayBlocks(): Block[] {
  const blocks: Block[] = [];

  // Title hero area
  blocks.push(quote([bold('Collaborative Security Engineering. Human Intelligence. Autonomous Execution.')]));
  blocks.push(p([t('Powered by '), bold('ARIA AXIS'), t(' — Hidden Leaf Networks')]));
  blocks.push(divider());

  // ── Product Overview ──────────────────────────────────────────────────────
  blocks.push(h2('Product Overview'));
  blocks.push(p([
    bold('HLN Relay'), t(' is a collaborative cybersecurity SaaS platform built on the '),
    bold('ARIA AXIS'), t(' intelligence architecture. It unifies penetration testing, vulnerability management, remediation workflows, and security project management into a single real-time workspace.'),
  ]));
  blocks.push(p([
    t('Relay is designed for security teams that need to move fast together. Where legacy tools treat security assessments as solo exercises, Relay introduces '),
    bold('Figma-style real-time collaboration'), t(' — multiple engineers sharing a live canvas, ARIA AXIS agents executing in the background, findings surfacing natively, and reporting generated automatically.'),
  ]));

  blocks.push(h3('Core Differentiation'));
  blocks.push(bullet([bold('vs Aikido:'), t(' Real-time multi-user collaboration vs single-user feel; Relay treats the assessment as a team sport')]));
  blocks.push(bullet([bold('vs Horizon AI / NodeZero:'), t(' Infrastructure-strong but collaboration-weak; Relay is built collaboration-first with AI as the execution layer')]));
  blocks.push(bullet([bold('Unified workspace:'), t(' Pentesting + vuln management + remediation + security PM in one surface, not four separate tools')]));
  blocks.push(bullet([bold('ARIA AXIS native:'), t(' Agents are not bolt-ons — they are first-class participants in every assessment workflow')]));
  blocks.push(divider());

  // ── Core Capabilities ─────────────────────────────────────────────────────
  blocks.push(h2('Core Capabilities'));
  blocks.push(table([
    ['Capability', 'Description'],
    ['Relay Workspace', 'Shared assessment environment — all engineers in one live session'],
    ['Live Collaboration', 'Figma-style real-time multi-user canvas for security assessments'],
    ['ARIA AXIS Agents', 'Autonomous AI agents executing recon, scanning, validation, reporting'],
    ['Agent Studio', 'Configure, spawn, and monitor AXIS agents mid-assessment'],
    ['Security Testing', 'Integrated scanning, exploitation workflow, and POC capture'],
    ['Relay Issues', 'Native findings management with severity, CVSS, and remediation tracking'],
    ['Role-Adaptive UI', 'Interface adapts to Pentester, Developer, and Manager roles'],
    ['Activity Timeline', 'Full audit trail of human actions and agent executions'],
    ['Reporting', 'Auto-generated executive and technical reports from live findings'],
    ['Agent Marketplace', 'Future: install community and vendor agents into your workspace'],
  ]));
  blocks.push(divider());

  // ── Architecture ──────────────────────────────────────────────────────────
  blocks.push(h2('Architecture'));
  blocks.push(p([t('Relay is built on a 3-layer architecture that separates the workspace surface, coordination layer, and intelligence layer:')]));

  blocks.push(h3('Layer 1 — RELAY (Workspace)'));
  blocks.push(p([t('The user-facing surface. Real-time collaborative canvas, Relay Issues tracker, role-adaptive UI, and the Agent Studio panel. Built in Next.js with WebSocket-driven live state.')]));

  blocks.push(h3('Layer 2 — NEXUS FLOW (Coordination)'));
  blocks.push(p([t('The orchestration backbone. Routes tasks between engineers and agents, manages assessment state, handles concurrency, and enforces approval gates. Built on FastAPI + Redis.')]));

  blocks.push(h3('Layer 3 — ARIA AXIS (Intelligence)'));
  blocks.push(p([t('The autonomous execution layer. AXIS agents perform recon, scanning, API testing, validation, and report synthesis. Each agent runs as an autonomous worker with tool access and memory.')]));

  blocks.push(h3('Tech Stack'));
  blocks.push(code(
    'Frontend:   Next.js (App Router) + WebSockets\n' +
    'Backend:    FastAPI (Python)\n' +
    'Database:   PostgreSQL (persistent state)\n' +
    'Cache:      Redis (live session state, pubsub)\n' +
    'Realtime:   WebSockets (multi-user sync)\n' +
    'Agents:     ARIA AXIS (Scroll engine layer)',
    'yaml'
  ));
  blocks.push(divider());

  // ── Agent Roster ──────────────────────────────────────────────────────────
  blocks.push(h2('Agent Roster'));
  blocks.push(table([
    ['Agent', 'Class', 'Role'],
    ['Recon Agent', 'Sentinel', 'Subdomain enum, port scanning, asset discovery, fingerprinting'],
    ['Web Security Agent', 'Forge', 'OWASP Top 10 scanning, XSS/SQLi/SSRF detection, POC capture'],
    ['API Security Agent', 'Forge', 'REST/GraphQL endpoint fuzzing, auth testing, schema validation'],
    ['Validation Agent', 'Worker', 'Confirms findings from other agents, eliminates false positives'],
    ['Reporting Agent', 'Emissary', 'Synthesizes findings into executive and technical report formats'],
  ]));
  blocks.push(divider());

  // ── Relay Workspace 001 ───────────────────────────────────────────────────
  blocks.push(h2('Relay Workspace 001'));
  blocks.push(p([italic('The first experience cohort shipped in Prototype 001 — Project Sentinel.')]));

  blocks.push(h3('Experience 1 — Collaborative Assessment Canvas'));
  blocks.push(p([t('A real-time shared workspace where multiple engineers and ARIA AXIS agents operate simultaneously. Live cursors, scoped panels, and a shared activity feed keep every participant in sync.')]));
  blocks.push(bullet([t('Multi-user presence with live cursor tracking')]));
  blocks.push(bullet([t('Scoped panels per engineer role (Pentester / Dev / Manager)')]));
  blocks.push(bullet([t('Agent activity visible inline — not in a separate dashboard')]));
  blocks.push(bullet([t('Assessment scope definition and target inventory management')]));

  blocks.push(h3('Experience 2 — Security Operations Environment'));
  blocks.push(p([t('The execution environment for running agents and capturing manual test activity. Engineers can spawn agents, set targets, monitor progress, and intervene at any point.')]));
  blocks.push(bullet([t('Agent Studio: spawn, configure, pause, restart AXIS agents')]));
  blocks.push(bullet([t('Live scan output streamed to the canvas in real time')]));
  blocks.push(bullet([t('Manual capture tools for engineer-driven testing alongside agents')]));
  blocks.push(bullet([t('Approval gate for high-impact agent actions')]));

  blocks.push(h3('Experience 3 — Native Findings Management'));
  blocks.push(p([t('Relay Issues is a security-native issue tracker built into the workspace. Findings from agents and engineers land here automatically, with severity scoring, CVSS, and remediation workflows.')]));
  blocks.push(bullet([t('Auto-ingest from agent discoveries')]));
  blocks.push(bullet([t('CVSS scoring, severity classification, affected component tagging')]));
  blocks.push(bullet([t('Remediation assignment and status tracking')]));
  blocks.push(bullet([t('One-click escalation to executive report')]));
  blocks.push(divider());

  // ── MVP Roadmap ───────────────────────────────────────────────────────────
  blocks.push(h2('MVP Roadmap — 4 Sprints'));
  blocks.push(p([t('Total: 27 stories · 81 story points across 4 sprints.')]));

  blocks.push(h3('Sprint 1 — Foundation (7 stories · 20 pts)'));
  blocks.push(bullet([t('Relay Workspace scaffold — Next.js + FastAPI + PostgreSQL + Redis')]));
  blocks.push(bullet([t('WebSocket session infrastructure (create / join / leave)')]));
  blocks.push(bullet([t('Assessment data model (targets, scope, metadata)')]));
  blocks.push(bullet([t('User auth and role system (Pentester / Developer / Manager)')]));
  blocks.push(bullet([t('ARIA AXIS agent runner integration (Scroll engine bridge)')]));
  blocks.push(bullet([t('Relay Issues data model and API')]));
  blocks.push(bullet([t('Base UI shell: canvas, left nav, role-adaptive header')]));

  blocks.push(h3('Sprint 2 — Core Collaboration / Nexus Flow (7 stories · 21 pts)'));
  blocks.push(bullet([t('Live multi-user presence (cursors, awareness, activity feed)')]));
  blocks.push(bullet([t('Nexus Flow orchestration router (task queuing + agent dispatch)')]));
  blocks.push(bullet([t('Agent Studio panel: spawn, configure, monitor AXIS agents')]));
  blocks.push(bullet([t('Real-time agent output streaming to canvas')]));
  blocks.push(bullet([t('Assessment target inventory and scope management UI')]));
  blocks.push(bullet([t('Activity Timeline (human + agent actions, unified audit log)')]));
  blocks.push(bullet([t('Approval gate for high-impact agent actions')]));

  blocks.push(h3('Sprint 3 — Agent Integration + Findings (7 stories · 23 pts)'));
  blocks.push(bullet([t('Recon Agent integration: subdomain enum, port scan, fingerprinting')]));
  blocks.push(bullet([t('Web Security Agent integration: OWASP scanning, POC capture')]));
  blocks.push(bullet([t('API Security Agent integration: REST/GraphQL fuzzing')]));
  blocks.push(bullet([t('Validation Agent: de-duplicate and confirm agent findings')]));
  blocks.push(bullet([t('Relay Issues: auto-ingest from agent discoveries')]));
  blocks.push(bullet([t('CVSS scoring, severity classification, remediation assignment')]));
  blocks.push(bullet([t('Finding detail view with evidence, steps to reproduce, and fix guidance')]));

  blocks.push(h3('Sprint 4 — Reporting + Demo Polish (6 stories · 17 pts)'));
  blocks.push(bullet([t('Reporting Agent: executive summary + technical findings synthesis')]));
  blocks.push(bullet([t('Report export: PDF and Markdown formats')]));
  blocks.push(bullet([t('Demo environment: seeded data, scripted scenario for Project Sentinel')]));
  blocks.push(bullet([t('Performance audit and WebSocket stability hardening')]));
  blocks.push(bullet([t('Role-adaptive UI final polish (Pentester / Dev / Manager views)')]));
  blocks.push(bullet([t('End-to-end Prototype 001 demo flow validation')]));
  blocks.push(divider());

  // ── Business Model ────────────────────────────────────────────────────────
  blocks.push(h2('Business Model'));

  blocks.push(h3('Subscription Tiers'));
  blocks.push(table([
    ['Tier', 'Target', 'Includes', 'Price (est.)'],
    ['Starter', 'Solo pentester / freelancer', '1 workspace, 2 seats, 10 agent credits/mo', '$99/mo'],
    ['Professional', 'Small security team', '3 workspaces, 10 seats, 100 agent credits/mo', '$499/mo'],
    ['Enterprise', 'Security firm / large org', 'Unlimited workspaces, SSO, custom agents, SLA', 'Custom'],
  ]));

  blocks.push(h3('Agent Execution Metering'));
  blocks.push(p([t('Agent credits are consumed per task execution. Starter plans include a monthly allotment; heavy users can purchase additional credits. This creates a usage-based revenue layer on top of the subscription base.')]));

  blocks.push(h3('Future: Agent Marketplace'));
  blocks.push(p([t('Community and vendor agents will be installable into Relay Workspaces. HLN takes a revenue share on marketplace agent usage. This mirrors the Figma plugin ecosystem model applied to security tooling.')]));
  blocks.push(divider());

  // ── Prototype 001 — Project Sentinel ──────────────────────────────────────
  blocks.push(h2('Prototype 001 — Project Sentinel'));
  blocks.push(p([italic('The first end-to-end demo scenario validating Relay Workspace 001.')]));
  blocks.push(p([t('Demo flow: '), bold('2 engineers + 1 ARIA AXIS agent'), t(' conducting a collaborative web application assessment in a single Relay session.')]));

  blocks.push(h3('Demo Flow'));
  blocks.push(bullet([t('Engineer A creates a Relay session and defines the target scope (demo app URL)')]));
  blocks.push(bullet([t('Engineer B joins via invite link — live presence appears on canvas')]));
  blocks.push(bullet([t('Engineer A spawns the Recon Agent from Agent Studio')]));
  blocks.push(bullet([t('Recon Agent streams asset discovery results to the shared canvas in real time')]));
  blocks.push(bullet([t('Engineer B spawns the Web Security Agent targeting a discovered endpoint')]));
  blocks.push(bullet([t('Web Security Agent finds a simulated vulnerability — auto-creates a Relay Issue')]));
  blocks.push(bullet([t('Both engineers annotate the finding; Validation Agent confirms and scores it')]));
  blocks.push(bullet([t('Reporting Agent generates a PDF executive summary with one click')]));

  blocks.push(h3('Success Criteria'));
  blocks.push(bullet([t('Two engineers can join a single Relay workspace from separate browsers with live presence')]));
  blocks.push(bullet([t('An ARIA AXIS agent can be spawned from the Agent Studio and executes against a target')]));
  blocks.push(bullet([t('Agent output streams to the shared canvas within 2 seconds of generation')]));
  blocks.push(bullet([t('A finding discovered by an agent auto-creates a Relay Issue with correct metadata')]));
  blocks.push(bullet([t('Engineers can annotate, assign, and update Relay Issues in real time')]));
  blocks.push(bullet([t('The Activity Timeline shows a complete interleaved log of engineer and agent actions')]));
  blocks.push(bullet([t('The Reporting Agent produces a coherent executive PDF from the session findings')]));
  blocks.push(bullet([t('The full demo scenario runs end-to-end without manual data entry or page refreshes')]));
  blocks.push(divider());

  // ── Product Identity ──────────────────────────────────────────────────────
  blocks.push(h2('Product Identity'));
  blocks.push(table([
    ['Attribute', 'Value'],
    ['Product Name', 'HLN Relay'],
    ['Brand Name', 'Relay by Hidden Leaf Networks'],
    ['Technology', 'ARIA AXIS'],
    ['Positioning', 'Collaborative, AI-native cybersecurity SaaS'],
    ['Primary Market', 'Cybersecurity / Penetration Testing'],
    ['Secondary Market', 'QA, regression testing, security automation'],
    ['Category', 'Security SaaS / AI-Augmented Security Tooling'],
    ['Persona', 'Security engineers who collaborate in teams and want AI execution, not AI chatbots'],
  ]));
  blocks.push(divider());

  // ── Competitive Landscape ─────────────────────────────────────────────────
  blocks.push(h2('Competitive Landscape'));
  blocks.push(table([
    ['Competitor', 'Strength', 'Gap Relay Fills'],
    ['Aikido Security', 'Developer-friendly SAST/SCA, clean UX', 'Collaboration gap — single-user feel; no real-time multi-engineer sessions'],
    ['Horizon AI', 'AI-driven attack surface management', 'Collaboration-weak; no shared workspace; agents not visible to the team'],
    ['NodeZero (Horizon3)', 'Autonomous pentesting, infrastructure-strong', 'No collaborative layer; report-only output; no live shared session model'],
    ['Pentera', 'Automated pentesting at scale', 'Closed-system; no agent studio; no human-in-the-loop collaboration surface'],
    ['HLN Relay', 'Collaboration-first + ARIA AXIS agents', 'Fills the gap: real-time team workspace + autonomous agents as first-class participants'],
  ]));
  blocks.push(divider());

  // ── Footer ────────────────────────────────────────────────────────────────
  blocks.push(p([italic('HLN Relay — Product Specification · Hidden Leaf Networks · ARIA AXIS Platform')]));
  blocks.push(p([t('Internal document. For external positioning, see brand guidelines.')]));

  return blocks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== HLN Relay — Notion Page Creator ===\n');

  const blocks = buildRelayBlocks();
  console.log(`Built ${blocks.length} blocks for the product spec.\n`);

  let pageId: string;
  try {
    pageId = await createPage('HLN Relay — Product Specification', blocks);
  } catch (e: any) {
    console.error('Failed to create page:', e.message);
    process.exit(1);
  }

  const pageUrl = `https://www.notion.so/${pageId.replace(/-/g, '')}`;
  console.log('\n=== Done ===');
  console.log(`Page ID:  ${pageId}`);
  console.log(`Page URL: ${pageUrl}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
