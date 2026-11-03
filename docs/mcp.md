# MCP server (AI agents)

`apps/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes a
Kanban board as **39 tools**. An AI client can read the board, create and move cards, manage
checklists, comments, tags, assignees, columns, members, and invitations — no browser needed.

```
AI client ── stdio MCP ──> apps/mcp ── REST + session cookie ──> apps/api ──> Postgres
                                                                  └─ Socket.IO ──> open browsers
```

The MCP server is a thin client of the same HTTP API the web app uses. Nothing is reimplemented:
validation, ownership rules, card ordering, and Socket.IO broadcasts all still happen in the API,
so a browser that happens to be open updates live.

## Quick start

**1. Start the API** (the MCP server needs it for every tool call):

```bash
pnpm dev:api            # http://localhost:4000
```

**2. Build the MCP server:**

```bash
pnpm --filter @kanban/mcp build
# or, to build the web app and API too:
pnpm build
```

**3. Point your AI client at `apps/mcp/dist/index.js`.** Claude Code users can use the checked-in
`.mcp.json` as-is; other clients need the config snippets below. Then sign in once — either set
`KANBAN_USERNAME` / `KANBAN_PASSWORD`, or ask the AI to call the `login` tool with your username
and password. The resulting session is cached in `~/.kanban-mcp/session.json`, so this is a
one-time step per machine.

Verify it is alive:

```bash
node apps/mcp/dist/index.js --version
node apps/mcp/dist/index.js --help
```

`pnpm mcp` runs the built server, and `pnpm mcp:dev` runs the TypeScript source with `tsx`
(useful while editing the MCP package).

## Client configuration

Use an **absolute** path to `dist/index.js` outside Claude Code, because other clients do not
launch servers relative to this repository.

### Claude Code

The repository ships `.mcp.json`, so opening the project in Claude Code offers the `kanban`
server automatically. To add it to your user-level config instead:

```bash
claude mcp add kanban \
  --env KANBAN_API_URL=http://localhost:4000 \
  -- node /absolute/path/to/kanban-board/apps/mcp/dist/index.js
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/kanban-board/apps/mcp/dist/index.js"],
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

Same shape, in `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "kanban": {
      "command": "node",
      "args": ["/absolute/path/to/kanban-board/apps/mcp/dist/index.js"],
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
args = ["/absolute/path/to/kanban-board/apps/mcp/dist/index.js"]
env = { KANBAN_API_URL = "http://localhost:4000" }
```

### Any other stdio MCP client

Launch `node <repo>/apps/mcp/dist/index.js` with `KANBAN_API_URL` in the environment. The server
speaks JSON-RPC over stdin/stdout; all diagnostics go to stderr, so stdout stays clean.

## Authentication

The API uses an httpOnly session cookie. The MCP server obtains it in one of three ways:

| Method                       | How                                                            | Persists?                |
| ---------------------------- | -------------------------------------------------------------- | ------------------------ |
| `login` tool (recommended)   | Username/email + password inside the AI chat                   | Yes, to the session file |
| `KANBAN_USERNAME`/`PASSWORD` | Environment or client config; signs in automatically on demand | No, kept in memory       |
| `KANBAN_SESSION_TOKEN`       | An existing `kanban_session` cookie value                      | No                       |

Sessions last seven days. With credentials configured, an expired or rejected cookie is replaced
automatically with a fresh login. The `register_account` tool creates a brand-new account (and a
default workplace), so it is only for explicit sign-up requests.

The session file is written with owner-only permissions (`0600`). Pass `--no-session-file` (or set
`KANBAN_SESSION_FILE` to a different writable path) if you prefer an in-memory session.

## Environment variables

| Variable               | Default                      | Purpose                                           |
| ---------------------- | ---------------------------- | ------------------------------------------------- |
| `KANBAN_API_URL`       | `http://localhost:4000`      | API base URL; `/api` suffix is accepted           |
| `KANBAN_USERNAME`      | —                            | Username or email for automatic sign-in           |
| `KANBAN_PASSWORD`      | —                            | Password for automatic sign-in                    |
| `KANBAN_SESSION_TOKEN` | —                            | Existing session cookie value                     |
| `KANBAN_SESSION_FILE`  | `~/.kanban-mcp/session.json` | Session cache path                                |
| `KANBAN_WORKPLACE_ID`  | —                            | Default workplace when a tool omits `workplaceId` |

CLI flags mirror them: `--api-url`, `--username`, `--password`, `--session-token`,
`--session-file`, `--no-session-file`, `--workplace-id`, plus `--help` and `--version`.

## Tools

Most tools accept an optional `workplaceId`. It can be omitted when you belong to exactly one
workplace (or `KANBAN_WORKPLACE_ID` is set); otherwise the error lists your workplaces.

### Account

| Tool               | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `whoami`           | Signed-in user plus every workplace (id, name, role) |
| `login`            | Sign in with username/email and password             |
| `register_account` | Create an account and its default workplace          |
| `logout`           | Discard the cached session                           |

`register_account` enforces the sign-up rules: lowercase usernames without spaces or reserved
names, and a password with mixed case, a number, and a symbol that is not common or account-derived.
Validation errors come back per field.

### Workplaces and members

| Tool               | What it does                                     | Access |
| ------------------ | ------------------------------------------------ | ------ |
| `list_workplaces`  | Workplaces you belong to                         | member |
| `create_workplace` | New workplace with the four default columns      | any    |
| `rename_workplace` | Rename a workplace                               | owner  |
| `list_members`     | Members with user IDs, roles, join dates         | member |
| `remove_member`    | Remove a member and clear their card assignments | owner  |
| `leave_workplace`  | Leave a workplace                                | member |

