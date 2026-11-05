import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { checkOutputSchema, createPostChecker, formatReport, postInputSchema, rulesPassed } from './post-check.js';

const outputSchema = {
  ...checkOutputSchema,
  passed: z.boolean().describe('True when there are no errors or warnings. Info is advisory and does not affect the result'),
};

export function registerCheckPost(server: McpServer, config: Config): void {
  const check = createPostChecker(config);

  server.registerTool(
    'check_post',
    {
      title: 'Check post rules',
      description: 'Runs deterministic rule checks on one post and returns the violations. Does not use an LLM or modify files.',
      inputSchema: postInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ path, template }): Promise<CallToolResult> => {
      const { report } = await check(path, template);
      return {
        content: [{ type: 'text', text: formatReport(report) }],
        structuredContent: { ...report, passed: rulesPassed(report) },
      };
    },
  );
}
