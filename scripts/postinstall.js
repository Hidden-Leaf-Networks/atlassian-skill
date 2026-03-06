#!/usr/bin/env node
/**
 * postinstall hook — auto-injects Atlassian skill context into the
 * consuming project's CLAUDE.md so Claude Code picks it up immediately.
 *
 * Safe to re-run: skips if the section already exists.
 * Only runs when installed as a dependency (not during local dev).
 */

const fs = require('fs');
const path = require('path');

const MARKER = '<!-- @hidden-leaf/atlassian-skill -->';

const SNIPPET = `
${MARKER}
## Atlassian Integration

This project uses \`@hidden-leaf/atlassian-skill\` for Jira, Confluence, and Bitbucket operations.

**Setup:** Credentials in \`.env\` — needs \`ATLASSIAN_CLOUD_ID\`, \`ATLASSIAN_SITE_URL\`, \`ATLASSIAN_USER_EMAIL\`, \`ATLASSIAN_API_TOKEN\`.
See node_modules/@hidden-leaf/atlassian-skill/.env.example for all options.

**Skill reference:** See node_modules/@hidden-leaf/atlassian-skill/SKILL.md for the full API.

**Quick patterns:**
\`\`\`typescript
import { createJiraClientFromEnv, jql, adf, text } from '@hidden-leaf/atlassian-skill';
const jira = createJiraClientFromEnv();

// Search: jira.searchIssues({ jql: jql().equals('project', 'PROJ').build() })
// Create: jira.createIssue({ project: 'PROJ', issuetype: 'Task', summary: '...' })
// Transition: jira.transitionIssue('PROJ-123', { transitionId: '...' })
// Comment: jira.addComment('PROJ-123', { body: adf().paragraph('text').build() })
\`\`\`
<!-- /@hidden-leaf/atlassian-skill -->
`.trimStart();

function findProjectRoot() {
  // Walk up from node_modules/@hidden-leaf/atlassian-skill/scripts/
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    dir = path.dirname(dir);
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, 'utf8'));
        // Don't modify our own repo
        if (json.name === '@hidden-leaf/atlassian-skill') continue;
        return dir;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function run() {
  // Skip during local development (npm install in the skill repo itself)
  const ownPkg = path.resolve(__dirname, '..', 'package.json');
  if (fs.existsSync(ownPkg)) {
    try {
      const json = JSON.parse(fs.readFileSync(ownPkg, 'utf8'));
      if (json.name === '@hidden-leaf/atlassian-skill') {
        // Check if we're in node_modules (installed as dep) or at repo root (local dev)
        if (!__dirname.includes('node_modules')) return;
      }
    } catch {
      // continue
    }
  }

  const root = findProjectRoot();
  if (!root) return;

  const claudeMd = path.join(root, 'CLAUDE.md');

  if (fs.existsSync(claudeMd)) {
    const existing = fs.readFileSync(claudeMd, 'utf8');
    if (existing.includes(MARKER)) {
      // Already injected — skip
      return;
    }
    // Append to existing CLAUDE.md
    fs.writeFileSync(claudeMd, existing.trimEnd() + '\n\n' + SNIPPET);
    console.log('[@hidden-leaf/atlassian-skill] Added Atlassian integration section to CLAUDE.md');
  } else {
    // Create new CLAUDE.md
    fs.writeFileSync(claudeMd, SNIPPET);
    console.log('[@hidden-leaf/atlassian-skill] Created CLAUDE.md with Atlassian integration');
  }

  // Copy .env.example if no .env exists
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) {
    const envExample = path.resolve(__dirname, '..', '.env.example');
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      console.log('[@hidden-leaf/atlassian-skill] Created .env from template — fill in your Atlassian credentials');
    }
  }
}

try {
  run();
} catch {
  // postinstall should never break npm install
}
