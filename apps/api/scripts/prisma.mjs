#!/usr/bin/env node
/**
 * Runs the Prisma CLI with the same environment the API uses at runtime:
 * the repo-root `.env.local` written by `neon deploy` first, then the local
 * `apps/api/.env` for settings Neon does not manage (e.g. JWT_SECRET).
 *
 * Neon exposes the direct connection as DATABASE_URL_UNPOOLED; Prisma's
 * `directUrl` reads DIRECT_URL, so bridge the two when needed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = path.resolve(apiDir, '../..');
const presetDirectUrl = process.env.DIRECT_URL;

for (const envFile of [path.join(repoRoot, '.env.local'), path.join(apiDir, '.env')]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

if (presetDirectUrl) {
  process.env.DIRECT_URL = presetDirectUrl;
} else if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}

const prismaCli = path.join(apiDir, 'node_modules/prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: apiDir,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
