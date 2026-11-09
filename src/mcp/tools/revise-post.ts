import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import type { LlmProvider } from '../../llm/index.js';
import { editsSchema, revise, type ReviseResult } from '../../loop/revise.js';
import { readGuide } from '../../review/critique.js';
import { checkOutputSchema, createPostChecker, formatViolations, postInputSchema } from './post-check.js';

const reviseInput = {
  issues: z
    .array(z.object({ quote: z.string(), problem: z.string(), suggestion: z.string() }))
    .default([])
    .describe('Critique issues from review_post that the author chose to fix'),
  feedback: z.string().trim().min(1).optional().describe("The author's instructions for this round, such as which edits to redo and how"),
};

const edit = editsSchema.shape.edits.element;

const reviseOutput = {
  status: z.enum(['nothing-to-fix', 'proposed']).describe('nothing-to-fix: no rule errors, issues or feedback, so the LLM was not called'),
  applied: z.array(edit).describe('Edits to apply in order. Each quote appears exactly once in the text after the earlier edits'),
  rejected: z.array(edit.extend({ reason: z.enum(['not-found', 'ambiguous']) })).describe('Edits left out because their quote was missing or not unique'),
};

export function registerRevisePost(server: McpServer, config: Config, provider: LlmProvider): void {
  const load = createPostChecker(config);

  server.registerTool(
    'revise_post',
    {
      title: 'Revise post',
      description:
        'Proposes edits for one post: rule errors, the chosen critique issues and the author feedback. Runs one round and does not modify files. Show the edits to the author, apply the approved ones in order, then call again with feedback for another round. Counts and violations describe the post after all proposed edits. Uses LLM quota and can take minutes.',
      inputSchema: { ...postInputSchema(config.templates), ...reviseInput },
      outputSchema: { ...checkOutputSchema(config.templates), ...reviseOutput },
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, template, issues, feedback }): Promise<CallToolResult> => {
      const { source, report, check } = await load(path, template);
      const guide = await readGuide(config.guidePath);
      const result = await revise({ provider, guide, source, check, issues, ...(feedback && { feedback }) });
      const { counts } = check(result.revised);

      return {
        content: [{ type: 'text', text: formatResult(report.post, result, counts) }],
        structuredContent: { post: report.post, template, status: result.status, applied: result.applied, rejected: result.rejected, counts, violations: result.violations },
      };
    },
  );
}

function formatResult(post: string, { status, applied, rejected, violations }: ReviseResult, counts: Record<string, number>): string {
  return [
    `${post}: ${status}, applied ${applied.length}, rejected ${rejected.length}`,
    ...applied.map((e, i) => `[edit ${i + 1}] ${JSON.stringify(e.quote)} -> ${JSON.stringify(e.replacement)}`),
    ...rejected.map((e) => `[rejected: ${e.reason}] ${JSON.stringify(e.quote)} -> ${JSON.stringify(e.replacement)}`),
    `after edits: error ${counts.error}, warning ${counts.warning}, info ${counts.info}`,
    ...formatViolations(violations),
  ].join('\n');
}
