import { SESSION_COOKIE } from '@kanban/shared';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifySession } from '../auth/jwt';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_SCOPE,
  createAccessToken,
  createAuthorizationCode,
  createClientRegistration,
  createConsentToken,
  createRefreshToken,
  isValidCodeChallenge,
  isValidCodeVerifier,
  isValidRedirectUri,
  markAuthorizationCodeUsed,
  normalizeScope,
  pkceChallenge,
  readAuthorizationCode,
  readClientRegistration,
  readConsentToken,
  readRefreshToken,
} from '../auth/oauth';
import { prisma } from '../db';
import { publicUrl, webOrigin } from '../lib/public-url';

export const oauthRouter = Router();

const resource = (): string => `${publicUrl()}/mcp`;

const authorizeSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1).max(8192),
  redirect_uri: z.string().url(),
  state: z.string().max(2048).optional(),
  code_challenge: z.string().refine(isValidCodeChallenge, 'Invalid code challenge.'),
  code_challenge_method: z.literal('S256').default('S256'),
  scope: z.string().max(200).optional(),
  resource: z.string().url().optional(),
});

const consentSubmissionSchema = z.object({
  decision: z.enum(['allow', 'deny']),
  consent_token: z.string().min(1),
});

const registerSchema = z
  .object({
    redirect_uris: z.array(z.string()).min(1).max(20),
    client_name: z.string().trim().max(200).optional(),
    grant_types: z.array(z.string()).max(10).optional(),
    response_types: z.array(z.string()).max(10).optional(),
    token_endpoint_auth_method: z.string().max(100).optional(),
  })
  .passthrough();

interface AuthorizeInput {
  clientName: string;
  scope: string;
  resource: string;
  redirectUri: string;
}

async function validateAuthorize(
  input: z.infer<typeof authorizeSchema>,
): Promise<
  | { ok: true; value: AuthorizeInput }
  | { ok: false; status: number; error: string; description: string }
> {
  const client = await readClientRegistration(input.client_id);
  if (!client) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_client',
      description: 'The OAuth client is not recognised. Register again and retry.',
    };
  }

  if (
    !client.redirect_uris.includes(input.redirect_uri) ||
    !isValidRedirectUri(input.redirect_uri)
  ) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_request',
      description: 'The redirect URI is not registered for this client.',
    };
  }

  const scope = normalizeScope(input.scope);
  if (!scope) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_scope',
      description: `Only the "${OAUTH_SCOPE}" scope is supported.`,
    };
  }

  const target = input.resource ?? resource();
  if (target !== resource()) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_target',
      description: `The only supported resource is ${resource()}.`,
    };
  }

  return {
    ok: true,
    value: {
      clientName: client.name || 'MCP client',
      scope,
      resource: target,
      redirectUri: input.redirect_uri,
    },
  };
}

async function currentUser(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || !token) return null;

  const userId = await verifySession(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true },
  });
}

