import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { subtaskTitleSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json } from './shared.js';

export function registerSubtaskTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'add_subtask',
    {
      title: 'Add checklist item',
      description: 'Append a checklist item (subtask) to a card.',
      inputSchema: {
        cardId: z.string().uuid().describe('Card UUID.'),
        title: subtaskTitleSchema.describe('Checklist item text, up to 200 characters.'),
      },
      annotations: { openWorldHint: false },
    },
    async ({ cardId, title }) => json(await client.createSubtask(cardId, title)),
  );

  server.registerTool(
    'update_subtask',
    {
      title: 'Update checklist item',
      description:
        'Rename a checklist item or mark it done/not done. Get subtask IDs from get_card.',
      inputSchema: {
        subtaskId: z.string().uuid().describe('Subtask UUID.'),
        title: subtaskTitleSchema.optional().describe('New text.'),
        isDone: z.boolean().optional().describe('true marks it complete, false reopens it.'),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ subtaskId, title, isDone }) => {
      if (title === undefined && isDone === undefined) {
        throw new Error('Pass title, isDone, or both.');
      }
      return json(await client.updateSubtask(subtaskId, { title, isDone }));
    },
  );

  server.registerTool(
    'delete_subtask',
    {
      title: 'Delete checklist item',
      description: 'Permanently delete a checklist item from a card.',
      inputSchema: { subtaskId: z.string().uuid().describe('Subtask UUID.') },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ subtaskId }) => {
      await client.deleteSubtask(subtaskId);
      return json({ ok: true, deletedSubtaskId: subtaskId });
    },
  );
}
