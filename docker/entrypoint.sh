#!/bin/sh
set -eu

# Values pasted into a hosting dashboard often carry artifacts that Prisma rejects with
# P1013 ("The scheme is not recognized"): surrounding quotes copied from a .env snippet,
# a leading `DATABASE_URL=`, or a trailing newline. Trim and strip one quote layer first.
normalize_url() {
  printf '%s' "$1" \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
          -e 's/\r$//' \
          -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

# Fail with a diagnostic that never echoes the secret itself.
validate_db_url() {
  _name=$1
  _value=$2

  case "$_value" in
    postgres://* | postgresql://*) return 0 ;;
  esac

  _scheme='(no scheme found)'
  case "$_value" in
    *://*) _scheme=$(printf '%s' "${_value%%://*}") ;;
  esac

  {
    echo "[entrypoint] FATAL: $_name is not a valid Postgres connection URL."
    echo "  scheme found : $_scheme"
    echo "  value length : ${#_value} characters"
    echo "  expected     : postgresql://user:password@host/database?sslmode=require"
    echo "  Check the host's environment settings for:"
    echo "    - surrounding quotes, e.g. \"postgresql://...\""
    echo "    - a pasted prefix, e.g. DATABASE_URL=postgresql://..."
    echo "    - a trailing newline or space"
    echo "  The entrypoint already trims whitespace and one layer of quotes."
  } >&2
  exit 1
}

if [ -z "${DATABASE_URL:-}" ]; then
  {
    echo "[entrypoint] FATAL: DATABASE_URL is not set."
    echo "  Add the pooled Postgres connection string to the host's environment settings."
  } >&2
  exit 1
fi

DATABASE_URL=$(normalize_url "$DATABASE_URL")
export DATABASE_URL
validate_db_url DATABASE_URL "$DATABASE_URL"

if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
  DATABASE_URL_UNPOOLED=$(normalize_url "$DATABASE_URL_UNPOOLED")
  export DATABASE_URL_UNPOOLED
  validate_db_url DATABASE_URL_UNPOOLED "$DATABASE_URL_UNPOOLED"
fi

if [ -n "${DIRECT_URL:-}" ]; then
  DIRECT_URL=$(normalize_url "$DIRECT_URL")
  export DIRECT_URL
  validate_db_url DIRECT_URL "$DIRECT_URL"
fi

# Prisma migrations use DIRECT_URL. Prefer an explicit DIRECT_URL, then Neon's direct
# (unpooled) connection, then fall back to DATABASE_URL when the host only provides one.
if [ -z "${DIRECT_URL:-}" ]; then
  if [ -n "${DATABASE_URL_UNPOOLED:-}" ]; then
    DIRECT_URL=$DATABASE_URL_UNPOOLED
  else
    DIRECT_URL=$DATABASE_URL
  fi
  export DIRECT_URL
fi

# Log the target host only — never the credentials.
_db_host=$(printf '%s' "$DATABASE_URL" | sed -E 's#^[a-z+]+://[^@]*@##; s#[/?].*$##')
echo "[entrypoint] database host: ${_db_host:-unknown}"

# Apply pending Prisma migrations before serving traffic.
#
# This app assumes a single API instance (no Redis adapter for Socket.IO), so running
# migrations on boot is safe. If you scale to multiple replicas, move this step to a
# release/pre-deploy command instead so only one process migrates.
echo "[entrypoint] applying database migrations"
node apps/api/scripts/prisma.mjs migrate deploy

echo "[entrypoint] starting API on port ${PORT:-4000}"
exec node --import ./apps/api/scripts/load-env.mjs apps/api/dist/index.js
