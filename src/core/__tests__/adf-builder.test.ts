import {
  adf,
  text,
  textToAdf,
  markdownToAdf,
  adfToText,
} from '../adf-builder';

describe('AdfBuilder', () => {
  describe('build', () => {
    it('produces a valid ADF document structure', () => {
      const doc = adf().paragraph('Hello').build();
      expect(doc.version).toBe(1);
      expect(doc.type).toBe('doc');
      expect(doc.content).toBeInstanceOf(Array);
    });

    it('produces an empty document when nothing is added', () => {
      const doc = adf().build();
      expect(doc.content).toEqual([]);
    });
  });

  describe('paragraph', () => {
    it('creates a paragraph with plain text', () => {
      const doc = adf().paragraph('Hello world').build();
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe('paragraph');
      expect(doc.content[0].content![0].text).toBe('Hello world');
    });

    it('accepts a TextBuilder for formatted text', () => {
      const formatted = text().bold('Bold').text(' plain');
      const doc = adf().paragraph(formatted).build();
      const para = doc.content[0];
      expect(para.content).toHaveLength(2);
      expect(para.content![0].marks).toEqual([{ type: 'strong' }]);
      expect(para.content![1].text).toBe(' plain');
    });
  });

  describe('heading', () => {
    it('creates headings with correct level', () => {
      const doc = adf().heading(2, 'Title').build();
      const heading = doc.content[0];
      expect(heading.type).toBe('heading');
      expect(heading.attrs).toEqual({ level: 2 });
      expect(heading.content![0].text).toBe('Title');
    });

    it('supports levels 1 through 6', () => {
      for (const level of [1, 2, 3, 4, 5, 6] as const) {
        const doc = adf().heading(level, `H${level}`).build();
        expect(doc.content[0].attrs!.level).toBe(level);
      }
    });
  });

  describe('bulletList', () => {
    it('creates a bullet list with string items', () => {
      const doc = adf().bulletList(['Item 1', 'Item 2', 'Item 3']).build();
      const list = doc.content[0];
      expect(list.type).toBe('bulletList');
      expect(list.content).toHaveLength(3);
      expect(list.content![0].type).toBe('listItem');
      expect(list.content![0].content![0].type).toBe('paragraph');
      expect(list.content![0].content![0].content![0].text).toBe('Item 1');
    });
  });

  describe('orderedList', () => {
    it('creates an ordered list with default start', () => {
      const doc = adf().orderedList(['First', 'Second']).build();
      const list = doc.content[0];
      expect(list.type).toBe('orderedList');
      expect(list.attrs).toEqual({ order: 1 });
      expect(list.content).toHaveLength(2);
    });

    it('supports custom start number', () => {
      const doc = adf().orderedList(['A', 'B'], 5).build();
      expect(doc.content[0].attrs!.order).toBe(5);
    });
  });

  describe('codeBlock', () => {
    it('creates a code block with language', () => {
      const doc = adf().codeBlock('const x = 1;', 'javascript').build();
      const block = doc.content[0];
      expect(block.type).toBe('codeBlock');
      expect(block.attrs).toEqual({ language: 'javascript' });
      expect(block.content![0].text).toBe('const x = 1;');
    });

    it('creates a code block without language', () => {
      const doc = adf().codeBlock('hello').build();
      expect(doc.content[0].attrs).toBeUndefined();
    });
  });

  describe('table', () => {
    it('creates a table with headers and rows', () => {
      const doc = adf().table(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]).build();
      const table = doc.content[0];
      expect(table.type).toBe('table');
      expect(table.attrs).toEqual({ isNumberColumnEnabled: false, layout: 'default' });

      // Header row
      const headerRow = table.content![0];
      expect(headerRow.type).toBe('tableRow');
      expect(headerRow.content![0].type).toBe('tableHeader');
      expect(headerRow.content![0].content![0].content![0].text).toBe('Name');

      // Data rows
      const dataRow = table.content![1];
      expect(dataRow.type).toBe('tableRow');
      expect(dataRow.content![0].type).toBe('tableCell');
      expect(dataRow.content![0].content![0].content![0].text).toBe('Alice');
    });
  });

  describe('panel', () => {
    it('creates an info panel', () => {
      const doc = adf().infoPanel('Note text').build();
      const panel = doc.content[0];
      expect(panel.type).toBe('panel');
      expect(panel.attrs).toEqual({ panelType: 'info' });
      expect(panel.content![0].type).toBe('paragraph');
      expect(panel.content![0].content![0].text).toBe('Note text');
    });

    it('creates different panel types', () => {
      expect(adf().warningPanel('warn').build().content[0].attrs!.panelType).toBe('warning');
      expect(adf().errorPanel('err').build().content[0].attrs!.panelType).toBe('error');
      expect(adf().successPanel('ok').build().content[0].attrs!.panelType).toBe('success');
      expect(adf().notePanel('note').build().content[0].attrs!.panelType).toBe('note');
    });
  });

  describe('blockquote', () => {
    it('creates a blockquote', () => {
      const doc = adf().blockquote('Quoted text').build();
      const bq = doc.content[0];
      expect(bq.type).toBe('blockquote');
      expect(bq.content![0].type).toBe('paragraph');
      expect(bq.content![0].content![0].text).toBe('Quoted text');
    });
  });

  describe('rule', () => {
    it('creates a horizontal rule', () => {
      const doc = adf().rule().build();
      expect(doc.content[0].type).toBe('rule');
    });
  });

  describe('mention', () => {
    it('creates a mention node', () => {
      const doc = adf().mention('abc123', 'John Doe').build();
      const para = doc.content[0];
      expect(para.type).toBe('paragraph');
      expect(para.content![0].type).toBe('mention');
      expect(para.content![0].attrs!.id).toBe('abc123');
      expect(para.content![0].attrs!.text).toBe('@John Doe');
    });
  });

  describe('linkCard', () => {
    it('creates an inline card', () => {
      const doc = adf().linkCard('https://example.com').build();
      const para = doc.content[0];
      expect(para.content![0].type).toBe('inlineCard');
      expect(para.content![0].attrs!.url).toBe('https://example.com');
    });
  });

  describe('chaining', () => {
    it('supports fluent chaining of multiple elements', () => {
      const doc = adf()
        .heading(1, 'Title')
        .paragraph('Intro')
        .bulletList(['a', 'b'])
        .codeBlock('code()', 'python')
        .rule()
        .paragraph('End')
        .build();
      expect(doc.content).toHaveLength(6);
    });
  });

  describe('toJson', () => {
    it('returns valid JSON string', () => {
      const json = adf().paragraph('test').toJson();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.type).toBe('doc');
    });
  });

  describe('raw', () => {
    it('adds raw ADF nodes', () => {
      const doc = adf()
        .raw({ type: 'rule' })
        .build();
      expect(doc.content[0].type).toBe('rule');
    });

    it('adds array of raw nodes', () => {
      const doc = adf()
        .raw([{ type: 'rule' }, { type: 'rule' }])
        .build();
      expect(doc.content).toHaveLength(2);
    });
  });
});

