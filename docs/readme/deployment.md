---
title: Deploy
category:
  uri: Guides
position: 2
slug: deployment
privacy:
  view: public
content:
  excerpt: Deploy the board as one long-lived Node service on Render, Railway, Fly.io, Docker, or a VPS.
---

Kanban is **one long-lived Node service**. The API serves the built SPA, the REST API, and the
WebSocket on the same origin. That keeps the session cookie first-party and lets Socket.IO connect
with no CORS setup, so any container host works.

> 🚧 **Netlify and Vercel are not a fit for the API.** Serverless functions cannot hold a
> Socket.IO connection open, and the API keeps socket rooms and rate-limit counters in process
> memory. If you must split the web app from the API, host both under one site and expect to add a
> Redis adapter.

## Docker

The included `Dockerfile` builds the web app, the API, and the MCP server, then starts the API
with migrations applied.

```bash
docker build -t kanban-board .

docker run -d --name kanban -p 4000:4000 \
  -e DATABASE_URL="postgresql://...pooler..." \
  -e DATABASE_URL_UNPOOLED="postgresql://..." \
  -e JWT_SECRET="<32+ random characters>" \
  -e CLIENT_ORIGIN="https://your-domain.example" \
  kanban-board
```

Point a reverse proxy (Caddy, nginx, Traefik) at port `4000` for TLS.

## Render

`render.yaml` is a blueprint with one web service, the environment variables, and a health check.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint** and pick the repository.
3. Fill in the prompted values:
   - `DATABASE_URL` — pooled Neon connection string
   - `DATABASE_URL_UNPOOLED` — direct Neon connection string (optional, recommended)
   - `CLIENT_ORIGIN` — the public URL Render assigns
   - `JWT_SECRET` is generated for you
4. Deploy. The entrypoint applies migrations before the API starts listening.

Paste each value **bare**. Render stores exactly what you type, so a value wrapped in quotes is
invalid at runtime.

Free instances spin down after roughly 15 minutes idle; connected clients reconnect when the
service wakes.

## Railway

1. Create a project from the GitHub repository; Railway detects the `Dockerfile`.
2. Add `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, and `CLIENT_ORIGIN`.
3. Generate a public domain, put that exact URL in `CLIENT_ORIGIN`, then redeploy.

## Fly.io

```bash
fly launch --no-deploy          # accept the Dockerfile; internal port 4000
fly secrets set \
  DATABASE_URL="postgresql://...pooler..." \
  DATABASE_URL_UNPOOLED="postgresql://..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  CLIENT_ORIGIN="https://your-app.fly.dev"
fly deploy
```

## Native Node

Any Node 22+ host works:

```bash
pnpm install && pnpm build
pnpm db:deploy
pnpm start
```

`start` preloads the repo-root `.env.local` when present, so a Neon-linked checkout needs no extra
flags. Otherwise provide the production variables from the host environment.

## Production variables

| Variable                | Value                                                |
| :---------------------- | :--------------------------------------------------- |
| `DATABASE_URL`          | Pooled PostgreSQL connection                         |
| `DATABASE_URL_UNPOOLED` | Optional direct connection for migrations            |
| `JWT_SECRET`            | 32+ random characters; never reuse the example value |
| `CLIENT_ORIGIN`         | Exact public origin, e.g. `https://kanban.example`   |
| `NODE_ENV`              | `production`                                         |

`docker/entrypoint.sh` runs `prisma migrate deploy` before starting the server. If you run more
than one replica, move migrations to a pre-deploy step and add a Redis adapter for Socket.IO.

## Troubleshooting

### `P1013: The provided database string is invalid`

Prisma received something that is not a bare URL — usually surrounding quotes, a `DATABASE_URL=`
prefix, or a trailing newline. The Docker entrypoint trims whitespace and strips one layer of
quotes. Inspect the value from the host:

```bash
node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.protocol, u.hostname)'
```

It should print `postgresql:` and your database host.
