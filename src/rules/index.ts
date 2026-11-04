import type { Config } from '../config.js';
import type { Post } from '../content/post.js';
import { footnoteIntegrityRule } from './footnote-integrity.js';
import { footnoteLinkRule } from './footnote-link.js';
import { footnotePlacementRule } from './footnote-placement.js';
import { createFrontmatterRule } from './frontmatter.js';
import { SEVERITIES, type Rule, type RuleContext, type Severity, type Violation } from './types.js';

export type { Rule, RuleContext, Severity, Violation } from './types.js';
export { SEVERITIES } from './types.js';

export function createRules(config: Pick<Config, 'schema'>): readonly Rule[] {
  return [createFrontmatterRule(config.schema), footnoteIntegrityRule, footnotePlacementRule, footnoteLinkRule];
}

export interface CheckResult {
  counts: Record<Severity, number>;
  violations: Violation[];
}

export function checkPost(post: Post, context: RuleContext, rules: readonly Rule[]): CheckResult {
  const violations = rules
    .flatMap((rule) => rule.check(post, context))
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const counts = { error: 0, warning: 0, info: 0 };
  for (const v of violations) counts[v.severity]++;

  return { counts, violations };
}
