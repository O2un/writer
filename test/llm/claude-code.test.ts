import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createClaudeCodeProvider, runProcess, type RunProcess } from '../../src/llm/claude-code.js';
import { LlmError } from '../../src/llm/types.js';

const request = { system: '시스템', prompt: '본문' };
const schema = z.object({ passed: z.boolean() });

const answering = (body: unknown, code = 0, stderr = '') => {
  const stdout = typeof body === 'string' ? body : JSON.stringify(body);
  return vi.fn<RunProcess>(async () => ({ code, stdout, stderr }));
};

describe('claude-code provider', () => {
  it('sends the prompt on stdin and turns off tools, MCP servers and session history', async () => {
    const run = answering({ result: '답' });
    await expect(createClaudeCodeProvider('claude', undefined, run).complete(request)).resolves.toBe('답');

    const [bin, args, stdin] = run.mock.calls[0]!;
    expect(bin).toBe('claude');
    expect(stdin).toBe('본문');
    expect(args).toEqual(['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt', '시스템']);
  });

  it('passes the model only when one is set', async () => {
    const run = answering({ result: '답' });
    await createClaudeCodeProvider('claude', 'some-model', run).complete(request);
    expect(run.mock.calls[0]![1].slice(-2)).toEqual(['--model', 'some-model']);
  });

  it('sends the JSON schema and validates structured output', async () => {
    const run = answering({ structured_output: { passed: true } });
    await expect(createClaudeCodeProvider('claude', undefined, run).completeJson(request, schema)).resolves.toEqual({ passed: true });

    const args = run.mock.calls[0]![1];
    const jsonSchema = JSON.parse(args[args.indexOf('--json-schema') + 1]!);
    expect(jsonSchema).toMatchObject({ type: 'object', required: ['passed'] });
    expect(jsonSchema).not.toHaveProperty('$schema');
  });

  it('falls back to parsing the result text', async () => {
    const provider = createClaudeCodeProvider('claude', undefined, answering({ result: '{"passed":false}' }));
    await expect(provider.completeJson(request, schema)).resolves.toEqual({ passed: false });
  });

  it('rejects output that does not match the schema', async () => {
    const provider = createClaudeCodeProvider('claude', undefined, answering({ structured_output: { passed: 'yes' } }));
    await expect(provider.completeJson(request, schema)).rejects.toThrow(/does not match the schema/);
  });

  it.each([
    ['an error result', { is_error: true, result: '한도 초과' }, 0, '', 'claude failed: 한도 초과'],
    ['a failed exit with JSON', { result: '실패' }, 1, '', 'claude failed: 실패'],
    ['a failed exit without JSON', 'not json', 1, 'login required', 'claude exited with code 1: login required'],
  ])('reports %s', async (_, body, code, stderr, message) => {
    const provider = createClaudeCodeProvider('claude', undefined, answering(body, code, stderr));
    await expect(provider.complete(request)).rejects.toThrow(LlmError);
    await expect(provider.complete(request)).rejects.toThrow(message);
  });
});

describe('runProcess', () => {
  it('pipes stdin and collects stdout and the exit code', async () => {
    const script = "process.stdin.on('data', (d) => process.stdout.write(d)); process.on('exit', () => (process.exitCode = 3));";
    await expect(runProcess(process.execPath, ['-e', script], '본문')).resolves.toEqual({ code: 3, stdout: '본문', stderr: '' });
  });

  it('keeps arguments with shell characters and empty strings intact', async () => {
    const args = ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '', 'a"b&c %d% <e>'];
    const { stdout } = await runProcess(process.execPath, args, '');
    expect(JSON.parse(stdout)).toEqual(['', 'a"b&c %d% <e>']);
  });

  it('removes API credentials so the subscription is used', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'secret');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'secret');
    const script = 'process.stdout.write(String(process.env.ANTHROPIC_API_KEY) + String(process.env.ANTHROPIC_AUTH_TOKEN))';
    const { stdout } = await runProcess(process.execPath, ['-e', script], '');
    vi.unstubAllEnvs();
    expect(stdout).toBe('undefinedundefined');
  });

  it('explains a missing binary', async () => {
    await expect(runProcess('no-such-claude-binary', [], '')).rejects.toThrow(/cannot run no-such-claude-binary.*WRITER_CLAUDE_BIN/);
  });
});
