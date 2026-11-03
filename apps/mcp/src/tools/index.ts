import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KanbanApiClient } from '../client.js';
import { registerAuthTools } from './auth.js';
import { registerBoardTools } from './board.js';
import { registerCardTools } from './cards.js';
import { registerCommentTools } from './comments.js';
import { registerInvitationTools } from './invitations.js';
import { registerSubtaskTools } from './subtasks.js';
import { registerTagTools } from './tags.js';
import { registerWorkplaceTools } from './workplaces.js';

export function registerTools(server: McpServer, client: KanbanApiClient): void {
  registerAuthTools(server, client);
  registerWorkplaceTools(server, client);
  registerBoardTools(server, client);
  registerCardTools(server, client);
  registerSubtaskTools(server, client);
  registerCommentTools(server, client);
  registerTagTools(server, client);
  registerInvitationTools(server, client);
}
