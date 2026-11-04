import { existsSync } from 'node:fs';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { parsePost } from '../../content/post.js';
import { PostNotFoundError, PostOutsideContentError, readPost } from '../../content/posts.js';
import { checkPost, SEVERITIES, type CheckResult, type RuleContext } from '../../rules/index.js';

const inputSchema = {
  path: z
    .string()
    .min(1)
    .describe('Post path relative to the content folder. Accepts a post folder (e.g. notes/hello) or a file (e.g. notes/hello/index.md)'),
};

const outputSchema = {
  post: z.string().describe('File path relative to the content folder'),
  passed: z.boolean().describe('True when there are no errors or warnings. Info is advisory and does not affect the result'),
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
      title: 'Check post rules',
      description: 'Runs deterministic rule checks on one post and returns the violations. Does not use an LLM or modify files.',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path: input }): Promise<CallToolResult> => {
      let file;
      try {
        file = await readPost(config.contentDir, input);
      } catch (error) {
        if (error instanceof PostNotFoundError || error instanceof PostOutsideContentError) {
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
