import { existsSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter, splitFrontmatter } from './frontmatter.js';

const POST_EXTENSIONS = ['.md', '.mdx'];
const INDEX_FILES = POST_EXTENSIONS.map((ext) => `index${ext}`);

export class PostNotFoundError extends Error {
  override name = 'PostNotFoundError';
}

export class PostOutsideContentError extends Error {
  override name = 'PostOutsideContentError';
}

export interface PostFile {
  absolutePath: string;
  relativePath: string;
  source: string;
}

export function resolvePostPath(contentDir: string, input: string): string {
  const candidate = path.resolve(contentDir, input);
  const relative = path.relative(contentDir, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new PostOutsideContentError(`path is outside the content folder: ${input}`);
  }

  if (isFile(candidate)) {
    if (!POST_EXTENSIONS.includes(path.extname(candidate))) {
      throw new PostNotFoundError(`not a markdown file: ${input}`);
    }
    return candidate;
  }

  for (const name of INDEX_FILES) {
    const file = path.join(candidate, name);
    if (isFile(file)) return file;
  }
  throw new PostNotFoundError(`post not found: ${input}`);
}

export async function readPost(contentDir: string, input: string): Promise<PostFile> {
  const absolutePath = resolvePostPath(contentDir, input);
  return {
    absolutePath,
    relativePath: path.relative(contentDir, absolutePath).split(path.sep).join('/'),
    source: await readFile(absolutePath, 'utf8'),
  };
}

export type PostSummary = { post: string; frontmatter: Record<string, unknown> } | { post: string; error: string };

export async function listPosts(contentDir: string): Promise<PostSummary[]> {
  const files = (await readdir(contentDir, { recursive: true }))
    .filter((entry) => POST_EXTENSIONS.includes(path.extname(entry)))
    .map((entry) => entry.split(path.sep).join('/'))
    .sort();

  return Promise.all(
    files.map(async (post) => {
      const block = parseFrontmatter(splitFrontmatter(await readFile(path.join(contentDir, post), 'utf8')).frontmatter);
      if (block.status === 'ok') return { post, frontmatter: block.data };
      return { post, error: block.status === 'missing' ? 'frontmatter missing' : `frontmatter is invalid: ${block.error}` };
    }),
  );
}

function isFile(target: string): boolean {
  return existsSync(target) && statSync(target).isFile();
}
