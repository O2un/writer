import { describe, expect, it } from 'vitest';
import { parseBody } from '../../src/content/body.js';
import { definition, withReferences } from '../helpers.js';

describe('parseBody', () => {
  it('collects headings with depth, plain text and line', () => {
    expect(parseBody('# 제목\n\n## `코드` 참고 자료').headings).toEqual([
      { depth: 1, text: '제목', line: 1 },
      { depth: 2, text: '코드 참고 자료', line: 3 },
    ]);
  });

  it('ignores heading syntax inside code blocks', () => {
    expect(parseBody('```md\n## 코드 안\n```').headings).toEqual([]);
  });

  describe('footnotes', () => {
    it('collects references in document order with lines', () => {
      const parsed = parseBody(withReferences('첫 문장.[^b]\n\n둘째 문장.[^a]', definition('a'), definition('b')));
      expect(parsed.references.map((r) => [r.label, r.line, r.resolved])).toEqual([
        ['b', 1, true],
        ['a', 3, true],
      ]);
    });

    it('keeps markers without a definition as unresolved references', () => {
      expect(parseBody('정의 없는 마커.[^ghost]').references).toEqual([{ label: 'ghost', line: 1, resolved: false }]);
    });

    it('reports the line of an unresolved marker inside a multi-line paragraph', () => {
      expect(parseBody('첫 줄\n둘째 줄\n셋째 줄[^ghost]').references[0]).toMatchObject({ label: 'ghost', line: 3 });
    });

    it('matches labels case-insensitively', () => {
      const parsed = parseBody(withReferences('본문.[^A]', definition('a')));
      expect(parsed.references[0]).toMatchObject({ label: 'A', resolved: true });
    });

    it('ignores markers inside code', () => {
      expect(parseBody(['`[^1]` 인라인 코드', '', '```md', 'text[^2]', '```'].join('\n')).references).toEqual([]);
    });

    it('counts markers in image captions as references', () => {
      const parsed = parseBody(withReferences('![그림](./a.png "캡션[^img]")', definition('img')));
      expect(parsed.references).toEqual([{ label: 'img', line: 1, resolved: true }]);
    });

    it('does not count markers inside definitions as references', () => {
      const parsed = parseBody(withReferences('본문.[^a]', definition('a', '정의 안의 [^b] 마커.'), definition('b')));
      expect(parsed.references.map((r) => r.label)).toEqual(['a']);
    });

    it.each([
      ['an em dash', '설명 문장. — [a](https://x.y)', '설명 문장.'],
      ['a hyphen', '설명 문장 - [a](https://x.y)', '설명 문장'],
      ['several links', '설명 문장. — [a](https://x.y), [b](https://x.y)', '설명 문장.'],
      ['a link first', '[a](https://x.y) — 설명 문장.', '설명 문장.'],
      ['a link in the middle', '앞 [a](https://x.y) 뒤.', '앞  뒤.'],
      ['only a link', '[a](https://x.y)', ''],
      ['no link', '설명 문장.', '설명 문장.'],
      ['a hyphen inside the text', 'A-B 비교.', 'A-B 비교.'],
    ])('separates the explanation from links with %s', (_, text, expected) => {
      expect(parseBody(`본문.[^1]\n\n[^1]: ${text}`).definitions[0]?.explanation).toBe(expected);
    });

    it('joins multi-line definitions into one line of text', () => {
      const parsed = parseBody(withReferences('본문.[^a]', '[^a]: 첫 줄\n    둘째 줄. — [t - s](https://x.y)'));
      expect(parsed.definitions).toEqual([{ label: 'a', line: 5, text: '첫 줄 둘째 줄. — [t - s](https://x.y)', explanation: '첫 줄 둘째 줄.', links: [{ title: 't - s', url: 'https://x.y' }] }]);
    });
  });
});
