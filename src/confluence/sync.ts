/**
 * @fileoverview Documentation synchronization module for Confluence.
 * Provides utilities to sync local documentation to Confluence pages.
 * @module confluence/sync
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfluenceClient } from './client.js';
import { PageService } from './pages.js';
import type {
  ADFDocument,
  ADFNode,
  SyncOptions,
  SyncResult,
  PageSyncInfo,
} from './types.js';

// ============================================================================
// Markdown to ADF Converter
// ============================================================================

/**
 * Converts Markdown content to Atlassian Document Format (ADF).
 *
 * @example
 * ```typescript
 * const converter = new MarkdownToADFConverter();
 * const adf = converter.convert('# Hello World\n\nThis is **bold** text.');
 * ```
 */
export class MarkdownToADFConverter {
  /**
   * Converts Markdown content to ADF document.
   * @param markdown - Markdown content
   * @returns ADF document
   */
  convert(markdown: string): ADFDocument {
    const lines = markdown.split('\n');
    const content: ADFNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        content.push(this.createHeading(headingMatch[2], headingMatch[1].length));
        i++;
        continue;
      }

      // Code blocks
      if (line.startsWith('```')) {
        const { node, endIndex } = this.parseCodeBlock(lines, i);
        content.push(node);
        i = endIndex + 1;
        continue;
      }

      // Blockquotes
      if (line.startsWith('>')) {
        const { node, endIndex } = this.parseBlockquote(lines, i);
        content.push(node);
        i = endIndex + 1;
        continue;
      }

      // Unordered lists
      if (line.match(/^[\s]*[-*+]\s/)) {
        const { node, endIndex } = this.parseUnorderedList(lines, i);
        content.push(node);
        i = endIndex + 1;
        continue;
      }

      // Ordered lists
      if (line.match(/^[\s]*\d+\.\s/)) {
        const { node, endIndex } = this.parseOrderedList(lines, i);
        content.push(node);
        i = endIndex + 1;
        continue;
      }

      // Horizontal rule
      if (line.match(/^[-*_]{3,}$/)) {
        content.push({ type: 'rule' });
        i++;
        continue;
      }

