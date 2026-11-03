import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  DEFAULT_API_URL,
  DEFAULT_SESSION_FILE,
  loadConfig,
  normalizeApiUrl,
  parseArgs,
} from '../src/config';

describe('loadConfig', () => {
  it('falls back to a local API and the user session file', () => {
    const config = loadConfig([], {});

    expect(config.apiUrl).toBe(DEFAULT_API_URL);
    expect(config.sessionFile).toBe(DEFAULT_SESSION_FILE);
    expect(config.username).toBeUndefined();
    expect(config.password).toBeUndefined();
  });

  it('reads environment variables and trims blanks', () => {
    const config = loadConfig([], {
      KANBAN_API_URL: 'https://kanban.example.com/',
      KANBAN_USERNAME: ' ada ',
      KANBAN_PASSWORD: 'secret-value',
      KANBAN_SESSION_TOKEN: 'token',
      KANBAN_WORKPLACE_ID: '00000000-0000-4000-8000-000000000000',
      KANBAN_SESSION_FILE: '~/kanban/session.json',
    });

    expect(config.apiUrl).toBe('https://kanban.example.com');
    expect(config.username).toBe('ada');
    expect(config.password).toBe('secret-value');
    expect(config.sessionToken).toBe('token');
    expect(config.defaultWorkplaceId).toBe('00000000-0000-4000-8000-000000000000');
    expect(config.sessionFile?.endsWith('/kanban/session.json')).toBe(true);
    expect(config.sessionFile?.startsWith('~')).toBe(false);
  });

  it('prefers CLI flags over the environment', () => {
    const config = loadConfig(
      ['--api-url', 'http://127.0.0.1:9000', '--username=grace', '--password', 'hunter22'],
      { KANBAN_API_URL: 'http://example.test', KANBAN_USERNAME: 'ada' },
    );

    expect(config.apiUrl).toBe('http://127.0.0.1:9000');
    expect(config.username).toBe('grace');
    expect(config.password).toBe('hunter22');
  });

  it('can disable session persistence', () => {
    expect(loadConfig(['--no-session-file'], {}).sessionFile).toBeNull();
  });

  it('keeps equals signs inside flag values', () => {
    const config = loadConfig(['--password=a=b=c'], {});

    expect(config.password).toBe('a=b=c');
  });

  it('rejects URLs that are not HTTP(S)', () => {
    expect(() => normalizeApiUrl('ftp://localhost:4000')).toThrow(ConfigError);
    expect(() => normalizeApiUrl('not a url')).toThrow(ConfigError);
  });
});

describe('normalizeApiUrl', () => {
  it('accepts an /api suffix and trailing slashes', () => {
    expect(normalizeApiUrl('http://localhost:4000/api/')).toBe('http://localhost:4000');
    expect(normalizeApiUrl('https://example.test/kanban/api')).toBe('https://example.test/kanban');
  });
});

describe('parseArgs', () => {
  it('supports inline, spaced, and boolean flags', () => {
    expect(parseArgs(['--a=1', '--b', 'two', '--c', '--d', 'x'])).toEqual({
      values: { a: '1', b: 'two', c: true, d: 'x' },
      positionals: [],
    });
  });
});
