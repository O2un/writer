import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Config } from '../config.js';
import { registerCheckPost } from './tools/check-post.js';

export const SERVER_INFO = { name: 'writer', version: '0.1.0' } as const;

export function createServer(config: Config): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerCheckPost(server, config);
  return server;
}
