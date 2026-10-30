import { describe, expect, it } from 'vitest';
import { parseBody } from '../../src/content/body.js';

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
});
