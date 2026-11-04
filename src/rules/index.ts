import type { Post } from '../content/post.js';
import { SEVERITIES, type Rule, type RuleContext, type Severity, type Violation } from './types.js';

export type { Rule, RuleContext, Severity, Violation } from './types.js';
export { SEVERITIES } from './types.js';

export const RULES: readonly Rule[] = [];

export interface CheckResult {
  counts: Record<Severity, number>;
  violations: Violation[];
}

export function checkPost(post: Post, context: RuleContext, rules: readonly Rule[] = RULES): CheckResult {
  const violations = rules
    .flatMap((rule) => rule.check(post, context))
    .sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const counts = { error: 0, warning: 0, info: 0 };
  for (const v of violations) counts[v.severity]++;

  return { counts, violations };
}