function oauthError(res: Response, status: number, code: string, description: string): void {
  res
    .status(status)
    .set('Cache-Control', 'no-store')
    .json({ error: code, error_description: description });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pageStyles(): string {
  return `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #f5f5f3; color: #1c1917;
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
    }
    .card {
      width: min(440px, 100%); background: #fff; border: 1px solid #e7e4df;
      border-radius: 16px; padding: 28px;
      box-shadow: 0 1px 2px rgb(28 25 23 / 0.06), 0 1px 1px rgb(28 25 23 / 0.04);
    }
    .mark {
      display: inline-flex; width: 36px; height: 36px; align-items: center;
      justify-content: center; border-radius: 12px; background: #1c1917;
      color: #fff; font-weight: 700; font-size: 16px;
    }
    h1 { margin: 18px 0 6px; font-size: 20px; letter-spacing: -0.02em; }
    p { color: #77716a; margin: 0 0 18px; }
    .scope {
      border: 1px solid #e7e4df; border-radius: 10px; background: #fafaf8;
      padding: 12px 14px; margin: 18px 0 22px; color: #1c1917;
    }
    .scope strong { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #77716a; margin-bottom: 4px; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    button {
      border-radius: 8px; border: 1px solid transparent; padding: 9px 14px;
      font: inherit; font-weight: 600; cursor: pointer;
    }
    .allow { background: #2447d6; color: #fff; }
    .deny { background: #fff; border-color: #e7e4df; color: #1c1917; }
    .fine { margin-top: 16px; font-size: 11px; color: #77716a; }
  `;
}

function errorPage(title: string, description: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · Kanban</title><style>${pageStyles()}</style></head>
<body><main class="card"><span class="mark">K</span>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></main></body></html>`;
}

function consentPage(details: AuthorizeInput, username: string, consentToken: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Authorize ${escapeHtml(details.clientName)} · Kanban</title>
<style>${pageStyles()}</style></head>
<body><main class="card"><span class="mark">K</span>
<h1>Allow ${escapeHtml(details.clientName)}?</h1>
<p>A client wants to connect to your Kanban board as <strong>@${escapeHtml(username)}</strong>.</p>
<div class="scope"><strong>This will let it</strong>Read and manage your workplaces, boards, cards, checklists, comments, tags, and members.</div>
<form method="post" action="/oauth/authorize">
  <input type="hidden" name="consent_token" value="${escapeHtml(consentToken)}" />
  <div class="actions">
    <button class="deny" type="submit" name="decision" value="deny">Cancel</button>
    <button class="allow" type="submit" name="decision" value="allow">Allow access</button>
  </div>
</form>
<p class="fine">Access is limited to your Kanban account and the kanban scope. Removing this MCP client from your agent stops future calls.</p>
</main></body></html>`;
}

function loginRedirect(req: Request, res: Response, next = req.originalUrl): void {
  if (webOrigin() === publicUrl()) {
    res.redirect(`/login?next=${encodeURIComponent(next)}`);
    return;
  }

  res.redirect(`${webOrigin()}/login?next=${encodeURIComponent(`${publicUrl()}${next}`)}`);
}

function authorizeGetPath(input: z.infer<typeof authorizeSchema>): string {
  const params = new URLSearchParams();
  const fields = [
    'response_type',
    'client_id',
    'redirect_uri',
    'state',
    'code_challenge',
    'code_challenge_method',
    'scope',
    'resource',
  ] as const;

  for (const field of fields) {
    const value = input[field];
    if (typeof value === 'string' && value) params.set(field, value);
  }

  return `/oauth/authorize?${params.toString()}`;
}

function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) target.searchParams.set(key, value);
  }
  return target.toString();
}

oauthRouter.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: resource(),
    resource_name: 'Kanban MCP',
    authorization_servers: [publicUrl()],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
  });
});

oauthRouter.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
  res.json({
    resource: resource(),
    resource_name: 'Kanban MCP',
    authorization_servers: [publicUrl()],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
  });
});

oauthRouter.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: publicUrl(),
    authorization_endpoint: `${publicUrl()}/oauth/authorize`,
    token_endpoint: `${publicUrl()}/oauth/token`,
    registration_endpoint: `${publicUrl()}/oauth/register`,
    scopes_supported: [OAUTH_SCOPE],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    service_documentation: 'https://kanbantask.readme.io/docs/mcp',
  });
});

oauthRouter.get('/.well-known/oauth-authorization-server/mcp', (_req, res) => {
  res.redirect(307, '/.well-known/oauth-authorization-server');
});

oauthRouter.post('/oauth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    oauthError(res, 400, 'invalid_client_metadata', 'Invalid client registration payload.');
    return;
  }

  if (!parsed.data.redirect_uris.every(isValidRedirectUri)) {
    oauthError(
      res,
      400,
      'invalid_redirect_uri',
      'Redirect URIs must be HTTPS or loopback HTTP URLs without a fragment.',
    );
    return;
  }

  const clientName = parsed.data.client_name || 'MCP client';
  const clientId = await createClientRegistration({
    name: clientName,
    redirectUris: parsed.data.redirect_uris,
  });

  res
    .status(201)
    .set('Cache-Control', 'no-store')
    .json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: parsed.data.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
});

oauthRouter.get('/oauth/authorize', async (req, res) => {
  const parsed = authorizeSchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .type('html')
      .send(errorPage('Invalid authorization request', 'Check the client configuration.'));
    return;
  }

  const checked = await validateAuthorize(parsed.data);
  if (!checked.ok) {
    res
      .status(checked.status)
      .type('html')
      .send(errorPage('Invalid authorization request', checked.description));
    return;
  }

  const user = await currentUser(req);
  if (!user) {
    loginRedirect(req, res);
    return;
  }

  const consentToken = await createConsentToken({
    userId: user.id,
    clientId: parsed.data.client_id,
    redirectUri: checked.value.redirectUri,
    codeChallenge: parsed.data.code_challenge,
    scope: checked.value.scope,
    resource: checked.value.resource,
    state: parsed.data.state,
  });

  res.type('html').send(consentPage(checked.value, user.username, consentToken));
});

