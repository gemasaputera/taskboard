import { env } from '../env';

function toOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}

/** Origin the OAuth metadata, /mcp endpoint, and consent pages live on. */
export function publicUrl(): string {
  if (env.PUBLIC_URL) return toOrigin(env.PUBLIC_URL);

  if (env.NODE_ENV === 'production') {
    const first = env.CLIENT_ORIGIN.split(',')[0]?.trim();
    if (first) return toOrigin(first);
  }

  return `http://localhost:${env.PORT}`;
}

/** Origin of the web app, which may differ from the API in development. */
export function webOrigin(): string {
  const first = env.CLIENT_ORIGIN.split(',')[0]?.trim();
  return first ? toOrigin(first) : publicUrl();
}
