import { splitFrontmatter } from '../content/frontmatter.js';
import { reporter, type Rule, type Violation } from './types.js';

const report = reporter('todo');

const TODO = /^TODO\b:?\s*/;
const YAML_TODO = /(?:^|\s)#\s*(TODO\b.*)$/;

export const todoRule: Rule = {
  id: 'todo',
  check(post) {
    if (post.frontmatter.status !== 'ok' || post.frontmatter.data.draft === true) return [];

    const violations: Violation[] = [];
    const raw = splitFrontmatter(post.source).frontmatter;
    raw?.yaml.split('\n').forEach((text, index) => {
      const match = YAML_TODO.exec(text);
      if (match) violations.push(found(match[1]!, raw.line + index));
    });
    for (const comment of post.comments) {
      if (TODO.test(comment.text)) violations.push(found(comment.text, comment.line));
    }
    return violations;
  },
};

function found(text: string, line: number): Violation {
  const note = text.replace(TODO, '').trim();
  return report.info(`TODO left in a published post${note ? `: ${note}` : ''}`, line);
}
