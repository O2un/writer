import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { parsePost } from '../../content/post.js';
import { readPost } from '../../content/posts.js';
import { checkPost, createRules, SEVERITIES, type CheckResult, type Violation } from '../../rules/index.js';
import type { Template, Templates } from '../../templates/index.js';

export function templateInput({ ids, defaultId, byId }: Templates) {
  return z
    .enum(ids)
    .default(defaultId)
    .describe(`Post template. ${ids.map((id) => `${id}: ${byId[id]?.description}`).join('; ')}`);
}

export function postInputSchema(templates: Templates) {
  return {
    path: z
      .string()
      .min(1)
      .describe('Post path relative to the content folder. Accepts a post folder (e.g. notes/hello) or a file (e.g. notes/hello/index.md)'),
    template: templateInput(templates),
  };
}

export function checkOutputSchema({ ids }: Templates) {
  return {
    post: z.string().describe('File path relative to the content folder'),
    template: z.enum(ids).describe('Template the post was checked against'),
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
}

export interface CheckReport extends CheckResult {
  post: string;
  template: string;
}

export interface LoadedPost {
  source: string;
  report: CheckReport;
  check: (source: string) => CheckResult;
}

export function createPostChecker(config: Config) {
  const rules = createRules(config);

  return async (input: string, template: string): Promise<LoadedPost> => {
    const file = await readPost(config.contentDir, input);
    const postDir = path.dirname(file.absolutePath);
    const context = {
      assetExists: (relative: string) => existsSync(path.resolve(postDir, relative)),
      template: templateById(config.templates, template),
    };
    const check = (source: string) => checkPost(parsePost(source), context, rules);
    return { source: file.source, report: { post: file.relativePath, template, ...check(file.source) }, check };
  };
}

export function templateById({ byId }: Templates, id: string): Template {
  const template = byId[id];
  if (!template) throw new Error(`unknown template: ${id}`);
  return template;
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
