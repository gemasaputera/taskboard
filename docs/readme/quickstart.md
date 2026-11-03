---
title: Quick start
category:
  uri: Getting Started
position: 1
slug: quickstart
privacy:
  view: public
content:
  excerpt: Run Kanban locally with PostgreSQL, apply migrations, and open the board in about five minutes.
---

This guide takes you from a fresh clone to a running board at <http://localhost:5173>.

## Prerequisites

- **Node 22+** (developed on Node 24)
- **pnpm 11** — run `corepack enable` if you do not have it
- **PostgreSQL** — either Docker (simplest) or a [Neon](https://neon.tech) project

## 1. Install

```bash
git clone https://github.com/gemasaputera/taskboard.git
cd taskboard
pnpm install
```

## 2. Start a database

### Option A — Docker

```bash
pnpm test:db:up
```

This starts PostgreSQL 16 on port **5433** with the databases `kanban_dev` and `kanban_test`.
The credentials are the throwaway `kanban` / `kanban` pair used only for local development.

### Option B — Neon

```bash
neon link          # once per checkout
neon deploy        # applies neon.ts and writes .env.local
```

`neon deploy` writes the **pooled** `DATABASE_URL` and the **direct** `DATABASE_URL_UNPOOLED` to
the repo-root `.env.local`. You can also copy `.env.example` to `.env.local` and paste the two
connection strings yourself.

## 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

The example file already matches the Docker setup. For Neon, leave `DATABASE_URL` in
`apps/api/.env` alone — the API loads the repo-root `.env.local` first, so the Neon values win.

Change `JWT_SECRET` for anything other than local development. It must be at least 32 characters.

> 🚧 **Never commit real credentials.** `.env`, `.env.*`, `*.local`, and `.neon` are gitignored.

## 4. Create the schema

```bash
pnpm db:generate
pnpm db:migrate        # development: create and apply migrations
```

For an existing database or a production deploy, apply the checked-in migrations instead:

```bash
pnpm db:deploy
```

## 5. Run

```bash
pnpm dev
```

| Service      | URL                                |
| :----------- | :--------------------------------- |
| Web app      | <http://localhost:5173>            |
| API          | <http://localhost:4000>            |
| Health check | <http://localhost:4000/api/health> |

Open the web app and register an account. There is no seed script, and the first account you
register becomes the owner of its own workplace. The form checks the username and email against
the database as you type, and asks for a password with mixed case, a number, and a symbol.

## Next steps

- [How it works](/docs/concepts) explains the data model and permissions.
- [MCP server](/docs/mcp) lets an AI client work the board without a browser.
- [Configuration](/docs/configuration) lists every environment variable.

## Troubleshooting

### `403 BAD_ORIGIN`

The API only accepts the origin(s) configured in `CLIENT_ORIGIN`. Loopback origins on any port are
accepted when `CLIENT_ORIGIN` is itself loopback, so Vite on `:5173` works against an API on
`:4000`. If you change `CLIENT_ORIGIN`, restart the API.

### `P1013: The provided database string is invalid`

Prisma received something that is not a bare URL. The usual causes are surrounding quotes, a
pasted `DATABASE_URL=` prefix, or a trailing newline. The API and the Docker entrypoint normalize
these, but check the value if you run Prisma directly.
