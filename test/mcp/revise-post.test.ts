import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import type { LlmProvider, LlmRequest } from '../../src/llm/index.js';
import { createServer } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG, FIXTURE_CONTENT_DIR } from '../fixtures.js';

const CLEAN_FILE = path.join(FIXTURE_CONTENT_DIR, 'sample', 'clean', 'index.md');
const ISSUE = { quote: '깨끗한 글', problem: 'vague title', suggestion: 'name the topic' };

describe('revise_post', () => {
  let client: Client;

  const connect = async (edits: unknown[]) => {
    const completeJson = vi.fn(async (_: LlmRequest, schema: z.ZodType) => schema.parse({ edits }));
    const provider = { complete: vi.fn(), completeJson } as unknown as LlmProvider;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([createServer(FIXTURE_CONFIG, provider).connect(serverTransport), client.connect(clientTransport)]);
    return completeJson;
  };

  const call = (args: Record<string, unknown>) => client.callTool({ name: 'revise_post', arguments: args });
  const text = (result: Awaited<ReturnType<typeof call>>) => (result.content as { text: string }[])[0]?.text;

  afterEach(() => client.close());

  it('does not call the LLM for a clean post without issues or feedback', async () => {
    const completeJson = await connect([]);
    const result = await call({ path: 'sample/clean' });
    expect(result.structuredContent).toEqual({
      post: 'sample/clean/index.md',
      template: 'article',
      status: 'nothing-to-fix',
      applied: [],
      rejected: [],
      counts: { error: 0, warning: 0, info: 0 },
      violations: [],
    });
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('proposes edits for a selected issue without touching the file', async () => {
    const before = readFileSync(CLEAN_FILE, 'utf8');
    const edit = { quote: "title: '깨끗한 글'", replacement: "title: '규칙 예시'" };
    await connect([edit, { quote: '없는 문장', replacement: 'x' }]);

    const result = await call({ path: 'sample/clean', issues: [{ ...ISSUE, severity: 'warning' }] });
    expect(result.structuredContent).toMatchObject({
      status: 'proposed',
      applied: [edit],
      rejected: [{ quote: '없는 문장', replacement: 'x', reason: 'not-found' }],
      counts: { error: 0, warning: 0, info: 0 },
    });
    expect(text(result)).toBe(
      [
        'sample/clean/index.md: proposed, applied 1, rejected 1',
        `[edit 1] "title: '깨끗한 글'" -> "title: '규칙 예시'"`,
        '[rejected: not-found] "없는 문장" -> "x"',
        'after edits: error 0, warning 0, info 0',
      ].join('\n'),
    );
    expect(readFileSync(CLEAN_FILE, 'utf8')).toBe(before);
  });

  it('sends the rule errors, the issues, the feedback and the site guide', async () => {
    const completeJson = await connect([]);
    await call({ path: 'sample/broken', issues: [ISSUE], feedback: '제목은 그대로' });
    const [request] = completeJson.mock.calls[0]!;
    expect(request.prompt).toContain("L1 frontmatter: must have required property 'description'");
    expect(request.prompt).toContain('"깨끗한 글": vague title Fix: name the topic');
    expect(request.prompt).toContain('<feedback>\n제목은 그대로\n</feedback>');
    expect(request.prompt).not.toContain("unknown field 'thumbnial'");
    expect(request.system).toContain('Fixture guide');
  });

  it('reports the rule check after the edits', async () => {
    await connect([{ quote: "accent: 'pink'", replacement: '' }]);
    const result = await call({ path: 'sample/broken' });
    expect(result.structuredContent).toMatchObject({ status: 'proposed', counts: { error: 2, warning: 1 } });
    expect(text(result)).toContain("after edits: error 2, warning 1, info 0\nL1 [error] frontmatter: must have required property 'description'");
  });

  it('rejects blank feedback', async () => {
    await connect([]);
    expect((await call({ path: 'sample/clean', feedback: '  ' })).isError).toBe(true);
  });

  it('answers with a tool error for a missing post', async () => {
    const completeJson = await connect([]);
    const result = await call({ path: 'sample/nope' });
    expect(result.isError).toBe(true);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('is listed as a read-only tool that reaches outside', async () => {
    await connect([]);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['list_posts', 'check_post', 'review_post', 'revise_post']);
    expect(tools.find((t) => t.name === 'revise_post')?.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: true });
  });
});
