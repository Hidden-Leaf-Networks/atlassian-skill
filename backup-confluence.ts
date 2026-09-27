import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Load .env manually (dotenv may not be available as a direct dep)
const envPath = path.join(__dirname, '.env');
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

const BACKUP_DIR = '/mnt/fast-data/Projects/hidden-leaf/confluence-backup';
const BASE_URL = 'https://hiddenleafnetworks.atlassian.net';
const EMAIL = (process.env.ATLASSIAN_EMAIL || process.env.ATLASSIAN_USER_EMAIL)!;
const TOKEN = process.env.ATLASSIAN_API_TOKEN!;
const DELAY_MS = 300;

if (!EMAIL || !TOKEN) {
  console.error('Missing ATLASSIAN_EMAIL or ATLASSIAN_API_TOKEN');
  process.exit(1);
}

const AUTH = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const mod = fullUrl.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };
    mod.get(fullUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${fullUrl}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error for ${fullUrl}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'untitled';
}

// Basic HTML to Markdown conversion
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Remove style/script tags
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Bold / italic
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]+alt="([^"]*)"[^>]+src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n');
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n');

  // Tables - convert thead rows to header + separator
  md = md.replace(/<thead[^>]*>([\s\S]*?)<\/thead>/gi, (_, thead) => {
    const headerRow = thead.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| $1 ')
                           .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '$1|\n');
    const colCount = (headerRow.match(/\|/g) || []).length - 1;
    const sep = '|' + ' --- |'.repeat(Math.max(colCount, 1)) + '\n';
    return headerRow + sep;
  });
  md = md.replace(/<tbody[^>]*>/gi, '');
  md = md.replace(/<\/tbody>/gi, '');
  md = md.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| $1 ');
  md = md.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '| $1 ');
  md = md.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '$1|\n');
  md = md.replace(/<table[^>]*>/gi, '\n');
  md = md.replace(/<\/table>/gi, '\n');

  // Line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n');

  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&mdash;/g, '—');
  md = md.replace(/&ndash;/g, '–');
  md = md.replace(/&hellip;/g, '...');
  md = md.replace(/&rsquo;/g, '\u2019');
  md = md.replace(/&lsquo;/g, '\u2018');
  md = md.replace(/&rdquo;/g, '\u201D');
  md = md.replace(/&ldquo;/g, '\u201C');
  md = md.replace(/&#\d+;/g, (m) => {
    const code = parseInt(m.slice(2, -1));
    return code > 0 ? String.fromCharCode(code) : m;
  });

  // Clean up excessive blank lines
  md = md.replace(/\n{4,}/g, '\n\n\n');

  return md.trim();
}

// Confluence ADF (Atlas Doc Format) to plain text (best effort)
function adfToText(adf: any): string {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;

  let text = '';
  if (adf.type === 'text') return adf.text || '';

  if (adf.content && Array.isArray(adf.content)) {
    for (const child of adf.content) {
      const childText = adfToText(child);
      if (adf.type === 'paragraph') {
        text += childText + '\n\n';
      } else if (adf.type === 'heading') {
        const level = adf.attrs?.level || 1;
        text += '#'.repeat(level) + ' ' + childText + '\n\n';
      } else if (adf.type === 'bulletList' || adf.type === 'orderedList') {
        text += childText;
      } else if (adf.type === 'listItem') {
        text += '- ' + childText + '\n';
      } else if (adf.type === 'codeBlock') {
        text += '```\n' + childText + '\n```\n\n';
      } else if (adf.type === 'blockquote') {
        text += '> ' + childText + '\n\n';
      } else {
        text += childText;
      }
    }
  }
  return text;
}

interface SpaceMeta {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
}

interface PageMeta {
  id: string;
  title: string;
  spaceKey: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  parentId?: string;
  version?: number;
}

async function fetchAllSpaces(): Promise<SpaceMeta[]> {
  const spaces: SpaceMeta[] = [];
  let cursor: string | null = null;

  console.log('Fetching spaces...');
  do {
    const url = cursor
      ? `/wiki/api/v2/spaces?limit=50&cursor=${encodeURIComponent(cursor)}`
      : `/wiki/api/v2/spaces?limit=50`;

    const data = await fetchJson(url);
    await sleep(DELAY_MS);

    if (data.results) {
      for (const s of data.results) {
        spaces.push({
          id: s.id,
          key: s.key,
          name: s.name,
          type: s.type,
          status: s.status,
        });
      }
    }

    cursor = null;
    if (data._links?.next) {
      // Extract cursor from next link
      const nextUrl = data._links.next;
      const match = nextUrl.match(/cursor=([^&]+)/);
      if (match) cursor = decodeURIComponent(match[1]);
    }
  } while (cursor);

  return spaces;
}

