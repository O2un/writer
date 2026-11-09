import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmProvider } from '../../src/llm/index.js';
import { createServer } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG } from '../fixtures.js';

describe('get_template', () => {
  let client: Client;
  const provider = { complete: vi.fn(), completeJson: vi.fn() } as unknown as LlmProvider;

  beforeEach(async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([createServer(FIXTURE_CONFIG, provider).connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(() => client.close());

  const call = (template?: string) => client.callTool({ name: 'get_template', arguments: template ? { template } : {} });

  it('is listed as a read-only local tool that offers the site templates', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'get_template');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
    expect(tool?.inputSchema.properties?.template).toMatchObject({ enum: ['article', 'escape-review'], default: 'article' });
  });

  it('returns the template guidance without calling the LLM', async () => {
    const result = await call('escape-review');
    expect(result.structuredContent).toMatchObject({
      template: 'escape-review',
      description: 'Escape room review',
      referencesHeading: '참고 자료',
      frontmatter: { 'escape.cafe': { research: '매장 이름' }, 'escape.players': { prompt: '함께 간 인원' } },
      sections: [
        { heading: '방에 들어가서', research: '공식 시놉시스', prompt: '첫인상과 분위기' },
        { heading: '총평', prompt: '추천할 대상' },
      ],
    });
    expect(result.structuredContent).not.toHaveProperty('criteria');
    expect(provider.complete).not.toHaveBeenCalled();
    expect(provider.completeJson).not.toHaveBeenCalled();
  });

  it('tells the drafter to leave first-hand content to the author and to save a draft', async () => {
    const { instructions } = (await call('escape-review')).structuredContent as { instructions: string };
    expect(instructions).toContain("'<!-- TODO: <prompt> -->'");
    expect(instructions).toContain("final '참고 자료' section");
    expect(instructions).toContain('draft: true');
    expect(instructions).toContain('open it with a browser tool');
    expect(instructions).toContain('Leave out optional fields you have no value for, without a TODO');
    expect(instructions).toContain('not into the file');
    expect(instructions).toContain('Writing principles:');
    expect(instructions).toContain('The post explains its subject, never itself');
  });

  it('returns the site guide, or null when the site has none', async () => {
    expect((await call('article')).structuredContent).toMatchObject({ guide: expect.stringContaining('Fixture guide') });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const bare = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([createServer({ ...FIXTURE_CONFIG, guidePath: 'nope.md' }, provider).connect(serverTransport), bare.connect(clientTransport)]);
    const result = await bare.callTool({ name: 'get_template', arguments: {} });
    expect(result.structuredContent).toMatchObject({ guide: null });
    await bare.close();
  });

  it('prints the guidance as text', async () => {
    const [first] = (await call('escape-review')).content as { text: string }[];
    expect(first?.text.split('\n').slice(0, 12)).toEqual([
      'escape-review: Escape room review',
      '',
      'frontmatter:',
      '- escape.cafe',
      '  research: 매장 이름',
      '- escape.players',
      '  prompt: 함께 간 인원',
      '',
      'sections:',
      '- 방에 들어가서',
      '  research: 공식 시놉시스',
      '  prompt: 첫인상과 분위기',
    ]);
  });

  it('uses the default template when none is given', async () => {
    const result = await call();
    expect(result.structuredContent).toMatchObject({ template: 'article', frontmatter: {}, sections: [] });
  });

  it('rejects an unknown template', async () => {
    expect((await call('nope')).isError).toBe(true);
  });
});
