import { parseDocument } from 'yaml';

export type FrontmatterBlock =
  | { status: 'missing' }
  | { status: 'invalid'; line: number; error: string }
  | { status: 'ok'; line: number; data: Record<string, unknown>; locate: (path: readonly PropertyKey[]) => number };

export interface RawFrontmatter {
  yaml: string;
  line: number;
}

export interface SplitSource {
  frontmatter: RawFrontmatter | null;
  body: string;
}

const FRONTMATTER = /^(\uFEFF?|\s*\n)---([\s\S]*?\n)---/;

export function splitFrontmatter(source: string): SplitSource {
  const match = FRONTMATTER.exec(source);
  if (!match) return { frontmatter: null, body: source };

  const [block, prefix = '', yaml = ''] = match;
  return {
    frontmatter: { yaml, line: countNewlines(prefix) + 1 },
    body: blankOut(block) + source.slice(block.length),
  };
}

export function parseFrontmatter(raw: RawFrontmatter | null): FrontmatterBlock {
  if (!raw) return { status: 'missing' };

  const { yaml, line } = raw;
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) {
    return { status: 'invalid', line, error: doc.errors[0]!.message };
  }

  let data: unknown;
  try {
    data = doc.toJS();
  } catch (error) {
    return { status: 'invalid', line, error: error instanceof Error ? error.message : String(error) };
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { status: 'invalid', line, error: 'frontmatter must be a key-value mapping' };
  }

  const locate = (path: readonly PropertyKey[]): number => {
    for (let depth = path.length; depth > 0; depth--) {
      const node = doc.getIn(path.slice(0, depth), true) as { range?: [number, number, number] } | undefined;
      if (node?.range) return line + countNewlines(yaml.slice(0, node.range[0]));
    }
    return line;
  };

  return { status: 'ok', line, data: data as Record<string, unknown>, locate };
}

function blankOut(text: string): string {
  return text.replace(/[^\r\n]/g, ' ');
}

function countNewlines(text: string): number {
  return text.split('\n').length - 1;
}
