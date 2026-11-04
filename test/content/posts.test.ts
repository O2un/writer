import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PostNotFoundError, PostOutsideContentError, readPost, resolvePostPath } from '../../src/content/posts.js';
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
