import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmProvider } from '../../src/llm/index.js';
import { createServer } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG } from '../fixtures.js';

describe('list_posts', () => {
  let client: Client;

  beforeEach(async () => {
    const provider = { complete: vi.fn(), completeJson: vi.fn() } as unknown as LlmProvider;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([createServer(FIXTURE_CONFIG, provider).connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(() => client.close());

  it('returns every post as text and structured content', async () => {
    const result = await client.callTool({ name: 'list_posts', arguments: {} });
    const [first] = result.content as { text: string }[];
    expect(first?.text.split('\n')).toEqual([
      '3 posts',
      'notes/plain.md [error] frontmatter missing',
      `sample/broken/index.md {"title":"깨진 글","pubDate":"2026-10-30","thumbnial":"./thumb.png","thumbnail":"./없는파일.png","accent":"pink"}`,
      `sample/clean/index.md {"title":"깨끗한 글","description":"규칙을 모두 지킨 예시 글","pubDate":"2026-10-30","thumbnail":"./thumb.png"}`,
    ]);
    expect((result.structuredContent as { posts: unknown[] }).posts).toHaveLength(3);
  });

  it('is listed as a read-only local tool', async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'list_posts')?.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
  });
});
