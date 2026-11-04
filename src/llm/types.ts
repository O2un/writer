import type { z } from 'zod';

export const LLM_PROVIDERS = ['claude-code', 'anthropic-api'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export interface LlmRequest {
  system: string;
  prompt: string;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<string>;
  completeJson<T>(request: LlmRequest, schema: z.ZodType<T>): Promise<T>;
}

export class LlmError extends Error {
  override name = 'LlmError';
}
