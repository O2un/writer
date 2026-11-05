import { z } from 'zod';
import { LlmError } from './types.js';

export function parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new LlmError('response is not valid JSON');
  }
  return validateResponse(data, schema);
}

export function validateResponse<T>(data: unknown, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new LlmError(`response does not match the schema:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
