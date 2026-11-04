import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('footnote-placement');

export const footnotePlacementRule: Rule = {
  id: 'footnote-placement',
  check(post, context) {
    if (post.definitions.length === 0) return [];

    const heading = context.template.referencesHeading;
    const section = post.headings.find((h) => h.text === heading);
    if (!section) {
      return [report.error(`footnote definitions need a '${heading}' section`, post.definitions[0]!.line)];
    }

    const violations: Violation[] = [];

    const after = post.headings.find((h) => h.line > section.line && h.depth <= section.depth);
    if (after) {
      violations.push(report.error(`section '${after.text}' follows '${heading}', which must be the last section`, after.line));
    }

    for (const def of post.definitions) {
      if (def.line < section.line || (after && def.line > after.line)) {
        violations.push(report.error(`[^${def.label}] definition is outside the '${heading}' section`, def.line));
      }
    }

    return violations;
  },
};
