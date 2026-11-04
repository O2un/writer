import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseJsonResponse } from '../../src/llm/json.js';
import { LlmError } from '../../src/llm/types.js';

const schema = z.object({ passed: z.boolean(), notes: z.array(z.string()) });

describe('parseJsonResponse', () => {
  it('returns the validated value', () => {
    expect(parseJsonResponse('{"passed":true,"notes":["a"]}', schema)).toEqual({ passed: true, notes: ['a'] });
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseJsonResponse('not json', schema)).toThrow(LlmError);
    expect(() => parseJsonResponse('not json', schema)).toThrow('response is not valid JSON');
  });

  it('names the field that does not match the schema', () => {
    expect(() => parseJsonResponse('{"passed":"yes","notes":[]}', schema)).toThrow(LlmError);
    expect(() => parseJsonResponse('{"passed":"yes","notes":[]}', schema)).toThrow(/does not match the schema[\s\S]*passed/);
  });
});
