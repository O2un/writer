import { normalizeLabel } from '../content/body.js';
import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('footnote-integrity');

export const footnoteIntegrityRule: Rule = {
  id: 'footnote-integrity',
  check(post) {
    const violations: Violation[] = [];

    for (const ref of post.references) {
      if (!ref.resolved) violations.push(report.error(`[^${ref.label}] has no definition`, ref.line));
    }

    const referenced = new Set(post.references.map((r) => normalizeLabel(r.label)));
    const seen = new Map<string, number>();
    for (const def of post.definitions) {
      const key = normalizeLabel(def.label);
      const firstLine = seen.get(key);
      if (firstLine !== undefined) {
        violations.push(report.error(`[^${def.label}] is defined twice (first at line ${firstLine})`, def.line));
        continue;
      }
      seen.set(key, def.line);
      if (!referenced.has(key)) {
        violations.push(report.error(`[^${def.label}] is never used in the body`, def.line));
      }
    }

    return violations;
  },
};
