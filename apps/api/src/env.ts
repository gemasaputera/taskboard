import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// `neon deploy` writes the branch's connection strings to the repo-root `.env.local`.
// Load it first so Neon wins over the local Docker values in `apps/api/.env`; the
// per-app file still supplies local-only settings such as JWT_SECRET.
const rootEnvFile = fileURLToPath(new URL('../../../.env.local', import.meta.url));
const apiEnvFile = fileURLToPath(new URL('../.env', import.meta.url));

// A value already present in the real environment (a host, or `DIRECT_URL=... pnpm dev`)
// must win over both files.
const presetDirectUrl = process.env.DIRECT_URL;

loadEnv({ path: rootEnvFile });
loadEnv({ path: apiEnvFile });

// Neon publishes the direct (unpooled) URL as DATABASE_URL_UNPOOLED, while Prisma's
// `directUrl` expects DIRECT_URL. Prefer Neon's value over the local Docker DIRECT_URL
// in apps/api/.env; fall back to whatever apps/api/.env supplied for local-only setups.
if (presetDirectUrl) {
  process.env.DIRECT_URL = presetDirectUrl;
} else if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
}

const clientOriginSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value.split(',').every((entry) => {
        try {
          new URL(entry.trim());
          return true;
        } catch {
          return false;
        }
      }),
    'CLIENT_ORIGIN must be a URL or a comma-separated list of URLs.',
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CLIENT_ORIGIN: clientOriginSchema.default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error(
    'Invalid environment configuration. Run `neon deploy` (or copy apps/api/.env.example to apps/api/.env) and fill it in.',
  );
}

export const env = parsed.data;
