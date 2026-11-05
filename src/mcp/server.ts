import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { createProvider, type LlmProvider } from '../llm/index.js';
import { registerCheckPost } from './tools/check-post.js';
import { registerReviewPost } from './tools/review-post.js';

export const SERVER_INFO = { name: 'writer', version: '0.1.0' } as const;

export function createServer(config: Config, provider: LlmProvider = createProvider(config.llm)): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerCheckPost(server, config);
  registerReviewPost(server, config, provider);
  return server;
}
