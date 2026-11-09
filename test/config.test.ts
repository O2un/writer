import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';
import { FIXTURE_CONTENT_DIR, FIXTURE_SITE_ROOT } from './fixtures.js';

const TEMPLATES_JSON = JSON.stringify({ default: 'a', templates: { a: { description: 'A', referencesHeading: '참고 자료' } } });

describe('loadConfig', () => {
  const temps: string[] = [];

  const siteWithSchema = (content: string): string => {
    const root = mkdtempSync(path.join(tmpdir(), 'writer-'));
    temps.push(root);
    mkdirSync(path.join(root, 'posts'));
    writeFileSync(path.join(root, 'schema.json'), content);
    writeFileSync(path.join(root, 'writer.templates.json'), TEMPLATES_JSON);
    return root;
  };

  const site = (root: string, extra: Record<string, string> = {}) => ({ SITE_ROOT: root, WRITER_CONTENT_DIR: 'posts', WRITER_SCHEMA: 'schema.json', ...extra });

  it('loads the site templates file', () => {
    const { templates } = loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT });
    expect(templates.ids).toEqual(['article', 'escape-review']);
    expect(templates.defaultId).toBe('article');
  });

  it('reads WRITER_TEMPLATES from SITE_ROOT', () => {
    const root = siteWithSchema('{"type":"object"}');
    writeFileSync(path.join(root, 'other.json'), TEMPLATES_JSON.replaceAll('"a"', '"b"'));
    expect(loadConfig(site(root, { WRITER_TEMPLATES: 'other.json' })).templates.ids).toEqual(['b']);
  });

  it.each([
    ['a missing file', null, /templates file not found/],
    ['broken JSON', '{', /templates file is not valid JSON/],
    ['an invalid template', '{"default":"a","templates":{"a":{}}}', /templates\.a\.description/],
  ])('rejects a templates file with %s', (_, content, message) => {
    const root = siteWithSchema('{"type":"object"}');
    const file = path.join(root, 'writer.templates.json');
    if (content === null) rmSync(file);
    else writeFileSync(file, content);
    expect(() => loadConfig(site(root))).toThrow(ConfigError);
    expect(() => loadConfig(site(root))).toThrow(message);
  });

  afterEach(() => {
    for (const root of temps.splice(0)) rmSync(root, { recursive: true });
  });

  it('derives the content folder and schema from SITE_ROOT by default', () => {
    const config = loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT });
    expect(config.siteRoot).toBe(FIXTURE_SITE_ROOT);
    expect(config.contentDir).toBe(FIXTURE_CONTENT_DIR);
    expect(config.schema).toMatchObject({ type: 'object' });
    expect(config.guidePath).toBe(path.join(FIXTURE_SITE_ROOT, '.claude', 'skills', 'devlog-content-writing', 'SKILL.md'));
  });

  it('starts without a guide file and resolves WRITER_GUIDE from SITE_ROOT', () => {
    const config = loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT, WRITER_GUIDE: 'nope.md' });
    expect(config.guidePath).toBe(path.join(FIXTURE_SITE_ROOT, 'nope.md'));
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

  it('defaults to the claude-code provider with no model override', () => {
    expect(loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT }).llm).toEqual({ provider: 'claude-code', claudeBin: 'claude' });
  });

  it('reads the provider and model from the environment', () => {
    const env = { SITE_ROOT: FIXTURE_SITE_ROOT, LLM_PROVIDER: 'anthropic-api', WRITER_MODEL: 'some-model', WRITER_CLAUDE_BIN: 'C:/bin/claude.exe' };
    expect(loadConfig(env).llm).toEqual({ provider: 'anthropic-api', model: 'some-model', claudeBin: 'C:/bin/claude.exe' });
  });

  it('rejects an unknown provider', () => {
    expect(() => loadConfig({ SITE_ROOT: FIXTURE_SITE_ROOT, LLM_PROVIDER: 'nope' })).toThrow(/LLM_PROVIDER is missing or invalid/);
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
