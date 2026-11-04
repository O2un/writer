import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { parseJsonResponse } from './json.js';
import { LlmError, type LlmProvider, type LlmRequest } from './types.js';

const DEFAULT_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 64000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type OutputFormat = ReturnType<typeof zodOutputFormat>;

export function createAnthropicProvider(model: string = DEFAULT_MODEL): LlmProvider {
  const client = new Anthropic();

  const send = async ({ system, prompt }: LlmRequest, format?: OutputFormat): Promise<string> => {
    let message;
    try {
      message = await client.beta.messages
        .stream({
          model,
          max_tokens: MAX_TOKENS,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: prompt }],
          output_config: { effort: 'high', ...(format && { format }) },
        })
        .finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new LlmError(`Anthropic API error ${error.status}: ${error.message}`);
      }
      throw error;
    }

    if (message.stop_reason === 'refusal') throw new LlmError('the model refused the request');
    if (message.stop_reason === 'max_tokens') throw new LlmError('the response hit the token limit');

    return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
  };

  return {
    complete: (request) => send(request),
    completeJson: async <T>(request: LlmRequest, schema: z.ZodType<T>) =>
      parseJsonResponse(await send(request, zodOutputFormat(schema)), schema),
  };
}
