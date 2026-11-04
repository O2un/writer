import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { checkPost, type Rule, type RuleContext } from '../../src/rules/index.js';
import { reporter } from '../../src/rules/types.js';

const post = parsePost('# 제목');
const context: RuleContext = { assetExists: () => true };

const fake = (id: string, build: (r: ReturnType<typeof reporter>) => ReturnType<Rule['check']>): Rule => ({
  id,
  check: () => build(reporter(id)),
});

describe('checkPost', () => {
  it('returns nothing when no rule is given', () => {
    expect(checkPost(post, context, [])).toEqual({ counts: { error: 0, warning: 0, info: 0 }, violations: [] });
  });

  it('sorts violations by line, then by severity, and counts them', () => {
    const rules = [
      fake('a', (r) => [r.info('i', 2), r.warning('w', 5)]),
      fake('b', (r) => [r.error('e', 2), r.error('no line')]),
    ];
    const { counts, violations } = checkPost(post, context, rules);

    expect(counts).toEqual({ error: 2, warning: 1, info: 1 });
    expect(violations.map((v) => [v.rule, v.severity, v.line])).toEqual([
      ['b', 'error', undefined],
      ['b', 'error', 2],
      ['a', 'info', 2],
      ['a', 'warning', 5],
    ]);
  });

  it('passes the post and context to every rule', () => {
    const seen: unknown[] = [];
    const spy: Rule = {
      id: 'spy',
      check: (p, c) => {
        seen.push(p, c);
        return [];
      },
    };
    checkPost(post, context, [spy]);
    expect(seen).toEqual([post, context]);
  });
});
