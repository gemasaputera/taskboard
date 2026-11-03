import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { commentBodySchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json } from './shared.js';

export function registerCommentTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'add_comment',
    {
      title: 'Add comment',
      description:
        'Post a comment on a card as the signed-in user. Plain text, up to 5000 characters.',
      inputSchema: {
        cardId: z.string().uuid().describe('Card UUID.'),
        body: commentBodySchema.describe('Comment text.'),
      },
      annotations: { openWorldHint: false },
    },
    async ({ cardId, body }) => json(await client.createComment(cardId, body)),
  );

  server.registerTool(
    'update_comment',
    {
      title: 'Edit comment',
      description:
        'Edit one of your own comments. Get comment IDs from get_card. The comment author ' +
        'or the workplace owner can delete a comment, but only the author can edit it.',
      inputSchema: {
        commentId: z.string().uuid().describe('Comment UUID.'),
        body: commentBodySchema.describe('Replacement comment text.'),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ commentId, body }) => json(await client.updateComment(commentId, body)),
  );

  server.registerTool(
    'delete_comment',
    {
      title: 'Delete comment',
      description:
        'Delete a comment. You can delete your own comments; the workplace owner can ' +
        'delete anyone’s comment in their workplace.',
      inputSchema: { commentId: z.string().uuid().describe('Comment UUID.') },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ commentId }) => {
      await client.deleteComment(commentId);
      return json({ ok: true, deletedCommentId: commentId });
    },
  );
}
