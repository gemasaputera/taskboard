import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { cardTitleSchema, columnNameSchema, descriptionSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import {
  defaultColumn,
  json,
  resolveColumn,
  resolveMemberUserIds,
  resolveTagIds,
  resolveWorkplaceId,
} from './shared.js';

const workplaceIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Workplace UUID. Omit when you belong to exactly one workplace.');

const cardIdSchema = z.string().uuid().describe('Card UUID.');

export function registerCardTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'create_card',
    {
      title: 'Create card',
      description:
        'Create a card. Without columnId/columnName it goes to the first visible column. ' +
        'The description is GitHub-flavored Markdown.',
      inputSchema: {
        title: cardTitleSchema.describe('Card title, up to 200 characters.'),
        description: descriptionSchema.describe(
          'Markdown description, up to 10000 characters. Omit for none.',
        ),
        columnId: z.string().uuid().optional().describe('Target column UUID.'),
        columnName: columnNameSchema
          .optional()
          .describe('Target column name, case-insensitive. Ignored when columnId is set.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { openWorldHint: false },
    },
    async (args) => {
      const workplaceId = await resolveWorkplaceId(client, args.workplaceId);
      const board = await client.getBoard(workplaceId);
      const column =
        args.columnId || args.columnName
          ? resolveColumn(board, { columnId: args.columnId, columnName: args.columnName })
          : defaultColumn(board);

      const card = await client.createCard(workplaceId, {
        columnId: column.id,
        title: args.title,
        description: args.description ?? null,
      });

      return json(card);
    },
  );

  server.registerTool(
    'get_card',
    {
      title: 'Get card',
      description:
        'Read one card in full: description, tags, assignees, checklist subtasks, and comments.',
      inputSchema: { cardId: cardIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ cardId }) => json(await client.getCard(cardId)),
  );

  server.registerTool(
    'update_card',
    {
      title: 'Update card',
      description:
        'Change a card title or Markdown description. Omit a field to leave it unchanged; ' +
        'pass description: null to clear the description.',
      inputSchema: {
        cardId: cardIdSchema,
        title: cardTitleSchema.optional().describe('New title.'),
        description: descriptionSchema.describe('New Markdown description, or null to clear it.'),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ cardId, title, description }) => {
      if (title === undefined && description === undefined) {
        throw new Error('Pass title, description, or both.');
      }
      return json(await client.updateCard(cardId, { title, description }));
    },
  );

  server.registerTool(
    'delete_card',
    {
      title: 'Delete card',
      description:
        'Permanently delete a card with its subtasks, comments, tags, and assignees. ' +
        'Card IDs do not come back; confirm with the user before deleting.',
      inputSchema: { cardId: cardIdSchema },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ cardId }) => {
      await client.deleteCard(cardId);
      return json({ ok: true, deletedCardId: cardId });
    },
  );

  server.registerTool(
    'move_card',
    {
      title: 'Move card',
      description:
        'Move a card to a column and 0-based position. Omit position to append to the end ' +
        'of the target column, and omit columnId/columnName to reorder within the current column.',
      inputSchema: {
        cardId: cardIdSchema,
        columnId: z.string().uuid().optional().describe('Target column UUID.'),
        columnName: columnNameSchema
          .optional()
          .describe('Target column name, case-insensitive. Ignored when columnId is set.'),
        position: z
          .number()
          .int()
          .min(0)
          .max(10_000)
          .optional()
          .describe('0-based index in the target column. Omit to append.'),
      },
      annotations: { openWorldHint: false },
    },
    async ({ cardId, columnId, columnName, position }) => {
      const card = await client.getCard(cardId);
      const board = await client.getBoard(card.workplaceId);

      const column =
        columnId || columnName
          ? resolveColumn(board, { columnId, columnName })
          : board.columns.find((candidate) => candidate.id === card.columnId);

      if (!column) {
        throw new Error('The card is in a column that is no longer on the board.');
      }

      // The API clamps and re-indexes; excluding the moving card keeps "append" correct
      // for same-column moves too.
      const remaining = board.cards.filter(
        (candidate) => candidate.columnId === column.id && candidate.id !== cardId,
      );
      const targetPosition = position ?? remaining.length;

      const result = await client.moveCard(cardId, {
        columnId: column.id,
        position: targetPosition,
      });

      return json({ ...result, column: column.name });
    },
  );

  server.registerTool(
    'set_card_tags',
    {
      title: 'Set card tags',
      description:
        'Replace every tag on a card. Pass tagNames (case-insensitive, must already exist) ' +
        'and/or tagIds. Pass an empty array to remove all tags.',
      inputSchema: {
        cardId: cardIdSchema,
        tagNames: z.array(z.string().trim().min(1)).max(30).optional(),
        tagIds: z.array(z.string().uuid()).max(30).optional(),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ cardId, tagNames, tagIds }) => {
      if (tagNames === undefined && tagIds === undefined) {
        throw new Error('Pass tagNames, tagIds, or both. Use empty arrays to clear the tags.');
      }

      const card = await client.getCard(cardId);
      const ids = await resolveTagIds(client, card.workplaceId, { tagIds, tagNames });
      const tags = await client.setCardTags(cardId, ids);

      return json({ cardId, tags });
    },
  );

  server.registerTool(
    'set_card_assignees',
    {
      title: 'Set card assignees',
      description:
        'Replace every assignee on a card. Pass usernames and/or user IDs of workplace ' +
        'members. Pass an empty array to unassign everyone.',
      inputSchema: {
        cardId: cardIdSchema,
        usernames: z.array(z.string().trim().min(1)).max(50).optional(),
        userIds: z.array(z.string().uuid()).max(50).optional(),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ cardId, usernames, userIds }) => {
      if (usernames === undefined && userIds === undefined) {
        throw new Error('Pass usernames, userIds, or both. Use empty arrays to unassign everyone.');
      }

      const card = await client.getCard(cardId);
      const ids = await resolveMemberUserIds(client, card.workplaceId, { userIds, usernames });
      const assignees = await client.setCardAssignees(cardId, ids);

      return json({ cardId, assignees });
    },
  );
}
