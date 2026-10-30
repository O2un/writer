import type { Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface Heading {
  depth: number;
  text: string;
  line: number;
}

export interface Body {
  headings: Heading[];
}

const processor = unified().use(remarkParse).use(remarkGfm);

export function parseBody(body: string): Body {
  const tree = processor.parse(body);

  return {
    headings: collectHeadings(tree),
  };
}

function collectHeadings(tree: Root): Heading[] {
  const headings: Heading[] = [];
  visit(tree, 'heading', (node) => {
    headings.push({ depth: node.depth, text: toString(node).trim(), line: node.position?.start.line ?? 1 });
  });
  return headings;
}
