import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/config.js';
import { parsePost } from '../../src/content/post.js';
import { createFrontmatterRule } from '../../src/rules/frontmatter.js';
import type { RuleContext } from '../../src/rules/index.js';
import { FIXTURE_CONFIG } from '../fixtures.js';
import { allAssets } from '../helpers.js';

const rule = createFrontmatterRule(FIXTURE_CONFIG.schema);

const BASE = ["title: 't'", "description: 'd'", "pubDate: '2026-10-30'"];
const check = (lines: string[], context = allAssets) => rule.check(parsePost(['---', ...lines, '---', ''].join('\n')), context);
const summary = (violations: ReturnType<typeof check>) => violations.map((v) => [v.severity, v.line, v.message]);

describe('frontmatter rule', () => {
  it('passes valid frontmatter', () => {
    expect(check([...BASE, "thumbnail: './a.png'", "accent: 'blue'"])).toEqual([]);
  });

  it('reports missing and malformed frontmatter', () => {
    expect(summary(rule.check(parsePost('# 제목'), allAssets))).toEqual([['error', 1, 'frontmatter is missing']]);
    const [violation] = rule.check(parsePost('---\ntitle: [unclosed\n---\n'), allAssets);
    expect(violation).toMatchObject({ severity: 'error', line: 1, message: expect.stringContaining('YAML cannot be parsed') });
  });

  it('points a missing required field at the start of the block', () => {
    expect(summary(check(["title: 't'", "pubDate: '2026-10-30'"]))).toEqual([['error', 1, "must have required property 'description'"]]);
  });

  it('points a wrong value at its own line', () => {
    expect(summary(check([...BASE, "accent: 'pink'"]))).toEqual([['error', 5, 'accent: must be equal to one of the allowed values']]);
  });

  it('reports nested fields with their path and line', () => {
    expect(summary(check([...BASE, 'escape:', "  cafe: 'c'", '  players: 0', '  difficulty: 3.3']))).toEqual([
      ['error', 7, 'escape.players: must be > 0'],
      ['error', 8, 'escape.difficulty: must be multiple of 0.5'],
    ]);
  });

  it('accepts any date the site can read and rejects others', () => {
    expect(check(["title: 't'", "description: 'd'", 'pubDate: 2026-10-30'])).toEqual([]);
    expect(check(["title: 't'", "description: 'd'", "pubDate: '2026-10-30T09:00:00+09:00'"])).toEqual([]);
    expect(summary(check(["title: 't'", "description: 'd'", "pubDate: '아무말'"]))).toEqual([['error', 4, 'pubDate: must match format "date-time"']]);
  });

  it('warns about fields the schema does not know', () => {
    expect(summary(check([...BASE, "thumbnial: './a.png'"]))).toEqual([['warning', 5, "unknown field 'thumbnial': not in the site schema"]]);
  });

  it('checks that a local thumbnail exists and skips remote ones', () => {
    const noAssets: RuleContext = { ...allAssets, assetExists: () => false };
    expect(summary(check([...BASE, "thumbnail: './a.png'"], noAssets))).toEqual([['error', 5, 'thumbnail file not found: ./a.png']]);
    expect(check([...BASE, "thumbnail: 'https://x.y/a.png'"], noAssets)).toEqual([]);
  });

  describe('schemas with branches', () => {
    const branch = (stage: string, field: string) => ({
      type: 'object',
      properties: { stage: { const: stage }, [field]: { type: 'string' } },
      required: ['stage', field],
    });
    const branched = createFrontmatterRule({
      type: 'object',
      properties: { game: { oneOf: [branch('프리뷰', 'expect'), branch('리뷰', 'rating')] } },
    });
    const messages = (lines: string[]) => branched.check(parsePost(['---', ...lines, '---', ''].join('\n')), allAssets).map((v) => v.message);

    it('reports only the branch the post selected', () => {
      expect(messages(['game:', "  stage: '리뷰'"])).toEqual(["game: must have required property 'rating'"]);
    });

    it('falls back to one message when no branch is selected', () => {
      expect(messages(['game:', "  stage: '없음'"])).toEqual(['game: must match exactly one schema in oneOf']);
    });
  });

  it('keeps constant mismatches outside any branch', () => {
    const fixed = createFrontmatterRule({ type: 'object', properties: { kind: { const: 'post' }, title: { type: 'string' } } });
    const violations = fixed.check(parsePost("---\nkind: 'x'\ntitle: 1\n---\n"), allAssets);
    expect(violations.map((v) => v.line)).toEqual([2, 3]);
  });

  it('skips the unknown field check for a schema without properties', () => {
    const open = createFrontmatterRule({ type: 'object' });
    expect(open.check(parsePost("---\nanything: 'x'\n---\n"), allAssets)).toEqual([]);
  });

  it('fails with a config error when the schema cannot be compiled', () => {
    expect(() => createFrontmatterRule({ type: 'nonsense' })).toThrow(ConfigError);
  });
});
