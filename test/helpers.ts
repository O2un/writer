export function explanation(length: number): string {
  return `${'가'.repeat(length - 1)}.`;
}

export function definition(label: string, text = explanation(50), link = '[문서 제목 - 출처](https://example.com)'): string {
  return `[^${label}]: ${text} — ${link}`;
}

export function withReferences(body: string, ...definitions: string[]): string {
  return [body, '', '## 참고 자료', '', ...definitions].join('\n');
}
