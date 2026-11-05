import { describe, expect, it } from 'vitest';
import { createProvider } from '../../src/llm/index.js';

describe('createProvider', () => {
  it.each(['claude-code', 'anthropic-api'] as const)('creates the %s provider without calling it', (provider) => {
    expect(createProvider({ provider, claudeBin: 'claude' })).toMatchObject({
      complete: expect.any(Function),
      completeJson: expect.any(Function),
    });
  });
});
