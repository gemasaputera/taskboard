import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAccessToken } from '../src/auth/oauth';
import { publicUrl } from '../src/lib/public-url';
import { app, registerUser, resetDb } from './helpers';

const redirectUri = 'http://localhost:27890/callback';
const resource = `${publicUrl()}/mcp`;

function pkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function registerClient(agent: ReturnType<typeof request.agent>) {
  const response = await agent.post('/oauth/register').send({
    client_name: 'Hermes Agent',
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });

  expect(response.status).toBe(201);
  return response.body.client_id as string;
}

function authorizeQuery(clientId: string, challenge: string) {
  return {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: 'state-123',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'kanban',
    resource,
  };
}

let mcpServer: Server;
let mcpBaseUrl: string;

beforeAll(async () => {
  mcpServer = createServer(createApp());
  await new Promise<void>((resolve, reject) => {
    mcpServer.once('error', reject);
    mcpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = mcpServer.address() as AddressInfo;
  mcpBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => mcpServer.close(() => resolve()));
});

beforeEach(async () => {
  await resetDb();
});

describe('OAuth metadata', () => {
  it('publishes protected-resource and authorization-server metadata', async () => {
    const resourceMetadata = await request(app).get('/.well-known/oauth-protected-resource');
    expect(resourceMetadata.status).toBe(200);
    expect(resourceMetadata.body).toMatchObject({
      resource,
      authorization_servers: [publicUrl()],
      scopes_supported: ['kanban'],
    });

    const serverMetadata = await request(app).get('/.well-known/oauth-authorization-server');
    expect(serverMetadata.status).toBe(200);
    expect(serverMetadata.body).toMatchObject({
      issuer: publicUrl(),
      authorization_endpoint: `${publicUrl()}/oauth/authorize`,
      token_endpoint: `${publicUrl()}/oauth/token`,
      registration_endpoint: `${publicUrl()}/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('rejects non-loopback HTTP redirect URIs', async () => {
    const response = await request(app)
      .post('/oauth/register')
      .send({
        client_name: 'Bad client',
        redirect_uris: ['http://example.test/callback'],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_redirect_uri');
  });

  it('accepts registration from a local callback origin', async () => {
    const response = await request(app)
      .post('/oauth/register')
      .set('Origin', 'http://localhost:27890')
      .send({ client_name: 'Hermes Agent', redirect_uris: [redirectUri] });

    expect(response.status).toBe(201);
  });

  it('still rejects foreign origins for cookie-authenticated mutations', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ identifier: 'nobody', password: 'wrong-password' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('BAD_ORIGIN');
  });
});

describe('OAuth authorization code flow', () => {
  it('registers a client, shows consent, exchanges a code, and accepts the access token', async () => {
    const user = await registerUser('oauth');
    const clientId = await registerClient(user.agent);
    const { verifier, challenge } = pkce();
    const query = authorizeQuery(clientId, challenge);

    const authorize = await user.agent.get('/oauth/authorize').query(query);
    expect(authorize.status).toBe(200);
    expect(authorize.text).toContain('Allow Hermes Agent?');
    expect(authorize.text).toContain(user.username);

    const consent = await user.agent
      .post('/oauth/authorize')
      .type('form')
      .send({ ...query, decision: 'allow' })
      .redirects(0);

    expect(consent.status).toBe(302);
    const location = new URL(consent.headers.location);
    expect(`${location.origin}${location.pathname}`).toBe(redirectUri);
    expect(location.searchParams.get('state')).toBe('state-123');
    const code = location.searchParams.get('code');
    expect(code).toBeTruthy();

    const token = await user.agent
      .post('/oauth/token')
      .set('Origin', 'http://localhost:27890')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });

    expect(token.status).toBe(200);
    expect(token.body.token_type).toBe('Bearer');
    expect(token.body.scope).toBe('kanban');
    expect(token.body.access_token).toBeTruthy();
    expect(token.body.refresh_token).toBeTruthy();

    const me = await user.agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(user.user.id);

    const refreshed = await user.agent.post('/oauth/token').type('form').send({
      grant_type: 'refresh_token',
      refresh_token: token.body.refresh_token,
      client_id: clientId,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.access_token).toBeTruthy();

    const replay = await user.agent.post('/oauth/token').type('form').send({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    expect(replay.status).toBe(400);
    expect(replay.body.error).toBe('invalid_grant');
  });

  it('sends anonymous users to the login page', async () => {
    const user = await registerUser('oauthanon');
    const clientId = await registerClient(user.agent);
    const { challenge } = pkce();

    const response = await request(app)
      .get('/oauth/authorize')
      .query(authorizeQuery(clientId, challenge));

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/login?next=');
  });

  it('rejects a mismatched PKCE verifier', async () => {
    const user = await registerUser('oauthpkce');
    const clientId = await registerClient(user.agent);
    const { challenge } = pkce();
    const query = authorizeQuery(clientId, challenge);

    const consent = await user.agent
      .post('/oauth/authorize')
      .type('form')
      .send({ ...query, decision: 'allow' })
      .redirects(0);
    const code = new URL(consent.headers.location).searchParams.get('code');

    const token = await user.agent
      .post('/oauth/token')
      .set('Origin', 'http://localhost:27890')
      .type('form')
      .send({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: randomBytes(48).toString('base64url'),
      });

    expect(token.status).toBe(400);
    expect(token.body.error).toBe('invalid_grant');
  });
});

describe('remote MCP endpoint', () => {
  it('requires an OAuth bearer token', async () => {
    const response = await fetch(`${mcpBaseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:27890',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(
      '/.well-known/oauth-protected-resource',
    );
  });

  it('serves the board tools over Streamable HTTP with an access token', async () => {
    const user = await registerUser('mcpremote');
    const token = await createAccessToken({
      userId: user.user.id,
      clientId: 'oauth-test',
      scope: 'kanban',
      resource,
    });

    const transport = new StreamableHTTPClientTransport(new URL(`${mcpBaseUrl}/mcp`), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${token}`,
          Origin: 'http://localhost:27890',
        },
      },
    });
    const client = new Client({ name: 'oauth-test', version: '0.0.0' });

    await client.connect(transport);

    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name);
    expect(names).toContain('whoami');
    expect(names).not.toContain('login');
    expect(names.length).toBe(36);

    const result = await client.callTool({ name: 'whoami', arguments: {} });
    const text = (result.content as { type: string; text?: string }[])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n');
    const payload = JSON.parse(text) as { user: { id: string } };

    expect(payload.user.id).toBe(user.user.id);

    await client.close();
  });
});
