import { describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import type { LlmProvider, LlmRequest } from '../../src/llm/index.js';
import { LlmError } from '../../src/llm/index.js';
import { applyEdits, revise, type PostEdit, type ReviseInput } from '../../src/loop/revise.js';
import type { CheckResult, Violation } from '../../src/rules/index.js';

const violation = (severity: Violation['severity'], rule: string): Violation => ({ rule, severity, message: `${rule} message`, line: 1 });

const check = (source: string): CheckResult => {
  const violations = [
    ...(source.includes('BAD') ? [violation('error', 'bad-rule')] : []),
    ...(source.includes('MEH') ? [violation('warning', 'meh-rule')] : []),
  ];
  const errors = violations.filter((v) => v.severity === 'error').length;
  return { counts: { error: errors, warning: violations.length - errors, info: 0 }, violations };
};

const answering = (edits: PostEdit[]) => {
  const completeJson = vi.fn(async (_: LlmRequest, schema: z.ZodType) => schema.parse({ edits }));
  return { provider: { complete: vi.fn(), completeJson } as unknown as LlmProvider, completeJson };
};

const run = (provider: LlmProvider, source: string, extra: Partial<ReviseInput> = {}) =>
  revise({ provider, guide: '가이드', source, check, issues: [], ...extra });

const ISSUE = { quote: '글', problem: 'unclear', suggestion: 'rewrite' };

describe('revise', () => {
  it('does not call the LLM when there is nothing to fix and returns warnings as they are', async () => {
    const { provider, completeJson } = answering([]);
    const result = await run(provider, '글 MEH');
    expect(result).toMatchObject({ status: 'nothing-to-fix', revised: '글 MEH', applied: [], rejected: [] });
    expect(result.violations.map((v) => v.rule)).toEqual(['meh-rule']);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('calls the LLM once and reports the rule check of the revised text', async () => {
    const { provider, completeJson } = answering([{ quote: 'BAD', replacement: 'good MEH' }]);
    const result = await run(provider, '글 BAD');
    expect(result).toMatchObject({ status: 'proposed', revised: '글 good MEH', applied: [{ quote: 'BAD', replacement: 'good MEH' }], rejected: [] });
    expect(result.violations.map((v) => v.rule)).toEqual(['meh-rule']);
    expect(completeJson).toHaveBeenCalledOnce();
  });

  it('reports a rule error that the edits did not fix', async () => {
    const { provider } = answering([{ quote: '글', replacement: '수정' }]);
    const result = await run(provider, '글 BAD');
    expect(result.violations.map((v) => v.rule)).toEqual(['bad-rule']);
  });

  it('reports edits it could not apply', async () => {
    const { provider } = answering([{ quote: '없는 문장', replacement: '수정' }]);
    const result = await run(provider, '글 BAD');
    expect(result).toMatchObject({ revised: '글 BAD', applied: [], rejected: [{ quote: '없는 문장', replacement: '수정', reason: 'not-found' }] });
  });

  it('asks for rule errors and selected issues, never rule warnings', async () => {
    const { provider, completeJson } = answering([]);
    await run(provider, '글 BAD MEH', { issues: [ISSUE] });
    const [request] = completeJson.mock.calls[0]!;
    expect(request.prompt).toContain('Problems to fix:\n- L1 bad-rule: bad-rule message\n- "글": unclear Fix: rewrite');
    expect(request.prompt).not.toContain('meh-rule');
    expect(request.system).toContain('<guide>\n가이드\n</guide>');
  });

  it('sends the author feedback even when nothing else needs fixing', async () => {
    const { provider, completeJson } = answering([{ quote: '글', replacement: '수정' }]);
    const result = await run(provider, '글', { feedback: '2번은 더 짧게' });
    expect(result).toMatchObject({ status: 'proposed', revised: '수정' });
    const [request] = completeJson.mock.calls[0]!;
    expect(request.prompt).toContain('Author feedback:\n<feedback>\n2번은 더 짧게\n</feedback>');
    expect(request.prompt).not.toContain('Problems to fix');
  });

  it('passes LLM failures to the caller', async () => {
    const provider = { complete: vi.fn(), completeJson: vi.fn(async () => Promise.reject(new LlmError('한도 초과'))) } as unknown as LlmProvider;
    await expect(run(provider, '글 BAD')).rejects.toThrow('한도 초과');
  });
});

describe('applyEdits', () => {
  it('applies edits in order against the updated text', () => {
    const edits = [
      { quote: '하나', replacement: '둘' },
      { quote: '둘', replacement: '셋' },
    ];
    expect(applyEdits('하나', edits)).toEqual({ source: '셋', applied: edits, rejected: [] });
  });

  it('deletes the quote when the replacement is empty', () => {
    expect(applyEdits('앞 지울 말 뒤', [{ quote: '지울 말 ', replacement: '' }]).source).toBe('앞 뒤');
  });

  it('rejects a quote that is missing and leaves the text alone', () => {
    const result = applyEdits('글', [{ quote: '없음', replacement: 'x' }]);
    expect(result).toEqual({ source: '글', applied: [], rejected: [{ quote: '없음', replacement: 'x', reason: 'not-found' }] });
  });

  it('rejects a quote that appears more than once and leaves the text alone', () => {
    const result = applyEdits('글 글', [{ quote: '글', replacement: 'x' }]);
    expect(result).toEqual({ source: '글 글', applied: [], rejected: [{ quote: '글', replacement: 'x', reason: 'ambiguous' }] });
  });

  it('rejects an empty quote', () => {
    expect(applyEdits('글', [{ quote: '', replacement: 'x' }]).rejected[0]?.reason).toBe('ambiguous');
  });

  it('treats the replacement as plain text', () => {
    expect(applyEdits('글', [{ quote: '글', replacement: "$& $' $1" }]).source).toBe("$& $' $1");
  });
});
