import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { parsePost } from '../../content/post.js';
import { readPost } from '../../content/posts.js';
import { checkPost, createRules, SEVERITIES, type CheckResult, type Violation } from '../../rules/index.js';
import { DEFAULT_TEMPLATE_ID, TEMPLATE_IDS, TEMPLATES, type TemplateId } from '../../templates/index.js';

export const postInputSchema = {
  path: z
    .string()
    .min(1)
    .describe('Post path relative to the content folder. Accepts a post folder (e.g. notes/hello) or a file (e.g. notes/hello/index.md)'),
  template: z
    .enum(TEMPLATE_IDS)
    .default(DEFAULT_TEMPLATE_ID)
    .describe(`Post template to check against. ${TEMPLATE_IDS.map((id) => `${id}: ${TEMPLATES[id].description}`).join('; ')}`),
};

export const checkOutputSchema = {
  post: z.string().describe('File path relative to the content folder'),
  template: z.enum(TEMPLATE_IDS).describe('Template the post was checked against'),
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

export interface CheckReport extends CheckResult {
  post: string;
  template: TemplateId;
}

export interface LoadedPost {
  source: string;
  report: CheckReport;
  check: (source: string) => CheckResult;
}

export function createPostChecker(config: Config) {
  const rules = createRules(config);

  return async (input: string, template: TemplateId): Promise<LoadedPost> => {
    const file = await readPost(config.contentDir, input);
    const postDir = path.dirname(file.absolutePath);
    const context = {
      assetExists: (relative: string) => existsSync(path.resolve(postDir, relative)),
      template: TEMPLATES[template],
    };
    const check = (source: string) => checkPost(parsePost(source), context, rules);
    return { source: file.source, report: { post: file.relativePath, template, ...check(file.source) }, check };
  };
}

export function rulesPassed({ counts }: CheckResult): boolean {
  return counts.error + counts.warning === 0;
}

export function formatReport({ post, counts, violations }: CheckReport): string {
  const summary = `${post}: error ${counts.error}, warning ${counts.warning}, info ${counts.info}`;
  return [summary, ...formatViolations(violations)].join('\n');
}

export function formatViolations(violations: readonly Violation[]): string[] {
  return violations.map((v) => `${v.line ? `L${v.line}` : '-'} [${v.severity}] ${v.rule}: ${v.message}`);
}