      // Default: paragraph
      const { node, endIndex } = this.parseParagraph(lines, i);
      content.push(node);
      i = endIndex + 1;
    }

    return {
      version: 1,
      type: 'doc',
      content,
    };
  }

  /**
   * Creates a heading node.
   */
  private createHeading(text: string, level: number): ADFNode {
    return {
      type: 'heading',
      attrs: { level },
      content: this.parseInlineContent(text),
    };
  }

  /**
   * Parses a code block.
   */
  private parseCodeBlock(
    lines: string[],
    startIndex: number
  ): { node: ADFNode; endIndex: number } {
    const firstLine = lines[startIndex];
    const language = firstLine.slice(3).trim() || undefined;
    const codeLines: string[] = [];
    let i = startIndex + 1;

    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }

    return {
      node: {
        type: 'codeBlock',
        attrs: language ? { language } : undefined,
        content: [
          {
            type: 'text',
            text: codeLines.join('\n'),
          },
        ],
      },
      endIndex: i,
    };
  }

  /**
   * Parses a blockquote.
   */
  private parseBlockquote(
    lines: string[],
    startIndex: number
  ): { node: ADFNode; endIndex: number } {
    const quoteLines: string[] = [];
    let i = startIndex;

    while (i < lines.length && lines[i].startsWith('>')) {
      quoteLines.push(lines[i].slice(1).trim());
      i++;
    }

    return {
      node: {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: this.parseInlineContent(quoteLines.join(' ')),
          },
        ],
      },
      endIndex: i - 1,
    };
  }

  /**
   * Parses an unordered list.
   */
  private parseUnorderedList(
    lines: string[],
    startIndex: number
  ): { node: ADFNode; endIndex: number } {
    const items: ADFNode[] = [];
    let i = startIndex;

    while (i < lines.length && lines[i].match(/^[\s]*[-*+]\s/)) {
      const text = lines[i].replace(/^[\s]*[-*+]\s/, '');
      items.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: this.parseInlineContent(text),
          },
        ],
      });
      i++;
    }

    return {
      node: {
        type: 'bulletList',
        content: items,
      },
      endIndex: i - 1,
    };
  }

  /**
   * Parses an ordered list.
   */
  private parseOrderedList(
    lines: string[],
    startIndex: number
  ): { node: ADFNode; endIndex: number } {
    const items: ADFNode[] = [];
    let i = startIndex;

    while (i < lines.length && lines[i].match(/^[\s]*\d+\.\s/)) {
      const text = lines[i].replace(/^[\s]*\d+\.\s/, '');
      items.push({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: this.parseInlineContent(text),
          },
        ],
      });
      i++;
    }

    return {
      node: {
        type: 'orderedList',
        content: items,
      },
      endIndex: i - 1,
    };
  }

  /**
   * Parses a paragraph (can span multiple lines until empty line).
   */
  private parseParagraph(
    lines: string[],
    startIndex: number
  ): { node: ADFNode; endIndex: number } {
    const paragraphLines: string[] = [];
    let i = startIndex;

    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('>') &&
      !lines[i].match(/^[\s]*[-*+]\s/) &&
      !lines[i].match(/^[\s]*\d+\.\s/) &&
      !lines[i].match(/^[-*_]{3,}$/)
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    return {
      node: {
        type: 'paragraph',
        content: this.parseInlineContent(paragraphLines.join(' ')),
      },
      endIndex: i - 1,
    };
  }

  /**
   * Parses inline content (bold, italic, code, links).
   */
  private parseInlineContent(text: string): ADFNode[] {
    const nodes: ADFNode[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      // Links: [text](url)
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        nodes.push({
          type: 'text',
          text: linkMatch[1],
          marks: [{ type: 'link', attrs: { href: linkMatch[2] } }],
        });
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      // Inline code: `code`
      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        nodes.push({
          type: 'text',
          text: codeMatch[1],
          marks: [{ type: 'code' }],
        });
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      // Bold: **text** or __text__
      const boldMatch = remaining.match(/^(\*\*|__)([^*_]+)(\*\*|__)/);
      if (boldMatch) {
        nodes.push({
          type: 'text',
          text: boldMatch[2],
          marks: [{ type: 'strong' }],
        });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *text* or _text_
      const italicMatch = remaining.match(/^(\*|_)([^*_]+)(\*|_)/);
      if (italicMatch) {
        nodes.push({
          type: 'text',
          text: italicMatch[2],
          marks: [{ type: 'em' }],
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Strikethrough: ~~text~~
      const strikeMatch = remaining.match(/^~~([^~]+)~~/);
      if (strikeMatch) {
        nodes.push({
          type: 'text',
          text: strikeMatch[1],
          marks: [{ type: 'strike' }],
        });
        remaining = remaining.slice(strikeMatch[0].length);
        continue;
      }

      // Plain text up to next special character
      const plainMatch = remaining.match(/^[^[\]`*_~]+/);
      if (plainMatch) {
        nodes.push({
          type: 'text',
          text: plainMatch[0],
        });
        remaining = remaining.slice(plainMatch[0].length);
        continue;
      }

      // Single special character
      nodes.push({
        type: 'text',
        text: remaining[0],
      });
      remaining = remaining.slice(1);
    }

    return nodes;
  }
}

// ============================================================================
// Documentation Sync Service
// ============================================================================

/**
 * Default sync options.
 */
const DEFAULT_SYNC_OPTIONS: Required<SyncOptions> = {
  createIfNotExists: true,
  updateExisting: true,
  parentId: undefined as unknown as string,
  labels: [],
  recursive: true,
  includeExtensions: ['.md', '.mdx'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build'],
};

/**
 * Service for synchronizing local documentation to Confluence.
 *
 * @example
 * ```typescript
 * const syncService = new DocumentationSyncService(client);
 *
 * // Sync README.md to Confluence
 * const result = await syncService.syncReadmeToConfluence('/path/to/repo', 'space-id');
 *
 * // Sync entire docs directory
 * const dirResult = await syncService.syncDirectoryToConfluence('/path/to/docs', 'space-id');
 * ```
 */
export class DocumentationSyncService {
  private readonly pageService: PageService;
  private readonly converter: MarkdownToADFConverter;

  /**
   * Creates a new DocumentationSyncService instance.
   * @param client - Confluence client instance
   */
  constructor(client: ConfluenceClient) {
    this.pageService = new PageService(client);
    this.converter = new MarkdownToADFConverter();
  }

  /**
   * Syncs a README.md file from a repository to Confluence.
   * @param repoPath - Path to the repository root
   * @param spaceId - Target Confluence space ID
   * @param parentId - Optional parent page ID
   * @returns Sync result
   *
   * @example
   * ```typescript
   * const result = await syncService.syncReadmeToConfluence(
   *   '/home/user/my-project',
   *   'space-id',
   *   'parent-page-id'
   * );
   *
   * if (result.success) {
   *   console.log('README synced successfully');
   *   console.log('Page URL:', result.created[0]?.webUrl || result.updated[0]?.webUrl);
   * }
   * ```
   */
  async syncReadmeToConfluence(
    repoPath: string,
    spaceId: string,
    parentId?: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      created: [],
      updated: [],
      skipped: [],
      errors: [],
    };

    // Find README file
    const readmePath = this.findReadme(repoPath);
    if (!readmePath) {
      result.success = false;
      result.errors.push({
        localPath: repoPath,
        message: 'No README.md found in repository',
        code: 'README_NOT_FOUND',
      });
      return result;
    }

    try {
      // Read and convert README
      const content = fs.readFileSync(readmePath, 'utf-8');
      const adf = this.converter.convert(content);

      // Extract title from first heading or use filename
      const title = this.extractTitle(content) || 'README';

      // Check if page exists
      const existingPage = await this.pageService.findPageByTitle(spaceId, title);

      if (existingPage) {
        // Update existing page
        const updated = await this.pageService.updatePage({
          pageId: existingPage.id,
          title,
          body: adf,
          versionMessage: 'Synced from repository README',
        });

        result.updated.push({
          localPath: readmePath,
          pageId: updated.id,
          title: updated.title,
          webUrl: updated._links?.webui,
        });
      } else {
        // Create new page
        const created = await this.pageService.createPage({
          spaceId,
          title,
          body: adf,
          parentId,
        });

        result.created.push({
          localPath: readmePath,
          pageId: created.id,
          title: created.title,
          webUrl: created._links?.webui,
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        localPath: readmePath,
        message: error instanceof Error ? error.message : String(error),
        code: 'SYNC_ERROR',
      });
    }

    return result;
  }

  /**
   * Syncs a directory of documentation files to Confluence.
   * Maintains the directory hierarchy as page hierarchy.
   * @param localPath - Path to the documentation directory
   * @param spaceId - Target Confluence space ID
   * @param options - Sync options
   * @returns Sync result
   *
   * @example
   * ```typescript
   * const result = await syncService.syncDirectoryToConfluence(
   *   '/home/user/project/docs',
   *   'space-id',
   *   {
   *     recursive: true,
   *     labels: ['auto-synced', 'documentation'],
   *     excludeDirs: ['internal', 'drafts'],
   *   }
   * );
   *
   * console.log(`Created: ${result.created.length}`);
   * console.log(`Updated: ${result.updated.length}`);
   * console.log(`Errors: ${result.errors.length}`);
   * ```
   */
  async syncDirectoryToConfluence(
    localPath: string,
    spaceId: string,
    options?: SyncOptions
  ): Promise<SyncResult> {
    const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

    const result: SyncResult = {
      success: true,
      created: [],
      updated: [],
      skipped: [],
      errors: [],
    };

    // Verify directory exists
    if (!fs.existsSync(localPath)) {
      result.success = false;
      result.errors.push({
        localPath,
        message: 'Directory does not exist',
        code: 'DIR_NOT_FOUND',
      });
      return result;
    }

    // Get all documentation files
    const files = this.getDocumentationFiles(localPath, opts);

    if (files.length === 0) {
      result.skipped.push({
        localPath,
        pageId: '',
        title: 'No files found',
      });
      return result;
    }

    // Create a mapping for page hierarchy
    const pageMap = new Map<string, string>(); // localPath -> pageId

    // Sort files by depth to ensure parents are created first
    files.sort((a, b) => {
      const depthA = a.relativePath.split(path.sep).length;
      const depthB = b.relativePath.split(path.sep).length;
      return depthA - depthB;
    });

    for (const file of files) {
      try {
        const syncInfo = await this.syncFile(file, spaceId, opts, pageMap);

        if (syncInfo.action === 'created') {
          result.created.push(syncInfo.info);
        } else if (syncInfo.action === 'updated') {
          result.updated.push(syncInfo.info);
        } else {
          result.skipped.push(syncInfo.info);
        }

        // Store page ID for child pages to reference
        pageMap.set(file.absolutePath, syncInfo.info.pageId);
      } catch (error) {
        result.success = false;
        result.errors.push({
          localPath: file.absolutePath,
          message: error instanceof Error ? error.message : String(error),
          code: 'SYNC_ERROR',
        });
      }
    }

    return result;
  }

  /**
   * Syncs a single file to Confluence.
   */
  private async syncFile(
    file: DocumentationFile,
    spaceId: string,
    options: Required<SyncOptions>,
    pageMap: Map<string, string>
  ): Promise<{ action: 'created' | 'updated' | 'skipped'; info: PageSyncInfo }> {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    const adf = this.converter.convert(content);
    const title = this.extractTitle(content) || file.name;

    // Determine parent page ID
    let parentId = options.parentId;
    if (file.parentPath) {
      const parentPageId = pageMap.get(file.parentPath);
      if (parentPageId) {
        parentId = parentPageId;
      }
    }

    // Check if page exists
    const existingPage = await this.pageService.findPageByTitle(spaceId, title);

    if (existingPage) {
      if (!options.updateExisting) {
        return {
          action: 'skipped',
          info: {
            localPath: file.absolutePath,
            pageId: existingPage.id,
            title: existingPage.title,
            webUrl: existingPage._links?.webui,
          },
        };
      }

      const updated = await this.pageService.updatePage({
        pageId: existingPage.id,
        title,
        body: adf,
        versionMessage: `Synced from ${file.relativePath}`,
      });

      return {
        action: 'updated',
        info: {
          localPath: file.absolutePath,
          pageId: updated.id,
          title: updated.title,
          webUrl: updated._links?.webui,
        },
      };
    }

    if (!options.createIfNotExists) {
      return {
        action: 'skipped',
        info: {
          localPath: file.absolutePath,
          pageId: '',
          title,
        },
      };
    }

    const created = await this.pageService.createPage({
      spaceId,
      title,
      body: adf,
      parentId,
    });

    return {
      action: 'created',
      info: {
        localPath: file.absolutePath,
        pageId: created.id,
        title: created.title,
        webUrl: created._links?.webui,
      },
    };
  }

  /**
   * Gets all documentation files from a directory.
   */
  private getDocumentationFiles(
    dirPath: string,
    options: Required<SyncOptions>,
    basePath?: string,
    parentPath?: string
  ): DocumentationFile[] {
    const files: DocumentationFile[] = [];
    const base = basePath ?? dirPath;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(base, fullPath);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (options.excludeDirs.includes(entry.name)) {
          continue;
        }

        // Check for index file in directory
        const indexFile = this.findIndexFile(fullPath, options.includeExtensions);
        if (indexFile) {
          files.push({
            absolutePath: indexFile,
            relativePath: path.relative(base, indexFile),
            name: entry.name,
            parentPath,
          });
        }

        // Recursively process subdirectory
        if (options.recursive) {
          const subFiles = this.getDocumentationFiles(
            fullPath,
            options,
            base,
            indexFile ?? fullPath
          );
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (options.includeExtensions.includes(ext)) {
          // Skip index files (already handled with directories)
          if (this.isIndexFile(entry.name)) {
            continue;
          }

          files.push({
            absolutePath: fullPath,
            relativePath,
            name: path.basename(entry.name, ext),
            parentPath,
          });
        }
      }
    }

    return files;
  }

  /**
   * Finds a README file in a directory.
   */
  private findReadme(dirPath: string): string | null {
    const candidates = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const candidate of candidates) {
      const fullPath = path.join(dirPath, candidate);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Finds an index file in a directory.
   */
  private findIndexFile(dirPath: string, extensions: string[]): string | null {
    for (const ext of extensions) {
      for (const name of ['index', 'INDEX', 'README', 'readme']) {
        const fullPath = path.join(dirPath, name + ext);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
    return null;
  }

  /**
   * Checks if a filename is an index file.
   */
  private isIndexFile(filename: string): boolean {
    const name = path.basename(filename, path.extname(filename)).toLowerCase();
    return ['index', 'readme'].includes(name);
  }

  /**
   * Extracts the title from markdown content.
   */
  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a documentation file to sync.
 */
interface DocumentationFile {
  /** Absolute path to the file */
  absolutePath: string;
  /** Relative path from the docs root */
  relativePath: string;
  /** File name without extension (used as page title) */
  name: string;
  /** Path to parent file (for hierarchy) */
  parentPath?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a DocumentationSyncService from a Confluence client.
 * @param client - Confluence client
 * @returns DocumentationSyncService instance
 */
export function createSyncService(client: ConfluenceClient): DocumentationSyncService {
  return new DocumentationSyncService(client);
}

/**
 * Creates a MarkdownToADFConverter instance.
 * @returns MarkdownToADFConverter instance
 */
export function createMarkdownConverter(): MarkdownToADFConverter {
  return new MarkdownToADFConverter();
}
