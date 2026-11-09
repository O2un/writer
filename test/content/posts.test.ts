import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { listPosts, PostNotFoundError, PostOutsideContentError, readPost, resolvePostPath } from '../../src/content/posts.js';
import { FIXTURE_CONTENT_DIR } from '../fixtures.js';

describe('resolvePostPath', () => {
  it('resolves a post folder to its index file', () => {
    expect(resolvePostPath(FIXTURE_CONTENT_DIR, 'sample/clean')).toBe(path.join(FIXTURE_CONTENT_DIR, 'sample', 'clean', 'index.md'));
  });

  it('accepts a file path and an absolute path inside the blog folder', () => {
    const file = path.join(FIXTURE_CONTENT_DIR, 'sample', 'clean', 'index.md');
    expect(resolvePostPath(FIXTURE_CONTENT_DIR, 'sample/clean/index.md')).toBe(file);
    expect(resolvePostPath(FIXTURE_CONTENT_DIR, file)).toBe(file);
  });

  it('rejects paths that escape the blog folder', () => {
    expect(() => resolvePostPath(FIXTURE_CONTENT_DIR, '../../package.json')).toThrow(PostOutsideContentError);
    expect(() => resolvePostPath(FIXTURE_CONTENT_DIR, path.resolve('/'))).toThrow(PostOutsideContentError);
  });

  it('rejects missing posts and non-markdown files', () => {
    expect(() => resolvePostPath(FIXTURE_CONTENT_DIR, 'sample/nope')).toThrow(PostNotFoundError);
    expect(() => resolvePostPath(FIXTURE_CONTENT_DIR, 'sample/clean/thumb.png')).toThrow(PostNotFoundError);
  });
});

describe('readPost', () => {
  it('returns a slash-separated path relative to the blog folder', async () => {
    const file = await readPost(FIXTURE_CONTENT_DIR, 'sample/clean');
    expect(file.relativePath).toBe('sample/clean/index.md');
    expect(file.source).toContain('title:');
  });
});

describe('listPosts', () => {
  it('lists every markdown file with its frontmatter, sorted by path', async () => {
    const posts = await listPosts(FIXTURE_CONTENT_DIR);
    expect(posts.map((p) => p.post)).toEqual(['notes/plain.md', 'sample/broken/index.md', 'sample/clean/index.md']);
    expect(posts[2]).toEqual({
      post: 'sample/clean/index.md',
      frontmatter: { title: '깨끗한 글', description: '규칙을 모두 지킨 예시 글', pubDate: '2026-10-30', thumbnail: './thumb.png' },
    });
  });

  it('keeps posts whose frontmatter cannot be read, with the reason', async () => {
    const [plain] = await listPosts(FIXTURE_CONTENT_DIR);
    expect(plain).toEqual({ post: 'notes/plain.md', error: 'frontmatter missing' });
  });
});
