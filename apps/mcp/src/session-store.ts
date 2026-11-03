import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface StoredSession {
  apiUrl: string;
  cookie: string;
  savedAt: string;
}

/**
 * Caches the `kanban_session` cookie so an MCP client keeps working across restarts
 * instead of requiring the account password in the client configuration.
 *
 * The file is written with owner-only permissions. Failures are non-fatal: a read-only
 * or sandboxed home directory just means the session lives in memory for this process.
 */
export class SessionStore {
  constructor(private readonly file: string | null) {}

  read(apiUrl: string): string | undefined {
    if (!this.file) return undefined;

    try {
      const raw = readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredSession>;

      if (
        typeof parsed.apiUrl !== 'string' ||
        typeof parsed.cookie !== 'string' ||
        !parsed.cookie
      ) {
        return undefined;
      }

      // A cached cookie is only valid for the API that issued it.
      if (parsed.apiUrl !== apiUrl) return undefined;

      return parsed.cookie;
    } catch {
      return undefined;
    }
  }

  write(apiUrl: string, cookie: string): void {
    if (!this.file) return;

    try {
      mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });

      const tempFile = `${this.file}.${process.pid}.tmp`;
      const payload: StoredSession = {
        apiUrl,
        cookie,
        savedAt: new Date().toISOString(),
      };

      writeFileSync(tempFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
      chmodSync(tempFile, 0o600);
      renameSync(tempFile, this.file);
    } catch {
      // Session persistence is a convenience; never fail a tool call over it.
    }
  }

  clear(): void {
    if (!this.file) return;

    try {
      rmSync(this.file, { force: true });
    } catch {
      // Ignore: an unreadable cache is the same as no cache.
    }
  }
}