describe('TextBuilder', () => {
  describe('text', () => {
    it('creates plain text node', () => {
      const nodes = text().text('Hello').build();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('text');
      expect(nodes[0].text).toBe('Hello');
      expect(nodes[0].marks).toBeUndefined();
    });
  });

  describe('bold', () => {
    it('creates bold text node', () => {
      const nodes = text().bold('Strong').build();
      expect(nodes[0].marks).toEqual([{ type: 'strong' }]);
    });
  });

  describe('italic', () => {
    it('creates italic text node', () => {
      const nodes = text().italic('Emphasis').build();
      expect(nodes[0].marks).toEqual([{ type: 'em' }]);
    });
  });

  describe('code', () => {
    it('creates inline code text node', () => {
      const nodes = text().code('let x').build();
      expect(nodes[0].marks).toEqual([{ type: 'code' }]);
      expect(nodes[0].text).toBe('let x');
    });
  });

  describe('link', () => {
    it('creates a link text node', () => {
      const nodes = text().link('Click', 'https://example.com').build();
      expect(nodes[0].marks).toEqual([
        { type: 'link', attrs: { href: 'https://example.com' } },
      ]);
      expect(nodes[0].text).toBe('Click');
    });

    it('supports optional title', () => {
      const nodes = text().link('Click', 'https://example.com', 'My Title').build();
      expect(nodes[0].marks![0].attrs).toEqual({
        href: 'https://example.com',
        title: 'My Title',
      });
    });
  });

  describe('strike', () => {
    it('creates strikethrough text', () => {
      const nodes = text().strike('deleted').build();
      expect(nodes[0].marks).toEqual([{ type: 'strike' }]);
    });
  });

  describe('underline', () => {
    it('creates underlined text', () => {
      const nodes = text().underline('underlined').build();
      expect(nodes[0].marks).toEqual([{ type: 'underline' }]);
    });
  });

  describe('colored', () => {
    it('creates colored text', () => {
      const nodes = text().colored('red text', '#ff0000').build();
      expect(nodes[0].marks).toEqual([{ type: 'textColor', attrs: { color: '#ff0000' } }]);
    });
  });

  describe('formatted', () => {
    it('applies multiple marks', () => {
      const nodes = text().formatted('bold italic', ['strong', 'em']).build();
      expect(nodes[0].marks).toEqual([{ type: 'strong' }, { type: 'em' }]);
    });
  });

  describe('hardBreak', () => {
    it('inserts a hard break node', () => {
      const nodes = text().text('line1').hardBreak().text('line2').build();
      expect(nodes).toHaveLength(3);
      expect(nodes[1].type).toBe('hardBreak');
    });
  });

  describe('chaining', () => {
    it('chains multiple text formatting', () => {
      const nodes = text()
        .text('Normal ')
        .bold('bold ')
        .italic('italic ')
        .code('code')
        .build();
      expect(nodes).toHaveLength(4);
      expect(nodes[0].text).toBe('Normal ');
      expect(nodes[1].marks![0].type).toBe('strong');
      expect(nodes[2].marks![0].type).toBe('em');
      expect(nodes[3].marks![0].type).toBe('code');
    });
  });
});

