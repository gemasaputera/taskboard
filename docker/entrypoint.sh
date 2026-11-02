#!/bin/sh
set -eu

# Apply pending Prisma migrations before serving traffic.
#
# This app assumes a single API instance (no Redis adapter for Socket.IO), so running
# migrations on boot is safe. If you scale to multiple replicas, move this step to a
# release/pre-deploy command instead so only one process migrates.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] applying database migrations"
  node apps/api/scripts/prisma.mjs migrate deploy
fi

echo "[entrypoint] starting API on port ${PORT:-4000}"
exec node --import ./apps/api/scripts/load-env.mjs apps/api/dist/index.js
