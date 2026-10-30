import { describe, expect, it } from 'vitest';
import { parseFrontmatter, splitFrontmatter } from '../../src/content/frontmatter.js';

const parse = (source: string) => parseFrontmatter(splitFrontmatter(source).frontmatter);

describe('splitFrontmatter', () => {
  it('blanks the block out of the body without moving any offset', () => {
    const source = '---\ntitle: a\n---\n\n본문';
    const { frontmatter, body } = splitFrontmatter(source);
    expect(frontmatter).toEqual({ yaml: '\ntitle: a\n', line: 1 });
    expect(body).toBe('   \n        \n   \n\n본문');
    expect(body).toHaveLength(source.length);
  });

  it('accepts blank lines and a BOM before the block', () => {
    expect(splitFrontmatter('\n\n---\ntitle: a\n---\n').frontmatter?.line).toBe(3);
    expect(splitFrontmatter('\uFEFF---\ntitle: a\n---\n').frontmatter?.line).toBe(1);
  });

  it('leaves the source untouched when there is no block', () => {
    expect(splitFrontmatter('# 제목\n\n---\n')).toEqual({ frontmatter: null, body: '# 제목\n\n---\n' });
  });
});

describe('parseFrontmatter', () => {
  it('reads YAML data and locates nested fields by line', () => {
    const parsed = parse(['---', 'title: a', 'escape:', '  cafe: b', '  players: 0', '---', ''].join('\n'));
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.data).toMatchObject({ title: 'a', escape: { cafe: 'b', players: 0 } });
    expect(parsed.locate(['escape', 'players'])).toBe(5);
    expect(parsed.locate(['missing'])).toBe(1);
  });

  it('counts lines from the block when blank lines precede it', () => {
    const parsed = parse('\n\n---\ntitle: a\nsub: b\n---\n');
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    expect(parsed.locate(['sub'])).toBe(5);
  });

  it('reports missing and malformed frontmatter', () => {
    expect(parse('# no frontmatter').status).toBe('missing');
    expect(parse('---\ntitle: [unclosed\n---\n').status).toBe('invalid');
    expect(parse('---\n- a\n- b\n---\n').status).toBe('invalid');
  });

  it('reports aliases that fail on conversion as invalid instead of throwing', () => {
    const excessive = `---\na: &a [x]\nb: [${Array(101).fill('*a').join(',')}]\n---\n`;
    expect(parse('---\ntitle: *nope\n---\n').status).toBe('invalid');
    expect(parse(excessive).status).toBe('invalid');
  });
});