describe('textToAdf', () => {
  it('converts plain text with paragraph breaks', () => {
    const doc = textToAdf('First paragraph\n\nSecond paragraph');
    expect(doc.version).toBe(1);
    expect(doc.type).toBe('doc');
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].content![0].text).toBe('First paragraph');
    expect(doc.content[1].content![0].text).toBe('Second paragraph');
  });

  it('skips empty paragraphs', () => {
    const doc = textToAdf('First\n\n\n\nSecond');
    expect(doc.content).toHaveLength(2);
  });

  it('handles single paragraph', () => {
    const doc = textToAdf('Just one line');
    expect(doc.content).toHaveLength(1);
  });
});

describe('markdownToAdf', () => {
  it('converts headings', () => {
    const doc = markdownToAdf('# Heading 1\n## Heading 2');
    expect(doc.content[0].type).toBe('heading');
    expect(doc.content[0].attrs!.level).toBe(1);
    expect(doc.content[1].type).toBe('heading');
    expect(doc.content[1].attrs!.level).toBe(2);
  });

  it('converts code blocks with language', () => {
    const doc = markdownToAdf('```javascript\nconst x = 1;\n```');
    const block = doc.content[0];
    expect(block.type).toBe('codeBlock');
    expect(block.attrs!.language).toBe('javascript');
    expect(block.content![0].text).toBe('const x = 1;');
  });

  it('converts bullet lists', () => {
    const doc = markdownToAdf('- Item A\n- Item B\n- Item C');
    expect(doc.content[0].type).toBe('bulletList');
    expect(doc.content[0].content).toHaveLength(3);
  });

  it('converts ordered lists', () => {
    const doc = markdownToAdf('1. First\n2. Second');
    expect(doc.content[0].type).toBe('orderedList');
    expect(doc.content[0].content).toHaveLength(2);
  });

  it('converts blockquotes', () => {
    const doc = markdownToAdf('> This is a quote');
    expect(doc.content[0].type).toBe('blockquote');
  });

  it('converts horizontal rules', () => {
    const doc = markdownToAdf('---');
    expect(doc.content[0].type).toBe('rule');
  });

  it('converts inline bold', () => {
    const doc = markdownToAdf('This has **bold** text');
    const para = doc.content[0];
    expect(para.type).toBe('paragraph');
    const boldNode = para.content!.find(n => n.marks && n.marks.some(m => m.type === 'strong'));
    expect(boldNode).toBeDefined();
    expect(boldNode!.text).toBe('bold');
  });

  it('converts inline italic', () => {
    const doc = markdownToAdf('This has *italic* text');
    const para = doc.content[0];
    const italicNode = para.content!.find(n => n.marks && n.marks.some(m => m.type === 'em'));
    expect(italicNode).toBeDefined();
    expect(italicNode!.text).toBe('italic');
  });

  it('converts inline code', () => {
    const doc = markdownToAdf('Use `code` here');
    const para = doc.content[0];
    const codeNode = para.content!.find(n => n.marks && n.marks.some(m => m.type === 'code'));
    expect(codeNode).toBeDefined();
    expect(codeNode!.text).toBe('code');
  });

  it('converts links', () => {
    const doc = markdownToAdf('Visit [Google](https://google.com)');
    const para = doc.content[0];
    const linkNode = para.content!.find(n => n.marks && n.marks.some(m => m.type === 'link'));
    expect(linkNode).toBeDefined();
    expect(linkNode!.text).toBe('Google');
    expect(linkNode!.marks![0].attrs!.href).toBe('https://google.com');
  });

  it('skips empty lines', () => {
    const doc = markdownToAdf('\n\nHello\n\n');
    expect(doc.content).toHaveLength(1);
  });
});

describe('adfToText', () => {
  it('extracts text from a simple document', () => {
    const doc = adf().paragraph('Hello world').build();
    expect(adfToText(doc)).toBe('Hello world');
  });

  it('extracts text from multiple paragraphs', () => {
    const doc = adf()
      .paragraph('First')
      .paragraph('Second')
      .build();
    const result = adfToText(doc);
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('extracts text from headings', () => {
    const doc = adf().heading(1, 'My Title').build();
    expect(adfToText(doc)).toContain('My Title');
  });

  it('extracts text from lists', () => {
    const doc = adf().bulletList(['Apple', 'Banana']).build();
    const result = adfToText(doc);
    expect(result).toContain('Apple');
    expect(result).toContain('Banana');
  });

  it('extracts text from code blocks', () => {
    const doc = adf().codeBlock('const x = 1;', 'js').build();
    expect(adfToText(doc)).toContain('const x = 1;');
  });

  it('handles empty document', () => {
    const doc = adf().build();
    expect(adfToText(doc)).toBe('');
  });
});
