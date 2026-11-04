import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { footnoteLengthRule } from '../../src/rules/footnote-length.js';
import { allAssets, definition, explanation } from '../helpers.js';

const check = (def: string) => footnoteLengthRule.check(parsePost(`본문.[^1]\n\n${def}`), allAssets).map((v) => [v.severity, v.line, v.message]);
const ofLength = (length: number) => check(definition('1', explanation(length)));

describe('footnote-length rule', () => {
  it.each([1, 40, 117, 150])('passes %i characters', (length) => {
    expect(ofLength(length)).toEqual([]);
  });

  it('warns above 150 characters', () => {
    expect(ofLength(151)).toEqual([['warning', 3, '[^1] explanation is 151 characters, over the recommended 150']]);
  });

  it('passes a definition with only a link', () => {
    expect(check(`[^1]: [${'가'.repeat(200)}](https://x.y)`)).toEqual([]);
  });

  it('does not count link text or inline code marks', () => {
    expect(check(`[^1]: \`${'가'.repeat(150)}\` — [${'나'.repeat(200)}](https://x.y)`)).toEqual([]);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(check(`[^1]: ${'😀'.repeat(150)} — [a](https://x.y)`)).toEqual([]);
  });
});
