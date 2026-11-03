import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../api/src/app';
import { prisma } from '../../api/src/db';
import { KanbanApiClient } from '../src/client';
import type { McpConfig } from '../src/config';
import { createKanbanServer } from '../src/server';

export interface TestApi {
  server: Server;
  url: string;
}

export async function startTestApi(): Promise<TestApi> {
  const server = createServer(createApp());

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${address.port}` };
}

export async function stopTestApi(api: TestApi): Promise<void> {
  await new Promise<void>((resolve) => api.server.close(() => resolve()));
}

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "CardTag","Comment","Subtask","Tag","Card","BoardColumn","Invitation","Membership","Workplace","User" RESTART IDENTITY CASCADE',
  );
}

export interface RawToolResult {
  isError: boolean;
  text: string;
}

export interface ToolHarness {
  apiUrl: string;
  client: KanbanApiClient;
  call: (name: string, args?: Record<string, unknown>) => Promise<any>;
  raw: (name: string, args?: Record<string, unknown>) => Promise<RawToolResult>;
  toolNames: () => Promise<string[]>;
  close: () => Promise<void>;
}

/** Connects a real MCP client to the server through the SDK's in-memory transport. */
export async function createHarness(
  apiUrl: string,
  overrides: Partial<McpConfig> = {},
): Promise<ToolHarness> {
  const config: McpConfig = { apiUrl, sessionFile: null, ...overrides };
  const client = new KanbanApiClient(config);
  const server = createKanbanServer(client);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const mcp = new Client({ name: 'kanban-test', version: '0.0.0' });
  await mcp.connect(clientTransport);

  const raw = async (name: string, args: Record<string, unknown> = {}): Promise<RawToolResult> => {
    const result = await mcp.callTool({ name, arguments: args });
    const blocks = (result.content ?? []) as { type: string; text?: string }[];
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');

    return { isError: Boolean(result.isError), text };
  };

  const call = async (name: string, args: Record<string, unknown> = {}): Promise<any> => {
    const result = await raw(name, args);
    if (result.isError) throw new Error(result.text);
    return result.text ? JSON.parse(result.text) : undefined;
  };

  return {
    apiUrl,
    client,
    call,
    raw,
    toolNames: async () => (await mcp.listTools()).tools.map((tool) => tool.name),
    close: async () => {
      await mcp.close();
      await server.close();
    },
  };
}

export async function signUp(
  apiUrl: string,
  username = 'ada',
  overrides: Partial<McpConfig> = {},
): Promise<ToolHarness> {
  const harness = await createHarness(apiUrl, overrides);

  await harness.call('register_account', {
    username,
    email: `${username}@example.com`,
    password: 'Kanban!Passw0rd',
  });

  return harness;
}
