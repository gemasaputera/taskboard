import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KanbanApiClient } from './client.js';
import { registerTools } from './tools/index.js';

export const SERVER_NAME = 'kanban';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = `Kanban board tools for a small-team Trello-style app.

- Start with whoami or list_workplaces. Every board tool takes an optional workplaceId;
  it can be omitted when you belong to exactly one workplace (or KANBAN_WORKPLACE_ID is set).
- get_board lists columns and cards with their IDs. get_card adds descriptions, checklist
  subtasks, and comments, including the subtask/comment IDs.
- Column tools accept columnName as an alternative to columnId; set_card_tags accepts tag
  names, and set_card_assignees accepts usernames, so IDs are rarely needed by hand.
- Mutations go through the same API as the web app, so anyone with the board open sees
  the change immediately over Socket.IO.
- Confirm with the user before destructive calls: delete_card, delete_column, delete_tag,
  delete_subtask, delete_comment, remove_member, leave_workplace, decline_invitation,
  and cancel_invitation.`;

/** Builds the MCP server without attaching a transport, which also makes it testable. */
export function createKanbanServer(client: KanbanApiClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerTools(server, client);

  return server;
}
