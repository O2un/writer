import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { listPosts } from '../../content/posts.js';

const outputSchema = {
  posts: z.array(
    z.object({
      post: z.string().describe('File path relative to the content folder. Pass it as path to the other tools'),
      frontmatter: z.record(z.string(), z.unknown()).optional().describe('Frontmatter as written in the file'),
      error: z.string().optional().describe('Why the frontmatter could not be read'),
    }),
  ),
};

export function registerListPosts(server: McpServer, config: Config): void {
  server.registerTool(
    'list_posts',
    {
      title: 'List posts',
      description:
        'Lists every post in the content folder with its frontmatter, drafts included. Use it to see which topics are already covered and to find posts to link. Does not use an LLM or modify files.',
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (): Promise<CallToolResult> => {
      const posts = await listPosts(config.contentDir);
      const lines = posts.map((p) => ('error' in p ? `${p.post} [error] ${p.error}` : `${p.post} ${JSON.stringify(p.frontmatter)}`));
      return {
        content: [{ type: 'text', text: [`${posts.length} posts`, ...lines].join('\n') }],
        structuredContent: { posts },
      };
    },
  );
}
