---
title: MCP clients
category:
  uri: 'AI & MCP'
position: 2
slug: mcp-clients
privacy:
  view: public
content:
  excerpt: Connect Hermes Agent over HTTP OAuth, or use the stdio server with Claude Code, Claude Desktop, Cursor, and Codex.
---

The MCP server supports two transports:

| Mode                        | Best for                                                              | Endpoint                       |
| :-------------------------- | :-------------------------------------------------------------------- | :----------------------------- |
| **Streamable HTTP + OAuth** | Hermes Agent, hosted clients, or anything that cannot spawn a process | `https://your-app.example/mcp` |
| **stdio**                   | A client on the same machine that can launch Node                     | `node apps/mcp/dist/index.js`  |

The HTTP endpoint exposes **36 tools**. It omits `login`, `register_account`, and `logout` because
the OAuth access token already identifies the user. The stdio server exposes all **39**.

## Remote HTTP with OAuth

This is the recommended setup for Hermes Agent. Add the endpoint to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  kanban:
    url: 'https://kanban-board-p4kk.onrender.com/mcp'
    auth: oauth
```

Hermes discovers the OAuth metadata at `/.well-known/oauth-protected-resource`, registers a client,
and opens a browser. If you are not signed in to Kanban, it sends you to the login page first; then
it shows a consent screen. Approve it once. Hermes stores the access and refresh tokens and renews
them automatically.

Notes:

- No `KANBAN_USERNAME`, password, or API key is needed.
- The MCP server discovers and protects `https://kanban-board-p4kk.onrender.com/mcp`; the deployed
  app must include this feature. If `/mcp` returns `404`, deploy the latest `main`.
- `PUBLIC_URL` (or the first `CLIENT_ORIGIN` in production) must be the app's public **HTTPS**
  origin. It is used in the OAuth metadata and consent redirects.
- On a headless host, run `hermes mcp login kanban`. Hermes prints the authorization URL and
  supports its paste-back flow when the loopback callback cannot reach the browser.
- After editing the config, run `/reload-mcp`; Hermes prefixes the tools as
  `mcp__kanban__whoami`, `mcp__kanban__get_board`, and so on.

> 📘 The OAuth endpoint is the same Render service as the app. There is no separate MCP deployment
> to run.

## Local stdio clients

Build the server once:

```bash
pnpm --filter @kanban/mcp build
```

Outside Claude Code, use an **absolute** path to `dist/index.js`; other clients do not launch
servers relative to this repository.

For the deployed app, set `KANBAN_API_URL` to `https://kanban-board-p4kk.onrender.com` instead of
`http://localhost:4000`. On Render's free tier, the first request after an idle period can take
30–60 seconds to wake the service; the MCP client waits up to 60 seconds for it.

### Claude Code

The repository ships `.mcp.json`, so opening the project in Claude Code offers the `kanban` server
automatically. Approve it once when prompted.

To add it to your user-level configuration instead:

```bash
claude mcp add kanban \
  --env KANBAN_API_URL=http://localhost:4000 \
  -- node /absolute/path/to/taskboard/apps/mcp/dist/index.js
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or
`%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/taskboard/apps/mcp/dist/index.js"],
      "env": {
        "KANBAN_API_URL": "http://localhost:4000",
        "KANBAN_USERNAME": "ada",
        "KANBAN_PASSWORD": "your-password"
      }
    }
  }
}
```

### Cursor

Use `.cursor/mcp.json` for a project, or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/taskboard/apps/mcp/dist/index.js"],
      "env": { "KANBAN_API_URL": "http://localhost:4000" }
    }
  }
}
```

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.kanban]
command = "node"
args = ["/absolute/path/to/taskboard/apps/mcp/dist/index.js"]
env = { KANBAN_API_URL = "http://localhost:4000" }
```

### Hermes Agent (stdio alternative)

If Hermes runs on the same machine as the repository and you prefer stdio:

```yaml
mcp_servers:
  kanban:
    command: 'node'
    args: ['/absolute/path/to/taskboard/apps/mcp/dist/index.js']
    env:
      KANBAN_API_URL: 'https://kanban-board-p4kk.onrender.com'
      KANBAN_USERNAME: '${KANBAN_USERNAME}'
      KANBAN_PASSWORD: '${KANBAN_PASSWORD}'
    timeout: 120
    connect_timeout: 60
```

Put the credentials in `~/.hermes/.env`, or remove them and call the `login` tool once.

### Other stdio clients

Launch `node <repo>/apps/mcp/dist/index.js` with `KANBAN_API_URL` in the environment. All
diagnostics go to stderr, so stdout stays clean for the protocol.

You can also pass configuration as flags:

```bash
node apps/mcp/dist/index.js \
  --api-url http://localhost:4000 \
  --username ada \
  --password your-password
```

## Authenticate a stdio client

If your client config does not include `KANBAN_USERNAME` and `KANBAN_PASSWORD`, ask the AI to call
the `login` tool. The session is cached in `~/.kanban-mcp/session.json` and reused on later runs.

> 🔑 **Do not commit credentials.** `.mcp.json` in this repository contains no secrets. Keep
> passwords in your client's local configuration or environment, or sign in with the `login` tool.

## Verify the connection

1. Restart the client after changing MCP configuration.
2. Ask it to call `whoami` or `list_workplaces`.
3. Ask for the board: "Show me the board" should call `get_board`.

For HTTP, a `401` on the first call is expected: Hermes starts the OAuth flow.

## Troubleshooting

### `/mcp` returns 404

The deployed service does not include the HTTP endpoint yet. Merge and redeploy the latest `main`,
then retry.

### OAuth metadata or consent fails

Check that `PUBLIC_URL` (or the first `CLIENT_ORIGIN`) is the exact public HTTPS origin, with no
trailing slash. The app must be reachable at that origin for the browser consent redirect.

### The browser keeps returning to the login page

The consent request needs the `kanban_session` cookie. Make sure the app and OAuth endpoint share
the same origin, and that you are signed in at that origin before approving.

### Only 36 tools appear over HTTP

That is expected. `login`, `register_account`, and `logout` are stdio-only; the OAuth token already
identifies the user.

### The stdio server does not appear in my client

- Rebuild `apps/mcp` and confirm `apps/mcp/dist/index.js` exists.
- Confirm the path in the config is absolute (except for Claude Code's project `.mcp.json`).
- Restart the client fully; most only read MCP configuration at startup.

### The stdio server starts but every tool reports a connection error

Start the API (`pnpm dev:api`) and check `KANBAN_API_URL`. A deployed API needs its public HTTPS
origin, not `localhost`.

### `spawn node ENOENT`

Your client cannot find Node on its `PATH`. Use the absolute path to the Node binary in the
`command` field, or install Node 22+ system-wide.
