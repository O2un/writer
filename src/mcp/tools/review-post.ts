import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import type { LlmProvider } from '../../llm/index.js';
import { critiquePost, critiqueSchema, readGuide, type CritiqueIssue } from '../../review/critique.js';
import { checkOutputSchema, createPostChecker, formatReport, postInputSchema, rulesPassed, templateById } from './post-check.js';

const reviewFields = {
  passed: z.boolean().describe('True when the rule checks pass and the critique has no issues'),
  issues: critiqueSchema.shape.issues.describe('Problems found by the LLM critique'),
};

export function registerReviewPost(server: McpServer, config: Config, provider: LlmProvider): void {
  const check = createPostChecker(config);

  server.registerTool(
    'review_post',
    {
      title: 'Review post',
      description: 'Runs the rule checks and an LLM critique on one post and returns both. Does not modify files. Uses LLM quota and can take minutes.',
      inputSchema: postInputSchema(config.templates),
      outputSchema: { ...checkOutputSchema(config.templates), ...reviewFields },
      annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, template }): Promise<CallToolResult> => {
      const { source, report } = await check(path, template);
      const guide = await readGuide(config.guidePath);
      const issues = await critiquePost(provider, guide, templateById(config.templates, template), source);

      return {
        content: [{ type: 'text', text: [formatReport(report), ...formatIssues(issues)].join('\n') }],
        structuredContent: { ...report, passed: rulesPassed(report) && issues.length === 0, issues },
      };
    },
  );
}

function formatIssues(issues: CritiqueIssue[]): string[] {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const summary = `critique: error ${errors}, warning ${issues.length - errors}`;
  return [summary, ...issues.map((i) => `[${i.severity}] "${i.quote}": ${i.problem} Fix: ${i.suggestion}`)];
}
