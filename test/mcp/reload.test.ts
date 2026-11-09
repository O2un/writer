import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';
import { createPostChecker } from '../../src/mcp/tools/post-check.js';
import { reloading } from '../../src/reload.js';

const templates = (heading: string, ids = ['article']) =>
  JSON.stringify({ default: ids[0], templates: Object.fromEntries(ids.map((id) => [id, { description: id, referencesHeading: heading }])) });

const POST = ['---', "title: '글'", "genre: '액션'", '---', '', '본문.[^1]', '', '## 출처', '', '[^1]: 설명. — [제목](https://example.com)'].join('\n');

describe('reloading site files during a session', () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const root of temps.splice(0)) rmSync(root, { recursive: true });
  });

  const site = () => {
    const root = mkdtempSync(path.join(tmpdir(), 'writer-reload-'));
    temps.push(root);
    mkdirSync(path.join(root, 'posts', 'a'), { recursive: true });
    writeFileSync(path.join(root, 'posts', 'a', 'index.md'), POST);
    write(root, 'schema.json', JSON.stringify({ type: 'object', properties: { title: {}, genre: { enum: ['공포'] } } }));
    write(root, 'writer.templates.json', templates('참고 자료'));
    return root;
  };

  let tick = 0;
  const write = (root: string, name: string, content: string) => {
    const file = path.join(root, name);
    writeFileSync(file, content);
    const time = new Date(Date.now() + ++tick * 1000);
    utimesSync(file, time, time);
  };

  const checker = (root: string) => createPostChecker(loadConfig({ SITE_ROOT: root, WRITER_CONTENT_DIR: 'posts', WRITER_SCHEMA: 'schema.json' }));
  const rulesHit = async (check: ReturnType<typeof checker>) => (await check('a', 'article')).report.violations.map((v) => v.rule);

  it('picks up a schema change without a restart', async () => {
    const root = site();
    const check = checker(root);
    expect(await rulesHit(check)).toContain('frontmatter');

    write(root, 'schema.json', JSON.stringify({ type: 'object', properties: { title: {}, genre: { enum: ['공포', '액션'] } } }));
    expect(await rulesHit(check)).not.toContain('frontmatter');
  });

  it('picks up a template change without a restart', async () => {
    const root = site();
    const check = checker(root);
    expect(await rulesHit(check)).toContain('footnote-placement');

    write(root, 'writer.templates.json', templates('출처'));
    expect(await rulesHit(check)).not.toContain('footnote-placement');
  });

  it('asks for a restart when the template was removed from the file', async () => {
    const root = site();
    const check = checker(root);
    write(root, 'writer.templates.json', templates('참고 자료', ['other']));
    await expect(check('a', 'article')).rejects.toThrow(/restart the session/);
  });
});

describe('reloading', () => {
  it('keeps the initial value without a file', () => {
    const get = reloading(undefined, 1, () => 2);
    expect(get()).toBe(1);
  });

  it('does not re-read an unchanged file', () => {
    let reads = 0;
    const get = reloading(__filename, 'start', () => `read ${++reads}`);
    expect([get(), get()]).toEqual(['start', 'start']);
    expect(reads).toBe(0);
  });
});