oauthRouter.post('/oauth/authorize', async (req, res) => {
  const parsed = consentSubmissionSchema.safeParse(req.body);

  if (!parsed.success) {
    res
      .status(400)
      .type('html')
      .send(errorPage('Invalid consent', 'Reload the authorization page and try again.'));
    return;
  }

  const consent = await readConsentToken(parsed.data.consent_token);
  if (!consent) {
    res
      .status(400)
      .type('html')
      .send(errorPage('Consent expired', 'Start the authorization again.'));
    return;
  }

  const user = await currentUser(req);
  if (!user) {
    loginRedirect(
      req,
      res,
      authorizeGetPath({
        response_type: 'code',
        client_id: consent.client_id,
        redirect_uri: consent.redirect_uri,
        state: consent.state,
        code_challenge: consent.code_challenge,
        code_challenge_method: 'S256',
        scope: consent.scope,
        resource: consent.resource,
      }),
    );
    return;
  }

  if (user.id !== consent.sub) {
    res
      .status(400)
      .type('html')
      .send(
        errorPage(
          'Consent does not match',
          'Sign in as the same user and try the authorization again.',
        ),
      );
    return;
  }

  if (parsed.data.decision === 'deny') {
    res.redirect(
      redirectWith(consent.redirect_uri, {
        error: 'access_denied',
        error_description: 'The user denied the request.',
        state: consent.state,
      }),
    );
    return;
  }

  const code = await createAuthorizationCode({
    userId: user.id,
    clientId: consent.client_id,
    redirectUri: consent.redirect_uri,
    codeChallenge: consent.code_challenge,
    scope: consent.scope,
    resource: consent.resource,
  });

  res.redirect(
    redirectWith(consent.redirect_uri, {
      code,
      state: consent.state,
    }),
  );
});

oauthRouter.post('/oauth/token', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const grantType = typeof body.grant_type === 'string' ? body.grant_type : '';

  if (grantType === 'authorization_code') {
    const code = typeof body.code === 'string' ? body.code : '';
    const clientId = typeof body.client_id === 'string' ? body.client_id : '';
    const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : undefined;
    const codeVerifier = typeof body.code_verifier === 'string' ? body.code_verifier : '';

    const client = await readClientRegistration(clientId);
    if (!client) {
      oauthError(res, 401, 'invalid_client', 'Unknown OAuth client.');
      return;
    }

    const claims = await readAuthorizationCode(code);
    if (!claims || claims.client_id !== clientId) {
      oauthError(res, 400, 'invalid_grant', 'The authorization code is invalid or expired.');
      return;
    }

    if (redirectUri && claims.redirect_uri !== redirectUri) {
      oauthError(res, 400, 'invalid_grant', 'The redirect URI does not match the authorization.');
      return;
    }

    if (
      !isValidCodeVerifier(codeVerifier) ||
      pkceChallenge(codeVerifier) !== claims.code_challenge
    ) {
      oauthError(res, 400, 'invalid_grant', 'The PKCE verifier is invalid.');
      return;
    }

    markAuthorizationCodeUsed(claims);

    const accessToken = await createAccessToken({
      userId: claims.sub,
      clientId: claims.client_id,
      scope: claims.scope,
      resource: claims.resource,
    });
    const refreshToken = await createRefreshToken({
      userId: claims.sub,
      clientId: claims.client_id,
      scope: claims.scope,
      resource: claims.resource,
    });

    res.set('Cache-Control', 'no-store').set('Pragma', 'no-cache').json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: claims.scope,
    });
    return;
  }

  if (grantType === 'refresh_token') {
    const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
    const clientId = typeof body.client_id === 'string' ? body.client_id : undefined;

    const claims = await readRefreshToken(refreshToken);
    if (!claims || (clientId && claims.client_id !== clientId)) {
      oauthError(res, 400, 'invalid_grant', 'The refresh token is invalid or expired.');
      return;
    }

    const accessToken = await createAccessToken({
      userId: claims.sub,
      clientId: claims.client_id,
      scope: claims.scope,
      resource: claims.resource,
    });
    const rotated = await createRefreshToken({
      userId: claims.sub,
      clientId: claims.client_id,
      scope: claims.scope,
      resource: claims.resource,
    });

    res.set('Cache-Control', 'no-store').set('Pragma', 'no-cache').json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: rotated,
      scope: claims.scope,
    });
    return;
  }

  oauthError(
    res,
    400,
    'unsupported_grant_type',
    'Only authorization_code and refresh_token are supported.',
  );
});
