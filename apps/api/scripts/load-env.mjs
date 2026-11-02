/**
 * Preloaded with `node --import` / `tsx --import` so the environment is in place
 * before the application (and Prisma Client) is imported.
 *
 * Prisma Client auto-loads `apps/api/.env` when it is imported, which would pin
 * DATABASE_URL to the local Docker database and prevent the repo-root
 * `.env.local` written by `neon deploy` from taking effect. Loading the files
 * first makes Neon win while still letting a real host environment win over both.
 */
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
