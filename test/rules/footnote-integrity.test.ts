import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { footnoteIntegrityRule } from '../../src/rules/footnote-integrity.js';

const check = (source: string) =>
  footnoteIntegrityRule.check(parsePost(source), { assetExists: () => true }).map((v) => [v.severity, v.line, v.message]);

describe('footnote-integrity rule', () => {
  it('passes when every marker and definition pair up', () => {
    expect(check('본문.[^1] 다른 문장.[^name]\n\n[^1]: 설명.\n[^name]: 설명.')).toEqual([]);
  });

  it('reports a marker without a definition', () => {
    expect(check('본문.[^1]')).toEqual([['error', 1, '[^1] has no definition']]);
  });

  it('reports a definition the body never uses', () => {
    expect(check('본문.\n\n[^1]: 설명.')).toEqual([['error', 3, '[^1] is never used in the body']]);
  });

  it('reports a label typo from both sides', () => {
    expect(check('본문.[^sutter]\n\n[^suter]: 설명.')).toEqual([
      ['error', 1, '[^sutter] has no definition'],
      ['error', 3, '[^suter] is never used in the body'],
    ]);
  });

  it('reports a duplicate definition with the first line', () => {
    expect(check('본문.[^1]\n\n[^1]: 설명.\n[^1]: 또 쓴 설명.')).toEqual([['error', 4, '[^1] is defined twice (first at line 3)']]);
  });

  it('pairs labels case-insensitively', () => {
    expect(check('본문.[^Name]\n\n[^name]: 설명.')).toEqual([]);
  });

  it('allows the same marker to appear twice', () => {
    expect(check('본문.[^1] 다시.[^1]\n\n[^1]: 설명.')).toEqual([]);
  });

  it('ignores posts without footnotes', () => {
    expect(check('# 제목\n\n본문.')).toEqual([]);
  });
});
