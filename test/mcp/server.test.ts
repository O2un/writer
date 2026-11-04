import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createServer, SERVER_INFO } from '../../src/mcp/server.js';
import { FIXTURE_CONFIG } from '../fixtures.js';

describe('MCP server', () => {
  it('completes the initialize handshake with a client', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    const server = createServer(FIXTURE_CONFIG);
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    expect(client.getServerVersion()).toMatchObject(SERVER_INFO);
    await client.close();
  });
});
