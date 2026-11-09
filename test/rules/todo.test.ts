import { describe, expect, it } from 'vitest';
import { parsePost } from '../../src/content/post.js';
import { todoRule } from '../../src/rules/todo.js';
import { allAssets } from '../helpers.js';

const check = (lines: string[]) => todoRule.check(parsePost(lines.join('\n')), allAssets).map((v) => [v.severity, v.line, v.message]);
const post = (draft: string | null, ...body: string[]) => ['---', "title: '글'", ...(draft === null ? [] : [`draft: ${draft}`]), '# TODO: 방문일 확인', '---', '', ...body];

describe('todo rule', () => {
  it('reports TODO comments in a published post', () => {
    expect(check(post('false', '## 총평', '', '<!-- TODO: 추천할 대상 -->', '', '본문 <!-- TODO 문장 다듬기 --> 끝.'))).toEqual([
      ['info', 4, 'TODO left in a published post: 방문일 확인'],
      ['info', 9, 'TODO left in a published post: 추천할 대상'],
      ['info', 11, 'TODO left in a published post: 문장 다듬기'],
    ]);
  });

  it('treats a post without draft as published, as the site does', () => {
    expect(check(post(null))).toEqual([['info', 3, 'TODO left in a published post: 방문일 확인']]);
  });

  it('ignores drafts', () => {
    expect(check(post('true', '<!-- TODO: 감상 -->'))).toEqual([]);
  });

  it('finds a TODO after a YAML value and a multi-line comment', () => {
    const lines = ['---', 'players: 5 # TODO 인원 확인', '---', '', '<!--', 'TODO: 첫인상', '-->'];
    expect(check(lines)).toEqual([
      ['info', 2, 'TODO left in a published post: 인원 확인'],
      ['info', 5, 'TODO left in a published post: 첫인상'],
    ]);
  });

  it('ignores other comments, TODO in prose and TODO inside code', () => {
    const lines = ['---', "title: '# TODO 아님'", '---', '', '<!-- 메모 -->', '', 'TODO 앱을 만들었다.', '', '```html', '<!-- TODO: 예시 -->', '```'];
    expect(check(lines)).toEqual([]);
  });

  it('skips posts whose frontmatter cannot be read', () => {
    expect(check(['<!-- TODO: 감상 -->'])).toEqual([]);
  });
});
