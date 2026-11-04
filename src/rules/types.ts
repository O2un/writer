import type { Post } from '../content/post.js';
import type { Template } from '../templates/index.js';

export const SEVERITIES = ['error', 'warning', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  line?: number;
}

export interface RuleContext {
  assetExists(relativePath: string): boolean;
  template: Template;
}

export interface Rule {
  id: string;
  check(post: Post, context: RuleContext): Violation[];
}

export function reporter(rule: string) {
  const make =
    (severity: Severity) =>
    (message: string, line?: number): Violation =>
      line === undefined ? { rule, severity, message } : { rule, severity, message, line };
  return { error: make('error'), warning: make('warning'), info: make('info') };
}
