import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { footnotePlacementRule } from '../../src/rules/footnote-placement.js';
import { allAssets } from '../helpers.js';

const check = (lines: string[], context = allAssets) =>
  footnotePlacementRule.check(parsePost(lines.join('\n')), context).map((v) => [v.line, v.message]);

const DEF = '[^1]: 설명.';

describe('footnote-placement rule', () => {
  it('passes definitions inside a final section', () => {
    expect(check(['본문.[^1]', '', '## 참고 자료', '', DEF])).toEqual([]);
  });

  it('ignores posts without definitions', () => {
    expect(check(['# 제목', '', '## 맺음말'])).toEqual([]);
  });

  it.each(['#', '##', '###', '####'])('accepts the section at any depth: %s', (depth) => {
    expect(check(['## 맺음말', '', `${depth} 참고 자료`, '', DEF])).toEqual([]);
  });

  it('allows a deeper heading inside the section', () => {
    expect(check(['## 참고 자료', '', '### 문서', '', DEF])).toEqual([]);
  });

  it('reports a missing section at the first definition', () => {
    expect(check(['본문.[^1]', '', DEF])).toEqual([[3, "footnote definitions need a '참고 자료' section"]]);
  });

  it('reports a section following at the same or a shallower depth', () => {
    expect(check(['## 참고 자료', '', DEF, '', '## 맺음말'])).toEqual([[5, "section '맺음말' follows '참고 자료', which must be the last section"]]);
    expect(check(['### 참고 자료', '', DEF, '', '## 맺음말'])).toEqual([[5, "section '맺음말' follows '참고 자료', which must be the last section"]]);
  });

  it('reports definitions before the section', () => {
    expect(check([DEF, '', '## 참고 자료'])).toEqual([[1, "[^1] definition is outside the '참고 자료' section"]]);
  });

  it('reports definitions after the section has ended', () => {
    expect(check(['## 참고 자료', '', '## 맺음말', '', DEF])).toEqual([
      [3, "section '맺음말' follows '참고 자료', which must be the last section"],
      [5, "[^1] definition is outside the '참고 자료' section"],
    ]);
  });

  it('reads the section name from the template', () => {
    const context = { ...allAssets, template: { ...allAssets.template, referencesHeading: '출처' } };
    expect(check(['## 출처', '', DEF], context)).toEqual([]);
    expect(check(['## 참고 자료', '', DEF], context)).toEqual([[3, "footnote definitions need a '출처' section"]]);
  });
});
