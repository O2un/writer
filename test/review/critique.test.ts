import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCritiqueRequest, critiqueSchema, readGuide } from '../../src/review/critique.js';
import { FIXTURE_CONFIG } from '../fixtures.js';
import { FIXTURE_SITE_ROOT } from '../fixtures.js';

const template = FIXTURE_CONFIG.templates.byId.article!;

describe('buildCritiqueRequest', () => {
  it('puts the guide in the system prompt and the post in the prompt', () => {
    const { system, prompt } = buildCritiqueRequest('가이드 내용', template, '글 내용');
    expect(system).toContain('<guide>\n가이드 내용\n</guide>');
    expect(system).not.toContain('글 내용');
    expect(prompt).toBe('<post>\n글 내용\n</post>');
  });

  it('adds the template criteria when there are any', () => {
    const { system } = buildCritiqueRequest('가이드', { ...template, criteria: ['기준 하나', '기준 둘'] }, '글');
    expect(system).toContain('Criteria for this kind of post:\n- 기준 하나\n- 기준 둘');
  });

  it('leaves out the criteria section when the template has none', () => {
    expect(buildCritiqueRequest('가이드', template, '글').system).not.toContain('Criteria for this kind of post');
  });
});

describe('critiqueSchema', () => {
  it('rejects an issue without a quote', () => {
    expect(critiqueSchema.safeParse({ issues: [{ severity: 'error', problem: '문제', suggestion: '수정' }] }).success).toBe(false);
  });

  it('accepts only error and warning as severity', () => {
    const issue = { quote: '인용', problem: '문제', suggestion: '수정' };
    expect(critiqueSchema.safeParse({ issues: [{ ...issue, severity: 'warning' }] }).success).toBe(true);
    expect(critiqueSchema.safeParse({ issues: [{ ...issue, severity: 'info' }] }).success).toBe(false);
  });
});

describe('readGuide', () => {
  it('reads the file on each call', async () => {
    await expect(readGuide(path.join(FIXTURE_SITE_ROOT, 'guide.md'))).resolves.toContain('Fixture guide');
  });

  it('names the setting when the file cannot be read', async () => {
    await expect(readGuide('nope.md')).rejects.toThrow('cannot read guide file: nope.md. Check WRITER_GUIDE');
  });
});
