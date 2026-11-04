import type { RuleContext } from '../src/rules/index.js';
import { DEFAULT_TEMPLATE_ID, TEMPLATES } from '../src/templates/index.js';

export function explanation(length: number): string {
  return `${'가'.repeat(length - 1)}.`;
}

export function definition(label: string, text = explanation(50), link = '[문서 제목 - 출처](https://example.com)'): string {
  return `[^${label}]: ${text} — ${link}`;
}

export function withReferences(body: string, ...definitions: string[]): string {
  return [body, '', '## 참고 자료', '', ...definitions].join('\n');
}

export const allAssets: RuleContext = { assetExists: () => true, template: TEMPLATES[DEFAULT_TEMPLATE_ID] };
