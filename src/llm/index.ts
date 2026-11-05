import type { Config } from '../config.js';
import { createAnthropicProvider } from './anthropic-api.js';
import { createClaudeCodeProvider } from './claude-code.js';
import type { LlmProvider } from './types.js';

export type { LlmProvider, LlmRequest } from './types.js';
export { LlmError } from './types.js';

export function createProvider({ provider, model, claudeBin }: Config['llm']): LlmProvider {
  switch (provider) {
    case 'claude-code':
      return createClaudeCodeProvider(claudeBin, model);
    case 'anthropic-api':
      return createAnthropicProvider(model);
  }
}
