import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TAG_COLORS, TAG_COLOR_SCHEMA, tagNameSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json, resolveWorkplaceId } from './shared.js';

const workplaceIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Workplace UUID. Omit when you belong to exactly one workplace.');

export function registerTagTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description: 'List the tags available in a workplace, with IDs and hex colors.',
      inputSchema: { workplaceId: workplaceIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.listTags(resolved));
    },
  );

  server.registerTool(
    'create_tag',
    {
      title: 'Create tag',
      description:
        `Create a workplace tag. Colors are limited to the app palette: ${TAG_COLORS.join(', ')}. ` +
        'When color is omitted, the next palette color is used.',
      inputSchema: {
        name: tagNameSchema.describe('Tag name, up to 24 characters, unique per workplace.'),
        color: TAG_COLOR_SCHEMA.optional().describe('Palette hex color; omit for automatic.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { openWorldHint: false },
    },
    async ({ name, color, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      const existing = await client.listTags(resolved);
      const chosen = color ?? TAG_COLORS[existing.length % TAG_COLORS.length];

      return json(await client.createTag(resolved, { name, color: chosen }));
    },
  );

  server.registerTool(
    'update_tag',
    {
      title: 'Update tag',
      description:
        'Rename a tag or change its color. Only the workplace owner can do this. ' +
        `Colors: ${TAG_COLORS.join(', ')}.`,
      inputSchema: {
        tagId: z.string().uuid().describe('Tag UUID.'),
        name: tagNameSchema.optional().describe('New tag name.'),
        color: TAG_COLOR_SCHEMA.optional().describe('New palette hex color.'),
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ tagId, name, color }) => {
      if (name === undefined && color === undefined) {
        throw new Error('Pass name, color, or both.');
      }
      return json(await client.updateTag(tagId, { name, color }));
    },
  );

  server.registerTool(
    'delete_tag',
    {
      title: 'Delete tag',
      description:
        'Delete a tag from the workplace and from every card that has it. Only the ' +
        'workplace owner can do this.',
      inputSchema: { tagId: z.string().uuid().describe('Tag UUID.') },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ tagId }) => {
      await client.deleteTag(tagId);
      return json({ ok: true, deletedTagId: tagId });
    },
  );
}
