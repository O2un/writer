import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { parseJsonResponse, validateResponse } from './json.js';
import { LlmError, type LlmProvider, type LlmRequest } from './types.js';

export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type RunProcess = (bin: string, args: string[], stdin: string) => Promise<ProcessResult>;

const BASE_ARGS = ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence'];
const API_CREDENTIALS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

const resultSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
});

export function createClaudeCodeProvider(bin: string, model: string | undefined, run: RunProcess = runProcess): LlmProvider {
  const send = async ({ system, prompt }: LlmRequest, extraArgs: string[] = []) => {
    const args = [...BASE_ARGS, '--system-prompt', system, ...(model ? ['--model', model] : []), ...extraArgs];
    const { code, stdout, stderr } = await run(bin, args, prompt);

    let output;
    try {
      output = resultSchema.parse(JSON.parse(stdout));
    } catch {
      throw new LlmError(`claude exited with code ${code}: ${stderr.trim() || stdout.trim()}`);
    }
    if (code !== 0 || output.is_error) {
      throw new LlmError(`claude failed: ${output.result ?? `exit code ${code}`}`);
    }
    return output;
  };

  return {
    complete: async (request) => (await send(request)).result ?? '',
    completeJson: async <T>(request: LlmRequest, schema: z.ZodType<T>) => {
      const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema);
      const output = await send(request, ['--json-schema', JSON.stringify(jsonSchema)]);
      return output.structured_output === undefined
        ? parseJsonResponse(output.result ?? '', schema)
        : validateResponse(output.structured_output, schema);
    },
  };
}

export function runProcess(bin: string, args: string[], stdin: string): Promise<ProcessResult> {
  const env = { ...process.env };
  for (const name of API_CREDENTIALS) delete env[name];

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: tmpdir(), env, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (error) => reject(new LlmError(`cannot run ${bin}: ${error.message}. Check WRITER_CLAUDE_BIN`)));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}
