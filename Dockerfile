# syntax=docker/dockerfile:1

# Single-service deploy: the API serves the built SPA and the WebSocket on one origin,
# so cookies and Socket.IO need no CORS gymnastics. Works on Render, Railway, Fly.io
# and any plain VPS.

############################  build  ############################
FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the manifests first so `pnpm install` is cached across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

# Prisma Client is generated into node_modules, then both the SPA and the API are built.
RUN pnpm db:generate && pnpm build

############################  runtime  ############################
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Keep the workspace layout intact: pnpm links apps/*/node_modules into /app/node_modules/.pnpm
# with relative symlinks, so copying the root store and the app folders together keeps them valid.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps
COPY --from=build /app/docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

EXPOSE 4000

# Migrations run on boot, then the API serves the SPA and sockets.
CMD ["./docker/entrypoint.sh"]
