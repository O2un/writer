import type { FootnoteDefinition as MdFootnoteDefinition, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

export interface Heading {
  depth: number;
  text: string;
  line: number;
}

export interface FootnoteReference {
  label: string;
  line: number;
  resolved: boolean;
  inImage: boolean;
}

export interface FootnoteDefinition {
  label: string;
  line: number;
  text: string;
}

export interface Body {
  headings: Heading[];
  references: FootnoteReference[];
  definitions: FootnoteDefinition[];
}

const processor = unified().use(remarkParse).use(remarkGfm);

const LOOSE_REFERENCE = /\[\^([^\]\s]+)\]/g;

export function parseBody(body: string): Body {
  const tree = processor.parse(body);
  const definitions = collectDefinitions(tree, body);
  const defined = new Set(definitions.map((d) => normalizeLabel(d.label)));

  return {
    headings: collectHeadings(tree),
    references: collectReferences(tree, body, defined),
    definitions,
  };
}

export function normalizeLabel(label: string): string {
  return label.toLowerCase();
}

function collectHeadings(tree: Root): Heading[] {
  const headings: Heading[] = [];
  visit(tree, 'heading', (node) => {
    headings.push({ depth: node.depth, text: toString(node).trim(), line: node.position?.start.line ?? 1 });
  });
  return headings;
}

function collectDefinitions(tree: Root, body: string): FootnoteDefinition[] {
  const definitions: FootnoteDefinition[] = [];
  visit(tree, 'footnoteDefinition', (node: MdFootnoteDefinition) => {
    const label = node.label ?? node.identifier;
    const raw = body.slice(node.position!.start.offset, node.position!.end.offset);
    const text = raw
      .slice(raw.indexOf(']:') + 2)
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    definitions.push({ label, line: node.position!.start.line, text });
  });
  return definitions;
}

function collectReferences(tree: Root, body: string, defined: ReadonlySet<string>): FootnoteReference[] {
  const found: (FootnoteReference & { offset: number })[] = [];

  const loose = (text: string, offset: number, line: number, inImage: boolean) => {
    for (const match of text.matchAll(LOOSE_REFERENCE)) {
      const label = match[1]!;
      const markerLine = line + text.slice(0, match.index).split('\n').length - 1;
      found.push({ label, line: markerLine, offset: offset + match.index, resolved: defined.has(normalizeLabel(label)), inImage });
    }
  };

  visit(tree, (node) => {
    if (node.type === 'footnoteDefinition') return SKIP;
    const offset = node.position?.start.offset ?? 0;
    const line = node.position?.start.line ?? 0;

    switch (node.type) {
      case 'footnoteReference':
        found.push({ label: node.label ?? node.identifier, line, offset, resolved: true, inImage: false });
        break;
      case 'text':
        loose(node.value, offset, line, false);
        break;
      case 'image':
        loose(body.slice(offset, node.position?.end.offset), offset, line, true);
        break;
    }
    return undefined;
  });

  return found.sort((a, b) => a.offset - b.offset).map(({ offset: _, ...ref }) => ref);
}
