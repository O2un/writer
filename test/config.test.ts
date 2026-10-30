import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { FIXTURE_BLOG_DIR, FIXTURE_DEVLOG_ROOT } from './fixtures.js';

describe('loadConfig', () => {
  it('derives the blog folder from DEVLOG_ROOT', () => {
    expect(loadConfig({ DEVLOG_ROOT: FIXTURE_DEVLOG_ROOT })).toEqual({ devlogRoot: FIXTURE_DEVLOG_ROOT, blogDir: FIXTURE_BLOG_DIR });
  });

  it.each([{}, { DEVLOG_ROOT: '  ' }])('rejects a missing DEVLOG_ROOT: %o', (env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
  });

  it('rejects a DEVLOG_ROOT without a blog folder', () => {
    expect(() => loadConfig({ DEVLOG_ROOT: path.dirname(FIXTURE_DEVLOG_ROOT) })).toThrow(/글 폴더/);
  });
});
