import { parseBody, type Body } from './body.js';
import { parseFrontmatter, splitFrontmatter, type FrontmatterBlock } from './frontmatter.js';

export interface Post extends Body {
  source: string;
  frontmatter: FrontmatterBlock;
}

export function parsePost(source: string): Post {
  const { frontmatter, body } = splitFrontmatter(source);

  return {
    source,
    frontmatter: parseFrontmatter(frontmatter),
    ...parseBody(body),
  };
}
