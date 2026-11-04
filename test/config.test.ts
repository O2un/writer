import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { FIXTURE_CONTENT_DIR, FIXTURE_SITE_ROOT } from './fixtures.js';

describe('loadConfig', () => {
  const temps: string[] = [];

  const siteWithSchema = (content: string): string => {
    const root = mkdtempSync(path.join(tmpdir(), 'writer-'));
    temps.push(root);
    mkdirSync(path.join(root, 'posts'));
    writeFileSync(path.join(root, 'schema.json'), content);
    return root;
  };

  afterEach(() => {
    for (const root of temps.splice(0)) rmSync(root, { recursive: true });
  });

  it('derives the content folder and schema from SITE_ROOT by default', () => {
    const config = loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT });
    expect(config.siteRoot).toBe(FIXTURE_SITE_ROOT);
    expect(config.contentDir).toBe(FIXTURE_CONTENT_DIR);
    expect(config.schema).toMatchObject({ type: 'object' });
  });

  it('accepts another site layout through the environment', () => {
    const root = siteWithSchema('{"type":"object"}');
    const config = loadConfig({ SITE_ROOT: root, WRITER_CONTENT_DIR: 'posts', WRITER_SCHEMA: 'schema.json' });
    expect(config.contentDir).toBe(path.join(root, 'posts'));
    expect(config.schema).toEqual({ type: 'object' });
  });

  it.each([{}, { SITE_ROOT: '  ' }])('rejects a missing SITE_ROOT: %o', (env) => {
    expect(() => loadConfig(env)).toThrow(/SITE_ROOT/);
  });

  it('names the variable when an optional one is blank', () => {
    expect(() => loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT, WRITER_SCHEMA: ' ' })).toThrow(/WRITER_SCHEMA/);
  });

  it('rejects a SITE_ROOT without a content folder', () => {
    expect(() => loadConfig({ SITE_ROOT: path.dirname(FIXTURE_SITE_ROOT) })).toThrow(/content folder not found/);
  });

  it('rejects a missing schema file', () => {
    expect(() => loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT, WRITER_SCHEMA: 'nope.json' })).toThrow(/schema file not found/);
  });

  it.each([
    ['broken JSON', '{', /not valid JSON/],
    ['a non-object', '[1]', /not a JSON object/],
  ])('rejects a schema file with %s', (_, content, message) => {
    const root = siteWithSchema(content);
    const env = { SITE_ROOT: root, WRITER_CONTENT_DIR: 'posts', WRITER_SCHEMA: 'schema.json' };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(message);
  });
});
