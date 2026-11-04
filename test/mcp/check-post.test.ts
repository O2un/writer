import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG } from '../fixtures.js';

describe('check_post', () => {
  let client: Client;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    const server = createServer(FIXTURE_CONFIG);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(() => client.close());

  const call = (path: string) => client.callTool({ name: 'check_post', arguments: { path } });

  it('is listed as a read-only tool', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['check_post']);
    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
  });

  it('returns a report for a post', async () => {
    const result = await call('sample/clean');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      post: 'sample/clean/index.md',
      passed: true,
      counts: { error: 0, warning: 0, info: 0 },
      violations: [],
    });
    expect(result.content).toEqual([{ type: 'text', text: 'sample/clean/index.md: error 0, warning 0, info 0' }]);
  });

  it('reports violations from the site schema and checks assets next to the post', async () => {
    const result = await call('sample/broken');
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ post: 'sample/broken/index.md', passed: false, counts: { error: 3, warning: 1, info: 0 } });
    expect((result.content as { text: string }[])[0]?.text).toContain('L5 [error] frontmatter: thumbnail file not found: ./없는파일.png');
  });

  it.each([
    ['a missing post', 'sample/nope', /post not found/],
    ['a path outside the blog folder', '../../package.json', /outside the content folder/],
  ])('answers with a tool error for %s', async (_, path, message) => {
    const result = await call(path);
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringMatching(message) }]);
  });

  it('rejects an empty path', async () => {
    expect((await call('')).isError).toBe(true);
  });
});
