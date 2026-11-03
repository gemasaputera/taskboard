---
title: MCP clients
category:
  uri: 'AI & MCP'
position: 2
slug: mcp-clients
privacy:
  view: public
content:
  excerpt: Copy-paste configurations for Claude Code, Claude Desktop, Cursor, Codex, and any other stdio MCP client.
---

The MCP server is a **stdio** server: your client launches `node apps/mcp/dist/index.js` and talks
JSON-RPC over stdin/stdout. Build it first:

```bash
pnpm --filter @kanban/mcp build
```

Outside Claude Code, use an **absolute** path to `dist/index.js`; other clients do not launch
servers relative to this repository.

## Claude Code

The repository ships `.mcp.json`, so opening the project in Claude Code offers the `kanban` server
automatically. Approve it once when prompted.

To add it to your user-level configuration instead:

```bash
claude mcp add kanban \
  --env KANBAN_API_URL=http://localhost:4000 \
  -- node /absolute/path/to/taskboard/apps/mcp/dist/index.js
```

## Claude Desktop

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

## Cursor

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

## Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.kanban]
command = "node"
args = ["/absolute/path/to/taskboard/apps/mcp/dist/index.js"]
env = { KANBAN_API_URL = "http://localhost:4000" }
```

## Other stdio clients

Launch `node <repo>/apps/mcp/dist/index.js` with `KANBAN_API_URL` in the environment. All
diagnostics go to stderr, so stdout stays clean for the protocol.

You can also pass configuration as flags:

```bash
node apps/mcp/dist/index.js \
  --api-url http://localhost:4000 \
  --username ada \
  --password your-password
```

## Authenticate once

If your client config does not include `KANBAN_USERNAME` and `KANBAN_PASSWORD`, ask the AI to call
the `login` tool. The session is cached in `~/.kanban-mcp/session.json` and reused on later runs.

> 🔑 **Do not commit credentials.** `.mcp.json` in this repository contains no secrets. Keep
> passwords in your client's local configuration or environment, or sign in with the `login` tool.

## Verify the connection

1. Restart the client after changing MCP configuration.
2. Ask it to call `whoami` or `list_workplaces`.
3. Ask for the board: "Show me the board" should call `get_board`.

If your client lists tools but calls fail, check that the API is running and that `KANBAN_API_URL`
points at it.

## Troubleshooting

### The server does not appear in my client

- Rebuild `apps/mcp` and confirm `apps/mcp/dist/index.js` exists.
- Confirm the path in the config is absolute (except for Claude Code's project `.mcp.json`).
- Restart the client fully; most only read MCP configuration at startup.

### The server starts but every tool reports a connection error

Start the API (`pnpm dev:api`) and check `KANBAN_API_URL`. A deployed API needs its public HTTPS
origin, not `localhost`.

### `spawn node ENOENT`

Your client cannot find Node on its `PATH`. Use the absolute path to the Node binary in the
`command` field, or install Node 22+ system-wide.

### Tools work for me but not for a teammate

Each person signs in as their own Kanban user. The MCP server never shares a session between
machines; run `login` on each one.
