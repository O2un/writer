import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('footnote-link');

export const footnoteLinkRule: Rule = {
  id: 'footnote-link',
  check(post) {
    const violations: Violation[] = [];

    for (const def of post.definitions) {
      if (def.links.length === 0) {
        violations.push(report.error(`[^${def.label}] has no source link`, def.line));
      }
      for (const link of def.links) {
        if (!/^https?:\/\//.test(link.url)) {
          violations.push(report.error(`[^${def.label}] link is not http(s): ${link.url}`, def.line));
        }
      }
    }

    return violations;
  },
};
