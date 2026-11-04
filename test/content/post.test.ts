import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';

describe('parsePost', () => {
  it('reports body lines as they appear in the source', () => {
    const parsed = parsePost(['---', 'title: a', '---', '', '# 제목'].join('\n'));
    expect(parsed.frontmatter.status).toBe('ok');
    expect(parsed.headings).toEqual([{ depth: 1, text: '제목', line: 5 }]);
  });

  it('does not read the blanked frontmatter as body content', () => {
    expect(parsePost('---\ntitle: a\n---\n').headings).toEqual([]);
  });

  it('still parses the body when frontmatter is malformed', () => {
    const parsed = parsePost('---\ntitle: [unclosed\n---\n\n# 제목');
    expect(parsed.frontmatter.status).toBe('invalid');
    expect(parsed.headings[0]).toMatchObject({ text: '제목', line: 5 });
  });

  it('handles CRLF line endings', () => {
    const parsed = parsePost('---\r\ntitle: a\r\nsub:\r\n  key: b\r\n---\r\n\r\n## 절\r\n');
    expect(parsed.frontmatter.status).toBe('ok');
    if (parsed.frontmatter.status !== 'ok') return;
    expect(parsed.frontmatter.locate(['sub', 'key'])).toBe(4);
    expect(parsed.headings[0]).toMatchObject({ text: '절', line: 7 });
  });

  it('reports footnote lines and clean definition text under CRLF with frontmatter', () => {
    const source = '---\ntitle: a\n---\n\n본문.[^1]\n\n[^1]: 설명. — [t - s](https://x.y)\n'.replace(/\n/g, '\r\n');
    const parsed = parsePost(source);
    expect(parsed.references[0]).toMatchObject({ label: '1', line: 5 });
    expect(parsed.definitions[0]).toMatchObject({ label: '1', line: 7, text: '설명. — [t - s](https://x.y)' });
  });
});
