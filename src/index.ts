#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigError, loadConfig } from './config.js';
import { createServer } from './mcp/server.js';

try {
  const server = createServer(loadConfig());
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(error instanceof ConfigError ? `writer: ${error.message}` : error);
  process.exit(1);
}
