import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { footnoteLinkRule } from '../../src/rules/footnote-link.js';
import { allAssets } from '../helpers.js';

const check = (definition: string) =>
  footnoteLinkRule.check(parsePost(`본문.[^1]\n\n${definition}`), allAssets).map((v) => [v.severity, v.line, v.message]);

describe('footnote-link rule', () => {
  it.each([
    ['an explanation and a link', '[^1]: 설명. — [제목 - 사이트](https://x.y)'],
    ['only a link', '[^1]: [제목 - 사이트](https://x.y)'],
    ['a plain hyphen separator', '[^1]: 설명 - [제목](https://x.y)'],
    ['no closing period', '[^1]: 설명 — [제목](https://x.y)'],
    ['a title without a site name', '[^1]: 설명. — [제목](https://x.y)'],
    ['several links', '[^1]: 설명. — [a](https://x.y), [b](http://x.y)'],
    ['parentheses in the url', '[^1]: 설명. — [a](https://x.y/a_(b))'],
    ['a link title attribute', '[^1]: 설명. — [a](https://x.y "t")'],
    ['a bare url', '[^1]: 설명. — https://x.y'],
  ])('passes %s', (_, definition) => {
    expect(check(definition)).toEqual([]);
  });

  it('reports a definition without a link', () => {
    expect(check('[^1]: 설명만 있다.')).toEqual([['error', 3, '[^1] has no source link']]);
  });

  it('does not count a url inside code as a link', () => {
    expect(check('[^1]: `https://x.y` 설명.')).toEqual([['error', 3, '[^1] has no source link']]);
  });

  it('reports each link that is not http(s)', () => {
    expect(check('[^1]: 설명. — [a](ftp://x.y), [b](./c.md), [d](https://x.y)')).toEqual([
      ['error', 3, '[^1] link is not http(s): ftp://x.y'],
      ['error', 3, '[^1] link is not http(s): ./c.md'],
    ]);
  });

  it('reads links across wrapped lines', () => {
    expect(footnoteLinkRule.check(parsePost('본문.[^1]\n\n[^1]: 첫 줄\n    [a](https://x.y)'), allAssets)).toEqual([]);
  });
});
