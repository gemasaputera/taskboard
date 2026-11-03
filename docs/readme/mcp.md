---
title: MCP server
category:
  uri: 'AI & MCP'
position: 0
slug: mcp
privacy:
  view: public
content:
  excerpt: Connect Hermes Agent over HTTP OAuth, or use the stdio server with Claude, Cursor, Codex, or any MCP client.
---

`apps/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server for the board. It
exposes the board — workplaces, columns, cards, checklists, comments, tags, members, and
invitations — so an AI client can work directly.

It supports two transports:

| Transport                   | Tools | Use when                                                                |
| :-------------------------- | :---- | :---------------------------------------------------------------------- |
| **Streamable HTTP + OAuth** | 36    | Hermes Agent, hosted clients, or anything that cannot launch Node       |
| **stdio**                   | 39    | A client on the same machine that can run `node apps/mcp/dist/index.js` |

The HTTP endpoint omits `login`, `register_account`, and `logout`; the OAuth token already
identifies the user.

## Remote HTTP with OAuth

Point Hermes Agent at the deployed `/mcp` endpoint:

```yaml
mcp_servers:
  kanban:
    url: 'https://kanban-board-p4kk.onrender.com/mcp'
    auth: oauth
```

Hermes discovers the OAuth metadata, registers itself, opens the Kanban login page if needed, and
shows a consent screen. Approve it once; Hermes stores the access and refresh tokens and renews
them automatically. There is nothing to build locally and no password or API key to configure.

The OAuth metadata uses `PUBLIC_URL`, or the first `CLIENT_ORIGIN` in production. It must be the
app's public HTTPS origin. The `/mcp` endpoint lives on the same service as the app — no separate
deployment.

See [MCP clients](/docs/mcp-clients) for the Hermes details, headless login, and troubleshooting.

```
AI client ── HTTP + OAuth ──> /mcp ── Bearer ──> /api ──> PostgreSQL
                                                   └─ Socket.IO ──> open browsers
```

## Local stdio

```
AI client ── stdio ──> apps/mcp ── REST + session cookie ──> apps/api ──> PostgreSQL
                                                              └─ Socket.IO ──> open browsers
```

The server is a thin client of the same API the web app uses. Nothing is reimplemented: validation,
ownership rules, card ordering, and Socket.IO broadcasts still happen in the API, so a browser that
is open updates live while the AI works.

### Requirements

- The API running (`pnpm dev:api`) or a deployed instance
- Node 22+
- A Kanban account in that API

### 1. Build the server

```bash
pnpm install
pnpm --filter @kanban/mcp build
```

`pnpm build` also works and builds the web app and API at the same time. The compiled entrypoint is
`apps/mcp/dist/index.js`.

### 2. Point your client at it

The repository ships a `.mcp.json` for Claude Code. For Claude Desktop, Cursor, Codex, Hermes
Agent in stdio mode, and other clients, copy the config from [MCP clients](/docs/mcp-clients).

### 3. Sign in

Choose one:

| Method                       | How                                                                                                                        |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **Login tool** (recommended) | Ask the AI to call `login` with your username or email and password. The session is cached in `~/.kanban-mcp/session.json` |
| **Environment**              | Set `KANBAN_USERNAME` and `KANBAN_PASSWORD`; the server signs in on demand                                                 |
| **Session token**            | Set `KANBAN_SESSION_TOKEN` to an existing `kanban_session` cookie value                                                    |

Sessions last seven days. With credentials configured, an expired cookie is replaced automatically
with a fresh login.

> 🔑 **Keep credentials out of git.** The session file is written with owner-only permissions
> (`0600`). If you put a password in a client config, that file stores it in plain text — prefer the
> `login` tool or environment variables.

### Configuration

| Variable               | Default                      | Purpose                                           |
| :--------------------- | :--------------------------- | :------------------------------------------------ |
| `KANBAN_API_URL`       | `http://localhost:4000`      | API base URL; an `/api` suffix is accepted        |
| `KANBAN_USERNAME`      | —                            | Username or email for automatic sign-in           |
| `KANBAN_PASSWORD`      | —                            | Password for automatic sign-in                    |
| `KANBAN_SESSION_TOKEN` | —                            | Existing session cookie value                     |
| `KANBAN_SESSION_FILE`  | `~/.kanban-mcp/session.json` | Session cache path                                |
| `KANBAN_WORKPLACE_ID`  | —                            | Default workplace when a tool omits `workplaceId` |

CLI flags mirror them: `--api-url`, `--username`, `--password`, `--session-token`,
`--session-file`, `--no-session-file`, `--workplace-id`, plus `--help` and `--version`.

Every board tool accepts an optional `workplaceId`. Omit it when you belong to one workplace; with
several, the error lists the choices. `get_board` is the best way for the model to discover column
and card IDs.

## Safety

- **The API is the authority.** The MCP server acts as a normal user, so owners and members get
  exactly the permissions the web app gives them.
- **Destructive tools** include `delete_card`, `delete_column`, `delete_tag`, `delete_subtask`,
  `delete_comment`, `remove_member`, `leave_workplace`, `decline_invitation`, and
  `cancel_invitation`. Confirm before the AI runs them, and review your client's auto-approval
  settings.
- **One API instance.** Point the MCP server at the same API your board uses.

## Next

- [MCP tools](/docs/mcp-tools) — every tool and what it does.
- [MCP clients](/docs/mcp-clients) — HTTP OAuth, Claude Code, Claude Desktop, Cursor, Codex, and Hermes setups.
- [Troubleshooting](#troubleshooting).

## Troubleshooting

### `/mcp` returns 404

The deployed service does not include the HTTP endpoint yet. Merge and redeploy `main`, then retry.

### OAuth consent loops or metadata fails

`PUBLIC_URL` (or the first `CLIENT_ORIGIN`) must be the exact public HTTPS origin. Sign in at that
origin before approving. On a headless host, run `hermes mcp login kanban` and use the browser or
paste-back flow.

### `Could not reach the Kanban API at ...`

Start the API (`pnpm dev:api`), or set `KANBAN_API_URL` to the deployed origin. The message includes
the underlying network error.

### `Not signed in to the Kanban API`

For stdio, call the `login` tool, or set `KANBAN_USERNAME` and `KANBAN_PASSWORD`. If a cached cookie
expired and no credentials exist, the cache is cleared automatically. For HTTP, reconnect the client
so Hermes refreshes the OAuth token.

### `Cannot find module .../dist/index.js`

Build the package: `pnpm --filter @kanban/mcp build`. Rebuild after changing the MCP source or the
shared package.

### The AI sees stale data

Restart the MCP server from your client. `get_board` always reads the API fresh; the only cache is
the session.
