import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { KanbanApiClient } from './client.js';
import { ConfigError, loadConfig } from './config.js';
import { createKanbanServer, SERVER_VERSION } from './server.js';

const HELP = `kanban-mcp ${SERVER_VERSION}

Model Context Protocol server for the Kanban API. It speaks JSON-RPC over stdio, so it is
normally launched by an MCP client rather than by hand.

Usage:
  kanban-mcp [options]

Options:
  --api-url <url>        Kanban API base URL (default: http://localhost:4000)
  --username <name>      Sign in automatically with this username or email
  --password <password>  Password used with --username
  --session-token <v>    Use an existing kanban_session cookie instead of signing in
  --session-file <path>  Session cache path (default: ~/.kanban-mcp/session.json)
  --no-session-file      Keep the session in memory only
  --workplace-id <uuid>  Default workplace when a tool omits workplaceId
  -h, --help             Show this help
  -v, --version          Show the version

Environment:
  KANBAN_API_URL, KANBAN_USERNAME, KANBAN_PASSWORD, KANBAN_SESSION_TOKEN,
  KANBAN_SESSION_FILE, KANBAN_WORKPLACE_ID

Examples:
  KANBAN_USERNAME=ada KANBAN_PASSWORD=secret kanban-mcp
  kanban-mcp --api-url https://kanban.example.com --session-token "$KANBAN_COOKIE"
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }

  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return;
  }

  let config;

  try {
    config = loadConfig(argv);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`[kanban-mcp] ${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const client = new KanbanApiClient(config);
  const server = createKanbanServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // stdout belongs to the protocol; diagnostics go to stderr.
  const auth = config.sessionToken
    ? 'with the provided session cookie'
    : config.username
      ? `as ${config.username}`
      : 'signed out (use the login tool or set KANBAN_USERNAME/KANBAN_PASSWORD)';

  process.stderr.write(`[kanban-mcp] ready — API ${config.apiUrl}, ${auth}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `[kanban-mcp] failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
