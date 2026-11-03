import { createHash, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { env } from '../env';
import { publicUrl } from '../lib/public-url';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const AUDIENCE = 'kanban-mcp';

export const OAUTH_SCOPE = 'kanban';
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '30d';
const AUTH_CODE_TTL = '5m';
const CLIENT_TTL = '365d';

export interface OAuthClientClaims extends JWTPayload {
  typ: 'oauth_client';
  name: string;
  redirect_uris: string[];
}

export interface OAuthCodeClaims extends JWTPayload {
  typ: 'oauth_code';
  sub: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string;
}

export interface OAuthAccessClaims extends JWTPayload {
  typ: 'oauth_access';
  sub: string;
  client_id: string;
  scope: string;
  resource: string;
}

export interface OAuthRefreshClaims extends JWTPayload {
  typ: 'oauth_refresh';
  sub: string;
  client_id: string;
  scope: string;
  resource: string;
}

async function signToken(payload: JWTPayload, expiresIn: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(publicUrl())
    .setAudience(AUDIENCE)
    .setJti(randomUUID())
    .setExpirationTime(expiresIn)
    .sign(secret);
}

async function readToken<T extends JWTPayload>(
  token: string,
  expectedType: string,
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: publicUrl(),
      audience: AUDIENCE,
    });

    return payload.typ === expectedType ? (payload as T) : null;
  } catch {
    return null;
  }
}

export async function createClientRegistration(input: {
  name: string;
  redirectUris: string[];
}): Promise<string> {
  return signToken(
    {
      typ: 'oauth_client',
      name: input.name,
      redirect_uris: input.redirectUris,
    } satisfies OAuthClientClaims,
    CLIENT_TTL,
  );
}

export async function readClientRegistration(clientId: string): Promise<OAuthClientClaims | null> {
  return readToken<OAuthClientClaims>(clientId, 'oauth_client');
}

export async function createAuthorizationCode(input: {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
}): Promise<string> {
  return signToken(
    {
      typ: 'oauth_code',
      sub: input.userId,
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      scope: input.scope,
      resource: input.resource,
    } satisfies OAuthCodeClaims,
    AUTH_CODE_TTL,
  );
}

const usedCodes = new Map<string, number>();

/** Reads a code once. Replaying a code returns null. */
export async function readAuthorizationCode(code: string): Promise<OAuthCodeClaims | null> {
  const claims = await readToken<OAuthCodeClaims>(code, 'oauth_code');
  if (!claims?.jti) return null;

  const now = Date.now();
  for (const [jti, expiresAt] of usedCodes) {
    if (expiresAt < now) usedCodes.delete(jti);
  }

  if (usedCodes.has(claims.jti)) return null;
  return claims;
}

export function markAuthorizationCodeUsed(claims: OAuthCodeClaims): void {
  if (!claims.jti) return;
  usedCodes.set(claims.jti, (claims.exp ?? 0) * 1000);
}

export async function createAccessToken(input: {
  userId: string;
  clientId: string;
  scope: string;
  resource: string;
}): Promise<string> {
  return signToken(
    {
      typ: 'oauth_access',
      sub: input.userId,
      client_id: input.clientId,
      scope: input.scope,
      resource: input.resource,
    } satisfies OAuthAccessClaims,
    ACCESS_TOKEN_TTL,
  );
}

export async function readAccessToken(token: string): Promise<OAuthAccessClaims | null> {
  return readToken<OAuthAccessClaims>(token, 'oauth_access');
}

export async function createRefreshToken(input: {
  userId: string;
  clientId: string;
  scope: string;
  resource: string;
}): Promise<string> {
  return signToken(
    {
      typ: 'oauth_refresh',
      sub: input.userId,
      client_id: input.clientId,
      scope: input.scope,
      resource: input.resource,
    } satisfies OAuthRefreshClaims,
    REFRESH_TOKEN_TTL,
  );
}

export async function readRefreshToken(token: string): Promise<OAuthRefreshClaims | null> {
  return readToken<OAuthRefreshClaims>(token, 'oauth_refresh');
}

/** OAuth redirect URIs must be HTTPS, or HTTP on a loopback host. */
export function isValidRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeScope(scope: string | undefined): string | null {
  const requested = (scope ?? '').split(/\s+/).filter(Boolean);
  if (requested.length === 0) return OAUTH_SCOPE;
  if (requested.length === 1 && requested[0] === OAUTH_SCOPE) return OAUTH_SCOPE;
  return null;
}

export function isValidCodeChallenge(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

export function isValidCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
