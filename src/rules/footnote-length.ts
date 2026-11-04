import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('footnote-length');

const MAX_LENGTH = 150;

export const footnoteLengthRule: Rule = {
  id: 'footnote-length',
  check(post) {
    const violations: Violation[] = [];

    for (const def of post.definitions) {
      const length = visibleLength(def.explanation);
      if (length > MAX_LENGTH) {
        violations.push(report.warning(`[^${def.label}] explanation is ${length} characters, over the recommended ${MAX_LENGTH}`, def.line));
      }
    }

    return violations;
  },
};

function visibleLength(text: string): number {
  return Array.from(text.replace(/[`*]/g, '')).length;
}
