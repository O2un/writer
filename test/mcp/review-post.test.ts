import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { LlmError, type LlmProvider, type LlmRequest } from '../../src/llm/index.js';
import { createServer } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG } from '../fixtures.js';

const ISSUE = { severity: 'error', quote: '이건 뒤에서 다룬다', problem: 'forward reference', suggestion: 'remove the sentence' };

describe('review_post', () => {
  let client: Client;

  const connect = async (answer: () => unknown, config = FIXTURE_CONFIG) => {
    const completeJson = vi.fn(async (_: LlmRequest, schema: z.ZodType) => schema.parse(answer()));
    const provider = { complete: vi.fn(), completeJson } as unknown as LlmProvider;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([createServer(config, provider).connect(serverTransport), client.connect(clientTransport)]);
    return completeJson;
  };

  const call = (path: string, template?: string) => client.callTool({ name: 'review_post', arguments: { path, ...(template && { template }) } });

  afterEach(() => client.close());

  it('passes when the rules and the critique find nothing', async () => {
    await connect(() => ({ issues: [] }));
    const result = await call('sample/clean');
    expect(result.structuredContent).toEqual({
      post: 'sample/clean/index.md',
      template: 'article',
      passed: true,
      counts: { error: 0, warning: 0, info: 0 },
      violations: [],
      issues: [],
    });
    expect(result.content).toEqual([{ type: 'text', text: 'sample/clean/index.md: error 0, warning 0, info 0\ncritique: error 0, warning 0' }]);
  });

  it('fails when the critique finds an issue and reports it in the text', async () => {
    await connect(() => ({ issues: [ISSUE] }));
    const result = await call('sample/clean');
    expect(result.structuredContent).toMatchObject({ passed: false, issues: [ISSUE] });
    expect((result.content as { text: string }[])[0]?.text).toContain('critique: error 1, warning 0\n[error] "이건 뒤에서 다룬다": forward reference Fix: remove the sentence');
  });

  it('also fails on a warning, as check_post does', async () => {
    await connect(() => ({ issues: [{ ...ISSUE, severity: 'warning' }] }));
    const result = await call('sample/clean');
    expect(result.structuredContent).toMatchObject({ passed: false });
    expect((result.content as { text: string }[])[0]?.text).toContain('critique: error 0, warning 1\n[warning]');
  });

  it('still runs the critique when the rules find violations', async () => {
    const completeJson = await connect(() => ({ issues: [] }));
    const result = await call('sample/broken');
    expect(result.structuredContent).toMatchObject({ passed: false, counts: { error: 3, warning: 1 } });
    expect(completeJson).toHaveBeenCalledOnce();
  });

  it('sends the site guide and the post to the provider', async () => {
    const completeJson = await connect(() => ({ issues: [] }));
    await call('sample/clean');
    const [request] = completeJson.mock.calls[0]!;
    expect(request.system).toContain('Fixture guide');
    expect(request.prompt).toMatch(/^<post>\n---/);
  });

  it('does not call the LLM for a missing post', async () => {
    const completeJson = await connect(() => ({ issues: [] }));
    const result = await call('sample/nope');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringMatching(/post not found/) }]);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('does not call the LLM without a guide file', async () => {
    const completeJson = await connect(() => ({ issues: [] }), { ...FIXTURE_CONFIG, guidePath: 'nope.md' });
    const result = await call('sample/clean');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: expect.stringMatching(/Check WRITER_GUIDE/) }]);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('answers with a tool error when the LLM fails', async () => {
    await connect(() => {
      throw new LlmError('claude failed: 한도 초과');
    });
    const result = await call('sample/clean');
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'claude failed: 한도 초과' }]);
  });

  it('is listed as a read-only tool that reaches outside', async () => {
    await connect(() => ({ issues: [] }));
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === 'review_post')?.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: true });
  });
});