### Board and columns

| Tool              | What it does                                                  | Access |
| ----------------- | ------------------------------------------------------------- | ------ |
| `get_board`       | Columns, cards, tags, role — the main ID discovery tool       | member |
| `find_cards`      | Search by title substring, column, tag, or assignee           | member |
| `create_column`   | Add a column at the end                                       | owner  |
| `update_column`   | Rename or hide/show a column                                  | owner  |
| `delete_column`   | Delete a column; its cards move to the first visible column   | owner  |
| `reorder_columns` | Set the left-to-right order; every column ID must appear once | owner  |

### Cards

| Tool                 | What it does                                                            |
| -------------------- | ----------------------------------------------------------------------- |
| `create_card`        | Create a card by `columnId` or `columnName` (defaults to first visible) |
| `get_card`           | Full detail: description, tags, assignees, subtasks, comments           |
| `update_card`        | Change title/description; `description: null` clears it                 |
| `move_card`          | Move to a column and 0-based position; omit position to append          |
| `delete_card`        | Permanently delete the card and its children                            |
| `set_card_tags`      | Replace tags by name or ID; empty arrays clear them                     |
| `set_card_assignees` | Replace assignees by username or user ID; empty arrays unassign         |

All card tools are available to any workplace member.

### Checklists and comments

| Tool             | What it does                                |
| ---------------- | ------------------------------------------- |
| `add_subtask`    | Append a checklist item to a card           |
| `update_subtask` | Rename an item or toggle `isDone`           |
| `delete_subtask` | Delete a checklist item                     |
| `add_comment`    | Comment on a card as the signed-in user     |
| `update_comment` | Edit one of your own comments               |
| `delete_comment` | Delete your comment (owners can delete any) |

### Tags

| Tool         | What it does                                           | Access |
| ------------ | ------------------------------------------------------ | ------ |
| `list_tags`  | Tags in a workplace with IDs and colors                | member |
| `create_tag` | Create a tag; color defaults to the next palette color | member |
| `update_tag` | Rename or recolor a tag                                | owner  |
| `delete_tag` | Delete a tag everywhere it is used                     | owner  |

Colors must come from the app palette: `#d1495b`, `#e07a5f`, `#e9c46a`, `#2a9d8f`, `#457b9d`,
`#6d597a`, `#7a9e7e`, `#5e60ce`.

### Invitations

| Tool                         | What it does                                        | Access |
| ---------------------------- | --------------------------------------------------- | ------ |
| `list_my_invitations`        | Pending invitations addressed to you                | any    |
| `list_workplace_invitations` | Pending invitations sent by a workplace             | owner  |
| `invite_member`              | Invite a registered user by exact username or email | owner  |
| `accept_invitation`          | Accept one of your invitations                      | any    |
| `decline_invitation`         | Decline one of your invitations                     | any    |
| `cancel_invitation`          | Cancel a pending invitation                         | owner  |

## Safety and permissions

- **The API is the authority.** The MCP server holds a normal user session, so owners and members
  get exactly the permissions the web app gives them. Nothing bypasses the API.
- **Credentials stay between the MCP server and `KANBAN_API_URL`.** The session file is local. If
  you put a password in a client config, that file stores it in plain text — prefer the `login`
  tool or environment variables.
- **Destructive calls** (`delete_*`, `remove_member`, `leave_workplace`, `decline_invitation`,
  `cancel_invitation`) permanently change data. The tool descriptions tell the model to confirm
  first, but review what your client is allowed to auto-approve.
- **Single API instance.** Realtime events are emitted by the API process; point the MCP server at
  the same instance your board uses.

## Troubleshooting

**`Could not reach the Kanban API at http://localhost:4000`** — start the API (`pnpm dev:api`) or
set `KANBAN_API_URL` to the deployed origin. The message includes the underlying network error.

**`Not signed in to the Kanban API`** — call `login`, or set `KANBAN_USERNAME` and
`KANBAN_PASSWORD`. If a cached cookie expired and no credentials exist, the cache is cleared
automatically.

**`workplaceId is required because you belong to N workplaces`** — pass the ID from
`list_workplaces`, or set `KANBAN_WORKPLACE_ID`.

**`No column named "..."` / `No tag named "..."`** — the error lists the available names. Cards
accept `columnId` or `columnName`; tags must exist before `set_card_tags` uses them.

**`Cannot find module .../dist/index.js`** — build the package:
`pnpm --filter @kanban/mcp build`. Rebuild after changing the MCP source or the shared package.

**The AI sees stale data after a code change** — restart the MCP server (clients usually restart
stdio servers when you reopen the project). `get_board` always reads the API fresh.

**Session file permission or sandbox errors** — set `KANBAN_SESSION_FILE` to a writable path or run
with `--no-session-file`; a failed write only means the session stays in memory.

**Login rate limit** — the API allows 30 auth requests per minute per IP. Restarting a client
repeatedly can hit it; wait a minute and retry.

## Tests

The MCP suite boots the real Express app in-process and drives the MCP server through the SDK's
in-memory transport, so it covers tool registration, auth, ID resolution, and error messages
end to end:

```bash
pnpm test:db:up
pnpm --filter @kanban/mcp test
```

It uses the same `kanban_test` database as the API suite. `pnpm test` at the repo root runs both
packages serially to avoid two suites truncating the database at once.
