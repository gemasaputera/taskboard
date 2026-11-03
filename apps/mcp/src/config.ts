import os from 'node:os';
import path from 'node:path';

export const DEFAULT_API_URL = 'http://localhost:4000';
export const DEFAULT_SESSION_FILE = path.join(os.homedir(), '.kanban-mcp', 'session.json');

export interface McpConfig {
  /** Root URL of the Kanban API, without the trailing `/api`. */
  apiUrl: string;
  /** Account used to sign in automatically when no session exists yet. */
  username?: string;
  password?: string;
  /** Raw `kanban_session` cookie (or a full `name=value` pair), for hosts that inject it. */
  sessionToken?: string;
  /**
   * OAuth access token for the remote /mcp transport. When set, the client sends
   * `Authorization: Bearer …` instead of a session cookie and never signs in.
   */
  bearerToken?: string;
  /** Where the session cookie is cached between runs; `null` disables persistence. */
  sessionFile: string | null;
  /** Used when a tool call omits `workplaceId`. */
  defaultWorkplaceId?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function envValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function expandHome(value: string): string {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

/**
 * Accepts `http://localhost:4000`, `http://localhost:4000/`, or `http://localhost:4000/api`
 * and returns the origin-plus-path prefix that API routes are appended to.
 */
export function normalizeApiUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new ConfigError(`KANBAN_API_URL must be a valid URL (received "${value}").`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError('KANBAN_API_URL must use http:// or https://.');
  }

  const pathname = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');

  return `${url.origin}${pathname}`;
}

export interface ParsedArgs {
  values: Record<string, string | boolean>;
  positionals: string[];
}

/**
 * Minimal `--flag`, `--flag=value`, and `--flag value` parser. The MCP transport owns
 * stdout, so this deliberately avoids a dependency and never prints on its own.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const values: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    const key = (equalsIndex === -1 ? arg.slice(2) : arg.slice(2, equalsIndex)).trim();
    const inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1);
    if (!key) continue;

    if (inlineValue !== undefined) {
      values[key] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values[key] = next;
      index += 1;
      continue;
    }

    values[key] = true;
  }

  return { values, positionals };
}

function stringFlag(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.values[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Reads configuration from CLI flags first, then environment variables. Every value is
 * optional: with no configuration the server targets a local API and exposes a `login`
 * tool so the user can authenticate from inside the AI client.
 */
export function loadConfig(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): McpConfig {
  const parsed = parseArgs(argv);
  const apiUrl = normalizeApiUrl(
    stringFlag(parsed, 'api-url') ?? envValue(env, 'KANBAN_API_URL') ?? DEFAULT_API_URL,
  );

  const sessionFileFlag = parsed.values['session-file'];
  const noSessionFile = parsed.values['no-session-file'] === true;
  const envSessionFile = envValue(env, 'KANBAN_SESSION_FILE');

  const sessionFile = noSessionFile
    ? null
    : typeof sessionFileFlag === 'string'
      ? path.resolve(expandHome(sessionFileFlag))
      : envSessionFile
        ? path.resolve(expandHome(envSessionFile))
        : DEFAULT_SESSION_FILE;

  return {
    apiUrl,
    username: stringFlag(parsed, 'username') ?? envValue(env, 'KANBAN_USERNAME'),
    password: stringFlag(parsed, 'password') ?? envValue(env, 'KANBAN_PASSWORD'),
    sessionToken: stringFlag(parsed, 'session-token') ?? envValue(env, 'KANBAN_SESSION_TOKEN'),
    sessionFile,
    defaultWorkplaceId: stringFlag(parsed, 'workplace-id') ?? envValue(env, 'KANBAN_WORKPLACE_ID'),
  };
}
