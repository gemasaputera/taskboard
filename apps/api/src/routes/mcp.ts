import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createKanbanServer, KanbanApiClient } from '@kanban/mcp';
import { Router } from 'express';
import { readAccessToken } from '../auth/oauth';
import { env } from '../env';
import { publicUrl } from '../lib/public-url';

export const mcpRouter = Router();

function unauthorized(res: import('express').Response): void {
  res.setHeader(
    'WWW-Authenticate',
    `Bearer realm="kanban", resource_metadata="${publicUrl()}/.well-known/oauth-protected-resource"`,
  );
  res.status(401).json({
    error: 'invalid_token',
    error_description: 'A valid OAuth access token is required.',
  });
}

mcpRouter.all('/mcp', async (req, res) => {
  const authorization = req.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';

  const claims = token ? await readAccessToken(token) : null;
  if (!claims) {
    unauthorized(res);
    return;
  }

  const port = req.socket.localPort ?? env.PORT;
  const client = new KanbanApiClient({
    apiUrl: `http://127.0.0.1:${port}`,
    sessionFile: null,
    bearerToken: token,
  });
  const server = createKanbanServer(client, { authTools: false });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    void transport.close().catch(() => undefined);
    void server.close().catch(() => undefined);
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[mcp] request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error.' },
        id: null,
      });
    }
  }
});
