import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { createProvider, type LlmProvider } from '../llm/index.js';
import { registerCheckPost } from './tools/check-post.js';
import { registerGetTemplate } from './tools/get-template.js';
import { registerListPosts } from './tools/list-posts.js';
import { registerReviewPost } from './tools/review-post.js';
import { registerRevisePost } from './tools/revise-post.js';

export const SERVER_INFO = { name: 'writer', version: '0.1.0' } as const;

export const SERVER_INSTRUCTIONS = `writer drafts, checks, reviews and revises the posts of one blog. Use it for any work on a post, in this order:

1. New post: call list_posts to see which topics are covered and which posts to link. Then call get_template with the template that fits, research and write the draft by its instructions and the site guide it returns, and save it as a new file with draft: true.
2. After every save: call check_post and fix its errors. It is free, so run it every time.
3. When a draft is ready or the author asks for a review: call review_post. It costs LLM usage. Show the issues and let the author choose.
4. Revision: call revise_post with the chosen issues and the author's feedback. It returns edits and never writes the file. Show them, apply only the approved ones in order, then call check_post again.

Pass the same template to every tool for one post. Publishing a post (draft: false) is the author's decision; do it only when asked. A passing check_post does not mean the post is done.`;

export function createServer(config: Config, provider: LlmProvider = createProvider(config.llm)): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });
  registerListPosts(server, config);
  registerGetTemplate(server, config);
  registerCheckPost(server, config);
  registerReviewPost(server, config, provider);
  registerRevisePost(server, config, provider);
  return server;
}