async function fetchAllPagesForSpace(spaceId: string, spaceKey: string): Promise<PageMeta[]> {
  const pages: PageMeta[] = [];
  let cursor: string | null = null;

  do {
    const url = cursor
      ? `/wiki/api/v2/spaces/${spaceId}/pages?limit=50&cursor=${encodeURIComponent(cursor)}&body-format=storage`
      : `/wiki/api/v2/spaces/${spaceId}/pages?limit=50&body-format=storage`;

    let data: any;
    try {
      data = await fetchJson(url);
    } catch (e: any) {
      console.error(`  Error fetching pages for space ${spaceKey}: ${e.message}`);
      break;
    }
    await sleep(DELAY_MS);

    if (data.results) {
      for (const p of data.results) {
        pages.push({
          id: p.id,
          title: p.title,
          spaceKey,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.version?.createdAt,
          parentId: p.parentId,
          version: p.version?.number,
        });
      }
    }

    cursor = null;
    if (data._links?.next) {
      const nextUrl = data._links.next;
      const match = nextUrl.match(/cursor=([^&]+)/);
      if (match) cursor = decodeURIComponent(match[1]);
    }
  } while (cursor);

  return pages;
}

async function fetchPageBody(pageId: string): Promise<{ storage?: string; adf?: any }> {
  const result: { storage?: string; adf?: any } = {};

  // Fetch storage format
  try {
    const data = await fetchJson(`/wiki/api/v2/pages/${pageId}?body-format=storage`);
    await sleep(DELAY_MS);
    result.storage = data.body?.storage?.value || '';
  } catch (e: any) {
    console.error(`    Warning: Could not fetch storage body for page ${pageId}: ${e.message}`);
  }

  return result;
}

async function backupSpace(space: SpaceMeta): Promise<number> {
  const spaceDir = path.join(BACKUP_DIR, space.key);
  const rawDir = path.join(spaceDir, '_raw');
  fs.mkdirSync(spaceDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  console.log(`\nSpace: ${space.key} (${space.name})`);
  const pages = await fetchAllPagesForSpace(space.id, space.key);
  console.log(`  Found ${pages.length} pages`);

  const index: PageMeta[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    console.log(`  [${i + 1}/${pages.length}] ${page.title}`);

    const body = await fetchPageBody(page.id);
    const sanitized = sanitizeFilename(page.title);

    // Save raw HTML
    if (body.storage) {
      const htmlPath = path.join(rawDir, `${sanitized}.html`);
      fs.writeFileSync(htmlPath, body.storage, 'utf-8');
    }

    // Convert to markdown
    const mdContent = body.storage ? htmlToMarkdown(body.storage) : '';

    const frontmatter = [
      '---',
      `id: "${page.id}"`,
      `title: "${page.title.replace(/"/g, '\\"')}"`,
      `spaceKey: "${page.spaceKey}"`,
      `status: "${page.status || ''}"`,
      `createdAt: "${page.createdAt || ''}"`,
      `updatedAt: "${page.updatedAt || ''}"`,
      `parentId: "${page.parentId || ''}"`,
      `version: ${page.version || 1}`,
      '---',
      '',
      `# ${page.title}`,
      '',
    ].join('\n');

    const mdPath = path.join(spaceDir, `${sanitized}.md`);
    fs.writeFileSync(mdPath, frontmatter + mdContent, 'utf-8');

    index.push(page);
  }

  // Write space index
  const indexPath = path.join(spaceDir, '_index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ space, pages: index }, null, 2), 'utf-8');

  return pages.length;
}

async function main() {
  console.log('=== Confluence Backup ===');
  console.log(`Backup dir: ${BACKUP_DIR}`);
  console.log(`Auth: ${EMAIL}`);
  console.log('');

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const spaces = await fetchAllSpaces();
  console.log(`Found ${spaces.length} spaces: ${spaces.map(s => s.key).join(', ')}`);

  const manifest: any = {
    backupTimestamp: new Date().toISOString(),
    spaces: [],
    totalPages: 0,
  };

  for (const space of spaces) {
    const count = await backupSpace(space);
    manifest.spaces.push({
      id: space.id,
      key: space.key,
      name: space.name,
      type: space.type,
      status: space.status,
      pageCount: count,
    });
    manifest.totalPages += count;
  }

  const manifestPath = path.join(BACKUP_DIR, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log('\n=== Backup Complete ===');
  console.log(`Spaces: ${manifest.spaces.length}`);
  console.log(`Total pages: ${manifest.totalPages}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
