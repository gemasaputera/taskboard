import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { columnNameSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { compactBoard, compactCard, json, resolveColumn, resolveWorkplaceId } from './shared.js';

const workplaceIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Workplace UUID. Omit when you belong to exactly one workplace.');

const columnIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Column UUID. Prefer columnName when the name is unique.');

const columnNameSchemaOptional = columnNameSchema
  .optional()
  .describe('Column name, case-insensitive, e.g. "In Progress".');

export function registerBoardTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'get_board',
    {
      title: 'Get board',
      description:
        'Read a whole board: workplace, your role, tags, and every column with its cards ' +
        '(card IDs, titles, tags, assignees, checklist progress, comment counts). ' +
        'This is the main way to discover cardId and columnId values.',
      inputSchema: { workplaceId: workplaceIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(compactBoard(await client.getBoard(resolved)));
    },
  );

  server.registerTool(
    'find_cards',
    {
      title: 'Find cards',
      description:
        'Search cards on a board by title substring, column, tag name, or assignee username. ' +
        'Returns compact matches with the column name. Use get_card for full details.',
      inputSchema: {
        workplaceId: workplaceIdSchema,
        query: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Case-insensitive substring of the card title.'),
        columnName: columnNameSchemaOptional,
        columnId: columnIdSchema,
        tag: z.string().trim().min(1).optional().describe('Tag name, case-insensitive.'),
        assignee: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe('Assignee username, case-insensitive.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const workplaceId = await resolveWorkplaceId(client, args.workplaceId);
      const board = await client.getBoard(workplaceId);
      const query = args.query?.trim().toLowerCase();
      const tag = args.tag?.trim().toLowerCase();
      const assignee = args.assignee?.trim().toLowerCase();
      const column =
        args.columnId || args.columnName
          ? resolveColumn(board, { columnId: args.columnId, columnName: args.columnName })
          : undefined;

      const columnNames = new Map(board.columns.map((entry) => [entry.id, entry.name]));
      const columnOrder = new Map(board.columns.map((entry) => [entry.id, entry.position]));

      const cards = board.cards
        .filter((card) => {
          if (query && !card.title.toLowerCase().includes(query)) return false;
          if (column && card.columnId !== column.id) return false;
          if (tag && !card.tags.some((entry) => entry.name.toLowerCase() === tag)) return false;
          if (
            assignee &&
            !card.assignees.some((entry) => entry.username.toLowerCase() === assignee)
          ) {
            return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            (columnOrder.get(a.columnId) ?? 0) - (columnOrder.get(b.columnId) ?? 0) ||
            a.position - b.position,
        )
        .map((card) => ({
          ...compactCard(card),
          column: columnNames.get(card.columnId) ?? 'unknown',
        }));

      return json({ workplaceId, count: cards.length, cards });
    },
  );

  server.registerTool(
    'create_column',
    {
      title: 'Create column',
      description: 'Add a column at the end of the board. Only the workplace owner can do this.',
      inputSchema: {
        name: columnNameSchema.describe('Column name, up to 40 characters.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { openWorldHint: false },
    },
    async ({ name, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.createColumn(resolved, name));
    },
  );

  server.registerTool(
    'update_column',
    {
      title: 'Update column',
      description:
        'Rename a column or hide/show it. Hiding keeps its cards but removes the column ' +
        'from the board view. Only the workplace owner can do this.',
      inputSchema: {
        columnId: z.string().uuid().describe('Column UUID.'),
        name: columnNameSchema.optional().describe('New name.'),
        isHidden: z.boolean().optional().describe('true hides the column, false shows it.'),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ columnId, name, isHidden }) => {
      if (name === undefined && isHidden === undefined) {
        throw new Error('Pass name, isHidden, or both.');
      }
      return json(await client.updateColumn(columnId, { name, isHidden }));
    },
  );

  server.registerTool(
    'delete_column',
    {
      title: 'Delete column',
      description:
        'Delete a column. Its cards are moved, in order, to the first visible remaining ' +
        'column. Only the workplace owner can do this. The last column cannot be deleted.',
      inputSchema: { columnId: z.string().uuid().describe('Column UUID.') },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ columnId }) => {
      await client.deleteColumn(columnId);
      return json({ ok: true, deletedColumnId: columnId });
    },
  );

  server.registerTool(
    'reorder_columns',
    {
      title: 'Reorder columns',
      description:
        'Set the left-to-right column order. orderedIds must contain every column on the ' +
        'board exactly once. Only the workplace owner can do this.',
      inputSchema: {
        orderedIds: z
          .array(z.string().uuid())
          .min(1)
          .max(100)
          .describe('Every column UUID, in the desired order.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ orderedIds, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      await client.reorderColumns(resolved, orderedIds);
      const board = await client.getBoard(resolved);
      return json({
        ok: true,
        columns: board.columns.map((column) => ({ id: column.id, name: column.name })),
      });
    },
  );
}
