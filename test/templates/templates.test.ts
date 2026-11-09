import { describe, expect, it } from 'vitest';
import { parseTemplates, TemplatesError } from '../../src/templates/index.js';

const minimal = { description: 'General', referencesHeading: '참고 자료' };

describe('parseTemplates', () => {
  it('fills optional lists with empty defaults and keeps file order', () => {
    const templates = parseTemplates({ default: 'b', templates: { b: minimal, a: minimal } });
    expect(templates.ids).toEqual(['b', 'a']);
    expect(templates.defaultId).toBe('b');
    expect(templates.byId.a).toEqual({ ...minimal, frontmatter: {}, sections: [], criteria: [] });
  });

  it('keeps research and prompt guidance on sections and fields', () => {
    const section = { heading: '총평', research: '공식 소개', prompt: '추천할 대상' };
    const raw = { default: 'a', templates: { a: { ...minimal, sections: [section], frontmatter: { 'escape.cafe': { research: '매장' } } } } };
    const { byId } = parseTemplates(raw);
    expect(byId.a?.sections).toEqual([section]);
    expect(byId.a?.frontmatter).toEqual({ 'escape.cafe': { research: '매장' } });
  });

  it.each([
    ['an empty template list', { default: 'a', templates: {} }, /templates: templates is empty/],
    ['a default that names no template', { default: 'x', templates: { a: minimal } }, /default: default does not name a template/],
    ['an id that is not kebab-case', { default: 'A b', templates: { 'A b': minimal } }, /templates/],
    ['a section without a heading', { default: 'a', templates: { a: { ...minimal, sections: [{ prompt: '감상' }] } } }, /templates\.a\.sections\.0\.heading/],
  ])('rejects %s', (_, raw, message) => {
    expect(() => parseTemplates(raw)).toThrow(TemplatesError);
    expect(() => parseTemplates(raw)).toThrow(message);
  });
});
