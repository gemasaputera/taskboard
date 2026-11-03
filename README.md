# Kanban — a live team board

A Trello-style kanban app for small teams: one workplace, four clear lanes, and every task —
checklist, tags, comments — moving live with the people who care about it.

![The board](docs/board.png)

![Card detail](docs/card-detail.png)

<sub>Screenshots show a throwaway demo account; no real user data.</sub>

## Contents

- [Features](#features)
- [Stack](#stack)
- [Quick start](#quick-start)
- [Tests](#tests)
- [MCP server](#mcp-server-ai-agents)
- [Documentation site](#documentation-site-readme)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [Deploy](#deploy)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Features

- **Default workplace per account** — registering `ada` creates `ada's Workplace` with the columns
  **To Do → Revision → On Progress → Done**.
- **Owner-controlled columns** — rename, reorder by drag, hide without deleting cards, add, and
  delete (its cards move to the first visible remaining column).
- **Multiple workplaces** — create more from the workplace switcher; you own each one you create.
- **In-app invitations** — the owner invites an already-registered user by exact username or email.
  The invitee accepts or declines from the bell; membership is live immediately.
- **Guided sign-up** — usernames and emails are checked against the database as you type, spaces
  and uppercase are normalized away, and a live meter enforces a stronger password (8+ characters,
  mixed case, a number, and a symbol; no common or account-derived passwords).
- **Rich cards** — title, Markdown description with a Write/Preview editor, created/updated dates,
  checklist subtasks with progress, multiple colored tags, multiple assignees (unassigned by
  default), and a comment thread.
- **Cross-column drag and drop** — mouse, touch, and keyboard (dnd-kit), with optimistic updates and
  server-side ordering that survives reload.
- **Realtime** — Socket.IO keeps every member's board in sync; disconnected clients fall back to
  refetching on reconnect/focus.
- **Roles** — owner manages structure, invitations, members, and tags; members work on cards.
- **AI access** — an MCP server exposes 39 board tools, so Claude, Cursor, Codex, or any MCP
  client can work the board without a browser.

## Stack

| Layer    | Choice                                                                                  |
| -------- | --------------------------------------------------------------------------------------- |
| Web      | Vite, React 19, TypeScript, React Router, TanStack Query, dnd-kit, Tailwind v4, Radix UI |
| API      | Express 5, Prisma ORM, Zod, Socket.IO, `jose` JWT, Node `scrypt` password hashing        |
| Database | PostgreSQL (Neon in production; Docker Postgres for local/test)                          |
| AI       | MCP stdio server (`@modelcontextprotocol/sdk`) driving the REST API                     |
| Tests    | Vitest, Supertest, socket.io-client, React Testing Library                               |

## Quick start

### Prerequisites

- Node **22+** (developed on Node 24)
- pnpm **11** — run `corepack enable` if you do not have it
- Docker (only for the local test database) **or** a Neon Postgres project

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/kanban-board.git
cd kanban-board
pnpm install
```

### 2. Start a database

**Option A — Docker (simplest for contributors)**

```bash
pnpm test:db:up
```

This starts Postgres 16 on port **5433** with the database `kanban_dev` and creates `kanban_test`
on first boot. Credentials are the throwaway `kanban` / `kanban` pair used only by local dev.

**Option B — Neon**

```bash
neon link          # once per checkout, links this folder to your Neon project
neon deploy        # applies neon.ts and writes .env.local
```

The repo ships `neon.ts` for the `production` branch. `neon deploy` writes the **pooled**
`DATABASE_URL` and the **direct** `DATABASE_URL_UNPOOLED` to the repo-root `.env.local`. You can
also copy `.env.example` to `.env.local` and paste your own connection strings:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.region.aws.neon.tech/DBNAME?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/DBNAME?sslmode=require"
```

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

The checked-in `.env.example` already matches the Docker setup, so no edits are needed for Option A.
For Neon, leave `DATABASE_URL` in `apps/api/.env` alone: the API loads the repo-root `.env.local`
**first**, so the Neon values win, and `DATABASE_URL_UNPOOLED` is mapped to `DIRECT_URL` for Prisma.
The one value worth changing for any non-local use is `JWT_SECRET` — generate a random 32+
character string.

### 4. Create the schema

```bash
pnpm db:generate
pnpm db:migrate        # development: create/apply migrations
# or
pnpm db:deploy         # apply existing migrations (production/Neon)
```

### 5. Run

```bash
pnpm dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>

Open the web app and register an account — there is no seed script, and the first account you
register becomes the owner of its own workplace.

Vite proxies `/api` and `/socket.io` to the API, so the session cookie and WebSocket share one
origin in development.

> **403 BAD_ORIGIN?** The API only accepts the origin(s) in `CLIENT_ORIGIN`. Loopback origins on
> any port are accepted when `CLIENT_ORIGIN` is itself loopback, so Vite on `:5173` works against
> an API on `:4000`. If you change `CLIENT_ORIGIN`, restart the API.

## Tests

The API and MCP suites need a separate PostgreSQL database. The Docker Compose service creates
`kanban_test` on first boot, and the default test URL is
`postgresql://kanban:kanban@localhost:5433/kanban_test?schema=public`.

```bash
pnpm test:db:up

DATABASE_URL="postgresql://kanban:kanban@localhost:5433/kanban_test?schema=public" \
DIRECT_URL="postgresql://kanban:kanban@localhost:5433/kanban_test?schema=public" \
pnpm --filter @kanban/api exec prisma migrate deploy

pnpm test
```

`pnpm test` runs both packages serially (`--workspace-concurrency=1`) because they share the test
database. The MCP suite boots the real API in-process and drives the server through the MCP SDK.

If you already had the Docker volume from an older checkout without the init SQL, recreate it
(`docker compose down -v` — destructive) or create the `kanban_test` database manually.

Other checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm format          # Prettier, writes files
```

## MCP server (AI agents)

`apps/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the
board as **39 tools** — read the board, create and move cards, manage checklists, comments, tags,
assignees, columns, members, and invitations — so an AI client can work the board without opening
the browser.

It drives the same REST API as the web app, so permissions, ordering, and realtime updates behave
identically. The API must be running (`pnpm dev:api`), or point the server at a deployed URL.

```bash
pnpm build          # builds the web app, API, and MCP server
pnpm dev:api        # in another terminal

# normally launched by your AI client, not by hand:
node apps/mcp/dist/index.js
```

Authenticate once by asking the AI to call the `login` tool (the session is cached in
`~/.kanban-mcp/session.json`), or set `KANBAN_USERNAME` / `KANBAN_PASSWORD`. A project-scoped
`.mcp.json` is included for Claude Code; other clients get config snippets in the guide.

See [docs/mcp.md](docs/mcp.md) for Claude Desktop, Cursor, Codex, and Hermes Agent setup, the full
tool list, environment variables, and troubleshooting.

## Documentation site (ReadMe)

The hosted guides live in `docs/readme/` as ReadMe-ready Markdown. Nine pages cover getting
started, concepts, configuration, deployment, the REST API, and the MCP server.

**ReadMe project:** <https://kanbantask.readme.io>. If the site shows “Not Yet Active”, finish the
project activation in the ReadMe dashboard — see the [setup guide](docs/readme-setup.md#activate-the-project).

```bash
export README_API_KEY=rdme_your_key_here

pnpm docs:check      # offline: frontmatter, slugs, and links (no key)
pnpm docs:validate   # ReadMe dry run: validates frontmatter and previews changes
pnpm docs:publish    # create or update the pages in ReadMe
```

The [sync workflow](.github/workflows/readme-sync.yml) uploads `docs/readme/` on every push to
`main` that touches those files. See [docs/readme-setup.md](docs/readme-setup.md) for the one-time
ReadMe project setup, category names, and frontmatter reference.

## Environment variables

Two env files exist, and both are gitignored. Their templates (`.env.example`, checked in) are the
only env files in the repository:

- `.env.local` — repo root, optional; written by `neon deploy`.
- `apps/api/.env` — copied from `apps/api/.env.example`.

The API and the Prisma scripts load `.env.local` first, then `apps/api/.env`, and a real process
environment wins over both.

| Variable                | Where             | Purpose                                                                                                                       |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | root `.env.local` | Pooled Postgres connection used by the API (`neon deploy` writes it).                                                          |
| `DATABASE_URL_UNPOOLED` | root `.env.local` | Direct Postgres connection; mapped to `DIRECT_URL`.                                                                            |
| `DIRECT_URL`            | `apps/api`        | Direct Postgres connection for Prisma CLI/migrations. Defaults to `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`.                |
| `JWT_SECRET`            | `apps/api`        | HS256 signing secret, **32+ characters**. Generate your own; never commit it.                                                  |
| `PORT`                  | `apps/api`        | API port, default `4000`.                                                                                                      |
| `CLIENT_ORIGIN`         | `apps/api`        | Allowed browser origin(s) for CORS, Origin checks, and Socket.IO. Comma-separated; loopback ports are accepted when this is a loopback URL. |
| `NODE_ENV`              | `apps/api`        | `development`, `test`, or `production` (enables static SPA + secure cookies).                                                   |
| `TEST_DATABASE_URL`     | `apps/api`        | Used by the Vitest setup; defaults to the local `kanban_test` database.                                                        |

**Never commit real credentials.** `.env`, `.env.*`, `*.local`, and `.neon` are gitignored; only
`*.env.example` templates are tracked.

## How it works

### Data model

`User` ↔ `Membership` ↔ `Workplace`; a workplace owns `BoardColumn`, `Card`, `Tag`, and
`Invitation`. Cards own `Subtask`, `Comment`, `CardTag`, and `CardAssignee` join rows. Anyone in
the workplace can assign one or more members to a card; removing a member clears their assignments
in that workplace. Descriptions are stored as GitHub-flavored Markdown and rendered client-side with
raw HTML disabled. One board per workplace.
All resource access resolves the resource → workplace → membership, so IDs from another workplace
return `404`.

### Ordering

Column and card positions are contiguous integers. Moving a card reads both affected columns,
clamps the target index, and writes the new order in **one parameterized SQL update** inside a
`Serializable` transaction (retried on write conflicts). Deleting a column re-appends its cards to
the first visible remaining column before removing it. The board sorts by `position, createdAt, id`,
so a rare tie is still deterministic.

### Realtime

Authenticated sockets join `user:<id>` and `workplace:<id>` rooms. Mutations emit small ID-only
events after the transaction commits; clients invalidate the relevant TanStack Query keys, making
the server the source of truth. Accepting an invitation joins the socket to the new room;
removing a member makes it leave. No Redis adapter is configured — the realtime layer assumes a
single API instance.

### Permissions

| Action                                                      | Member | Owner |
| ----------------------------------------------------------- | :----: | :---: |
| View board, cards, members                                  |   ✅   |  ✅   |
| Create/edit/move/delete cards, subtasks, comments           |   ✅   |  ✅   |
| Create and assign tags                                      |   ✅   |  ✅   |
| Assign/unassign workplace members on cards                  |   ✅   |  ✅   |
| Rename/delete tags                                          |   —    |  ✅   |
| Add/rename/reorder/hide/delete columns                      |   —    |  ✅   |
| Invite/cancel invitations, remove members, rename workplace |   —    |  ✅   |
| Leave workplace                                             |   ✅   |  —    |

Comment authors can edit their own comments; authors and the owner can delete them. The owner
cannot remove themselves or leave their own workplace (ownership transfer is not implemented).

## Deploy

This app is **one long-lived Node service**: the API serves the built SPA and the WebSocket on the
same origin (`app.ts`) and serves `apps/web/dist` when `NODE_ENV=production`. That keeps the session
cookie first-party and lets Socket.IO connect with no CORS setup, so any host that runs a container
works.

> **Netlify / Vercel?** The SPA deploys there, but the API does not: serverless functions cannot
> hold a Socket.IO connection open, and this API keeps socket rooms and rate-limit counters in
> process memory. If you must split them, the session cookie is `SameSite=Lax`, so host both under
> one site — e.g. `app.example.com` + `api.example.com` — or login will silently fail.

The included `Dockerfile` builds both apps and starts the API with migrations applied.

### Render (blueprint included)

1. Push the repo to GitHub.
2. Render → **New → Blueprint** → pick the repo (`render.yaml` is detected).
3. Fill in the prompted values:
   - `DATABASE_URL` — pooled Neon connection string.
   - `DATABASE_URL_UNPOOLED` — direct Neon connection string (optional but recommended; mapped to
     `DIRECT_URL`).
   - `CLIENT_ORIGIN` — the public URL Render assigns, e.g. `https://kanban-board.onrender.com`.
   - `JWT_SECRET` is generated for you.
   Paste each value **bare**: Render stores exactly what you type, so `"postgresql://…"` with
   surrounding quotes — valid inside a `.env` file — becomes an invalid URL at runtime.
4. Deploy. The entrypoint applies migrations before the API starts listening.

Free instances spin down after ~15 minutes idle; connected clients reconnect when the service wakes.

### Railway

1. New Project → Deploy from a GitHub repo (Railway detects the `Dockerfile`).
2. Add `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, and `CLIENT_ORIGIN`.
3. Generate a public domain, put that exact URL in `CLIENT_ORIGIN`, then redeploy.

### Fly.io

```bash
fly launch --no-deploy          # accept the Dockerfile; internal port 4000
fly secrets set \
  DATABASE_URL="postgresql://...pooler..." \
  DATABASE_URL_UNPOOLED="postgresql://..." \
  JWT_SECRET="$(openssl rand -base64 48)" \
  CLIENT_ORIGIN="https://your-app.fly.dev"
fly deploy
```

### Plain Docker or a VPS

```bash
docker build -t kanban-board .
docker run -d --name kanban -p 4000:4000 \
  -e DATABASE_URL="postgresql://...pooler..." \
  -e DATABASE_URL_UNPOOLED="postgresql://..." \
  -e JWT_SECRET="<32+ random characters>" \
  -e CLIENT_ORIGIN="https://your-domain.example" \
  kanban-board
```

Point a reverse proxy (Caddy, nginx, Traefik) at port 4000 for TLS. Cookies are marked `Secure` only
when every configured origin is `https://`, so a loopback origin keeps local production-mode testing
working.

### Production variables

| Variable                | Value                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`          | Pooled Postgres connection (Neon pooler or your own).                     |
| `DATABASE_URL_UNPOOLED` | Optional. Direct connection; mapped to `DIRECT_URL` for migrations, falling back to `DATABASE_URL`. |
| `JWT_SECRET`            | 32+ random characters. Never reuse the example value.                      |
| `CLIENT_ORIGIN`         | Exact public origin, e.g. `https://kanban.example`. Drives CORS + cookies. |
| `NODE_ENV`              | `production` — serves the SPA from the API, enables `Secure` cookies on https origins. |

`docker/entrypoint.sh` runs `prisma migrate deploy` before starting the server. Set only
`DATABASE_URL` if your host provides a single connection string — migrations reuse it. To run
migrations by hand, use `pnpm db:deploy`. If you ever run more than one replica, move migrations
to a pre-deploy step and add a Redis adapter for Socket.IO first — the realtime layer assumes one
process.

### Troubleshooting

**`P1013: The provided database string is invalid. The scheme is not recognized`**

Prisma received something that is not a bare URL. The usual causes are surrounding quotes, a
pasted `DATABASE_URL=` prefix, or a trailing newline. `docker/entrypoint.sh` trims whitespace and
strips one layer of quotes, and logs the scheme it found; if it still fails, inspect the value from
the Render shell:

```bash
node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.protocol, u.hostname)'
```

It should print `postgresql:` and your Neon host, e.g. `ep-xxx-pooler.ap-southeast-1.aws.neon.tech`.
An exception means the variable itself is malformed — re-paste it from the Neon dashboard, choosing
the **pooled** connection string for `DATABASE_URL` and the **direct** one for
`DATABASE_URL_UNPOOLED`.

### Native (no Docker)

Any Node 22+ host works:

```bash
pnpm install && pnpm build
pnpm db:deploy
pnpm start
```

`start` preloads the repo-root `.env.local` when present, so a Neon-linked checkout needs no extra
flags; otherwise provide the variables above from the host. A minimal manual run for smoke-testing:

```bash
NODE_ENV=production CLIENT_ORIGIN="https://your-domain.example" pnpm start
```

## Project layout

```
apps/api        Express API, Prisma schema/migrations, Socket.IO, Vitest integration tests
apps/web        Vite React app, TanStack Query, dnd-kit board, Radix/Tailwind UI
apps/mcp        MCP stdio server: 39 board tools for Claude, Cursor, Codex, and other AI clients
packages/shared Zod schemas, limits, DTOs, realtime event names
docs            Screenshots, the MCP guide, and ReadMe-ready pages in `docs/readme/`
docker/init     Creates the kanban_test database on first container boot
docker/entrypoint.sh  Applies migrations, then starts the API (used by the Docker image)
Dockerfile      Multi-stage image for Render, Railway, Fly.io, and plain Docker
render.yaml     Render Blueprint: one web service, env vars, health check
DESIGN.md       Design system: color, type, spacing, motion rules
PRODUCT.md      Product intent, jobs to be done, principles
```

## Contributing

Issues and pull requests are welcome.

1. Fork the repo and create a branch: `git checkout -b feat/short-description`.
2. Follow the [Quick start](#quick-start) to get the app and test database running.
3. Keep the checks green before opening a PR:

   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

4. Describe **what** changed and **why** in the PR; include a screenshot for UI changes.

Conventions worth matching: TypeScript strict mode everywhere, Zod schemas shared through
`packages/shared` rather than duplicated, no new dependencies without a clear need, and UI work
should follow `DESIGN.md`.

## Security

Please do not open a public issue for a security problem. Report it privately to the maintainer
(open a [GitHub security advisory](https://docs.github.com/code-security/security-advisories) on
this repo), and allow a reasonable window for a fix before disclosing it.

Two things to know if you deploy this: `JWT_SECRET` must be a unique random value (the example file
ships a deliberately insecure development default), and the realtime layer assumes a single API
instance — add a Redis adapter before scaling horizontally.

Sign-up hardening:

- Usernames are trimmed, lowercased, and limited to `a-z`, `0-9`, and `_`; embedded spaces and
  reserved names (`admin`, `support`, `api`, …) are rejected.
- Passwords must be 8–200 characters with uppercase and lowercase letters, a number, and a symbol,
  must not appear on a common-password list, and must not contain the username or email local-part.
- `GET /api/auth/availability` powers the live check, is limited to 60 requests/minute per IP, and
  returns `Cache-Control: no-store`. It necessarily reveals whether a username or email exists;
  keep the limit in place if you expose the app publicly.
- The availability check is a UX aid only. `POST /api/auth/register` re-checks both columns and maps
  unique-constraint races to per-field `409 CONFLICT` errors.

## Intentionally out of scope (v1)

Multiple boards per workplace, attachments, due dates/reminders, @mentions and email
notifications, email verification/password reset, OAuth, dark mode, activity history, global
search, workplace deletion/ownership transfer, account deletion, and a Redis-scaled socket layer.

## License

[MIT](LICENSE) © 2026 gemasaputera
