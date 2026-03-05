/**
 * Atlassian Document Format (ADF) Builder
 * Fluent API for constructing ADF documents for Jira and Confluence
 */

import { AdfDocument, AdfNode, AdfMark, AdfMarkType, AdfNodeType } from './types.js';

// ============================================================================
// ADF Builder Class
// ============================================================================

/**
 * Fluent builder for creating ADF documents
 *
 * @example
 * ```typescript
 * const doc = new AdfBuilder()
 *   .heading(2, 'Summary')
 *   .paragraph('This is a description.')
 *   .bulletList([
 *     'First item',
 *     'Second item',
 *   ])
 *   .codeBlock('const x = 1;', 'javascript')
 *   .build();
 * ```
 */
export class AdfBuilder {
  private content: AdfNode[] = [];

  /**
   * Add a paragraph with optional formatting
   */
  paragraph(text: string | TextBuilder): this {
    const textContent = typeof text === 'string'
      ? [createTextNode(text)]
      : text.build();

    this.content.push({
      type: 'paragraph',
      content: textContent,
    });

    return this;
  }

  /**
   * Add a heading (levels 1-6)
   */
  heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string | TextBuilder): this {
    const textContent = typeof text === 'string'
      ? [createTextNode(text)]
      : text.build();

    this.content.push({
      type: 'heading',
      attrs: { level },
      content: textContent,
    });

    return this;
  }

  /**
   * Add a bullet list
   */
  bulletList(items: (string | AdfNode[])[]): this {
    this.content.push({
      type: 'bulletList',
      content: items.map(item => createListItem(item)),
    });

    return this;
  }

  /**
   * Add an ordered (numbered) list
   */
  orderedList(items: (string | AdfNode[])[], start: number = 1): this {
    this.content.push({
      type: 'orderedList',
      attrs: { order: start },
      content: items.map(item => createListItem(item)),
    });

    return this;
  }

  /**
   * Add a code block
   */
  codeBlock(code: string, language?: string): this {
    this.content.push({
      type: 'codeBlock',
      attrs: language ? { language } : undefined,
      content: [createTextNode(code)],
    });

    return this;
  }

  /**
   * Add a blockquote
   */
  blockquote(text: string | TextBuilder): this {
    const textContent = typeof text === 'string'
      ? [createTextNode(text)]
      : text.build();

    this.content.push({
      type: 'blockquote',
      content: [{
        type: 'paragraph',
        content: textContent,
      }],
    });

    return this;
  }

  /**
   * Add a horizontal rule
   */
  rule(): this {
    this.content.push({ type: 'rule' });
    return this;
  }

  /**
   * Add an info panel
   */
  infoPanel(text: string | TextBuilder): this {
    return this.panel('info', text);
  }

  /**
   * Add a warning panel
   */
  warningPanel(text: string | TextBuilder): this {
    return this.panel('warning', text);
  }

  /**
   * Add an error panel
   */
  errorPanel(text: string | TextBuilder): this {
    return this.panel('error', text);
  }

  /**
   * Add a success panel
   */
  successPanel(text: string | TextBuilder): this {
    return this.panel('success', text);
  }

  /**
   * Add a note panel
   */
  notePanel(text: string | TextBuilder): this {
    return this.panel('note', text);
  }

  /**
   * Add a panel of specified type
   */
  panel(type: 'info' | 'warning' | 'error' | 'success' | 'note', text: string | TextBuilder): this {
    const textContent = typeof text === 'string'
      ? [createTextNode(text)]
      : text.build();

    this.content.push({
      type: 'panel',
      attrs: { panelType: type },
      content: [{
        type: 'paragraph',
        content: textContent,
      }],
    });

    return this;
  }

  /**
   * Add a simple table
   */
  table(headers: string[], rows: string[][]): this {
    const headerRow: AdfNode = {
      type: 'tableRow',
      content: headers.map(header => ({
        type: 'tableHeader',
        content: [{
          type: 'paragraph',
          content: [createTextNode(header)],
        }],
      } as AdfNode)),
    };

    const dataRows: AdfNode[] = rows.map(row => ({
      type: 'tableRow',
      content: row.map(cell => ({
        type: 'tableCell',
        content: [{
          type: 'paragraph',
          content: [createTextNode(cell)],
        }],
      } as AdfNode)),
    }));

    this.content.push({
      type: 'table',
      attrs: {
        isNumberColumnEnabled: false,
        layout: 'default',
      },
      content: [headerRow, ...dataRows],
    });

    return this;
  }

  /**
   * Add a mention to a user
   */
  mention(accountId: string, displayName: string): this {
    this.content.push({
      type: 'paragraph',
      content: [{
        type: 'mention',
        attrs: {
          id: accountId,
          text: `@${displayName}`,
          accessLevel: 'CONTAINER',
        },
      }],
    });

    return this;
  }

  /**
   * Add a link card (inline preview)
   */
  linkCard(url: string): this {
    this.content.push({
      type: 'paragraph',
      content: [{
        type: 'inlineCard',
        attrs: { url },
      }],
    });

    return this;
  }

  /**
   * Add raw ADF nodes
   */
  raw(nodes: AdfNode | AdfNode[]): this {
    if (Array.isArray(nodes)) {
      this.content.push(...nodes);
    } else {
      this.content.push(nodes);
    }
    return this;
  }

  /**
   * Build the final ADF document
   */
  build(): AdfDocument {
    return {
      version: 1,
      type: 'doc',
      content: this.content,
    };
  }

  /**
   * Build and return as JSON string
   */
  toJson(): string {
    return JSON.stringify(this.build());
  }
}

