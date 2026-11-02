import { env } from '../env';

const LOOPBACK_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed;
  }
}

export function configuredOrigins(): string[] {
  return env.CLIENT_ORIGIN.split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

/**
 * Origin policy shared by CORS, the mutation guard, and Socket.IO.
 *
 * In development/test we accept any loopback origin (any port) so the Vite app
 * keeps working even if `CLIENT_ORIGIN` is stale or a port was taken. Production
 * accepts only the configured, comma-separated origins.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  const allowed = configuredOrigins();

  if (allowed.includes(normalized)) return true;

  // Local development, and production-mode builds whose configured origin is
  // itself loopback (e.g. CLIENT_ORIGIN=http://localhost:4000), may use any
  // loopback port. This keeps Vite on :5173 working against the API on :4000.
  if (LOOPBACK_ORIGIN.test(normalized)) {
    const loopbackConfigured = allowed.some((allowedOrigin) => LOOPBACK_ORIGIN.test(allowedOrigin));
    if (env.NODE_ENV !== 'production' || loopbackConfigured) return true;
  }

  return false;
}

export function corsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  callback(null, isAllowedOrigin(origin));
}
