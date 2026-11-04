import { existsSync } from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { parsePost } from '../../content/post.js';
import { PostNotFoundError, PostOutsideBlogError, readPost } from '../../content/posts.js';
import { checkPost, SEVERITIES, type CheckResult, type RuleContext } from '../../rules/index.js';

const inputSchema = {
  path: z
    .string()
    .min(1)
    .describe('src/content/blog 기준 글 경로. 글 폴더(예: 선택/Loop)나 파일(예: 선택/Loop/index.md) 모두 받는다'),
};

const outputSchema = {
  post: z.string().describe('src/content/blog 기준 파일 경로'),
  passed: z.boolean().describe('error와 warning이 하나도 없으면 true. info는 권고라 판정에 넣지 않는다'),
  counts: z.object({ error: z.number().int(), warning: z.number().int(), info: z.number().int() }),
  violations: z.array(
    z.object({
      rule: z.string(),
      severity: z.enum(SEVERITIES),
      message: z.string(),
      line: z.number().int().optional(),
    }),
  ),
};

export function registerCheckPost(server: McpServer, config: Config): void {
  server.registerTool(
    'check_post',
    {
      title: '글 규칙 검사',
      description: 'devlog 글 하나에 결정적 규칙 검사를 돌리고 위반 목록을 돌려준다. LLM을 쓰지 않고 파일을 고치지 않는다.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: input }): Promise<CallToolResult> => {
      let file;
      try {
        file = await readPost(config.blogDir, input);
      } catch (error) {
        if (error instanceof PostNotFoundError || error instanceof PostOutsideBlogError) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
        throw error;
      }

      const postDir = path.dirname(file.absolutePath);
      const context: RuleContext = { assetExists: (relative) => existsSync(path.resolve(postDir, relative)) };
      const result = checkPost(parsePost(file.source), context);
      const output = { post: file.relativePath, passed: result.counts.error + result.counts.warning === 0, ...result };

      return {
        content: [{ type: 'text', text: formatReport(output.post, result) }],
        structuredContent: output,
      };
    },
  );
}

function formatReport(post: string, { counts, violations }: CheckResult): string {
  const summary = `${post}: error ${counts.error}, warning ${counts.warning}, info ${counts.info}`;
  const lines = violations.map((v) => `${v.line ? `L${v.line}` : '-'} [${v.severity}] ${v.rule}: ${v.message}`);
  return [summary, ...lines].join('\n');
}