// ============================================================================
// Text Builder for Inline Formatting
// ============================================================================

/**
 * Builder for creating formatted inline text
 *
 * @example
 * ```typescript
 * const text = new TextBuilder()
 *   .text('Normal text ')
 *   .bold('bold text ')
 *   .italic('italic text')
 *   .build();
 * ```
 */
export class TextBuilder {
  private nodes: AdfNode[] = [];

  /**
   * Add plain text
   */
  text(content: string): this {
    this.nodes.push(createTextNode(content));
    return this;
  }

  /**
   * Add bold text
   */
  bold(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'strong' }]));
    return this;
  }

  /**
   * Add italic text
   */
  italic(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'em' }]));
    return this;
  }

  /**
   * Add strikethrough text
   */
  strike(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'strike' }]));
    return this;
  }

  /**
   * Add underlined text
   */
  underline(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'underline' }]));
    return this;
  }

  /**
   * Add inline code
   */
  code(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'code' }]));
    return this;
  }

  /**
   * Add a link
   */
  link(content: string, href: string, title?: string): this {
    const attrs: Record<string, unknown> = { href };
    if (title) {
      attrs.title = title;
    }

    this.nodes.push(createTextNode(content, [{ type: 'link', attrs }]));
    return this;
  }

  /**
   * Add colored text
   */
  colored(content: string, color: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'textColor', attrs: { color } }]));
    return this;
  }

  /**
   * Add subscript text
   */
  subscript(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'subsup', attrs: { type: 'sub' } }]));
    return this;
  }

  /**
   * Add superscript text
   */
  superscript(content: string): this {
    this.nodes.push(createTextNode(content, [{ type: 'subsup', attrs: { type: 'sup' } }]));
    return this;
  }

  /**
   * Add text with multiple marks
   */
  formatted(content: string, marks: AdfMarkType[]): this {
    this.nodes.push(createTextNode(content, marks.map(type => ({ type }))));
    return this;
  }

  /**
   * Add a hard break (line break within paragraph)
   */
  hardBreak(): this {
    this.nodes.push({ type: 'hardBreak' });
    return this;
  }

  /**
   * Build the text nodes array
   */
  build(): AdfNode[] {
    return this.nodes;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a text node with optional marks
 */
function createTextNode(text: string, marks?: AdfMark[]): AdfNode {
  const node: AdfNode = {
    type: 'text',
    text,
  };

  if (marks && marks.length > 0) {
    node.marks = marks;
  }

  return node;
}

/**
 * Create a list item node
 */
function createListItem(content: string | AdfNode[]): AdfNode {
  const paragraphContent = typeof content === 'string'
    ? [createTextNode(content)]
    : content;

  return {
    type: 'listItem',
    content: [{
      type: 'paragraph',
      content: paragraphContent,
    }],
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ADF builder
 */
export function adf(): AdfBuilder {
  return new AdfBuilder();
}

/**
 * Create a new text builder
 */
export function text(): TextBuilder {
  return new TextBuilder();
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert plain text to ADF document
 */
export function textToAdf(plainText: string): AdfDocument {
  const paragraphs = plainText.split('\n\n');
  const builder = new AdfBuilder();

  for (const para of paragraphs) {
    if (para.trim()) {
      builder.paragraph(para.trim());
    }
  }

  return builder.build();
}

/**
 * Convert markdown-like text to ADF (basic conversion)
 * Supports: **bold**, *italic*, `code`, [links](url), # headings
 */
export function markdownToAdf(markdown: string): AdfDocument {
  const builder = new AdfBuilder();
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      builder.heading(level, parseInlineFormatting(headingMatch[2]));
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      builder.codeBlock(codeLines.join('\n'), language);
      i++; // Skip closing ```
      continue;
    }

    // Bullet lists
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      builder.bulletList(items);
      continue;
    }

    // Ordered lists
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      builder.orderedList(items);
      continue;
    }

    // Blockquotes
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }
      builder.blockquote(quoteLines.join('\n'));
      continue;
    }

    // Horizontal rules
    if (line.match(/^[-*_]{3,}$/)) {
      builder.rule();
      i++;
      continue;
    }

    // Regular paragraph
    builder.paragraph(parseInlineFormatting(line));
    i++;
  }

  return builder.build();
}

/**
 * Parse inline formatting in text
 */
function parseInlineFormatting(text: string): TextBuilder {
  const builder = new TextBuilder();
  let remaining = text;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      builder.bold(boldMatch[1]);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      builder.italic(italicMatch[1]);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Code: `text`
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      builder.code(codeMatch[1]);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Link: [text](url)
    const linkMatch = remaining.match(/^\[(.+?)\]\((.+?)\)/);
    if (linkMatch) {
      builder.link(linkMatch[1], linkMatch[2]);
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text until next special character
    const plainMatch = remaining.match(/^[^*`\[]+/);
    if (plainMatch) {
      builder.text(plainMatch[0]);
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single special character (not part of formatting)
    builder.text(remaining[0]);
    remaining = remaining.slice(1);
  }

  return builder;
}

/**
 * Extract plain text from ADF document
 */
export function adfToText(doc: AdfDocument): string {
  return extractText(doc.content);
}

/**
 * Recursively extract text from ADF nodes
 */
function extractText(nodes: AdfNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (node.text) {
      parts.push(node.text);
    }

    if (node.content) {
      parts.push(extractText(node.content));
    }

    // Add spacing based on block types
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      parts.push('\n');
    }
  }

  return parts.join('').trim();
}
