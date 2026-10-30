import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const SERVER_INFO = { name: 'writer', version: '0.1.0' } as const;

export function createServer(): McpServer {
  return new McpServer(SERVER_INFO);
}
