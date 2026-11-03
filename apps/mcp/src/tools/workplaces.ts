import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { workplaceNameSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json, resolveWorkplaceId } from './shared.js';

const workplaceIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Workplace UUID. Omit when you belong to exactly one workplace.');

export function registerWorkplaceTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'list_workplaces',
    {
      title: 'List workplaces',
      description:
        'List every workplace the signed-in user belongs to, with its role. ' +
        'Board tools accept the workplaceId returned here.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(await client.listWorkplaces()),
  );

  server.registerTool(
    'create_workplace',
    {
      title: 'Create workplace',
      description:
        'Create a workplace owned by the signed-in user. It starts with the columns ' +
        'To Do, Revision, On Progress, and Done.',
      inputSchema: {
        name: workplaceNameSchema.describe('Display name, up to 60 characters.'),
      },
      annotations: { openWorldHint: false },
    },
    async ({ name }) => json(await client.createWorkplace(name)),
  );

  server.registerTool(
    'rename_workplace',
    {
      title: 'Rename workplace',
      description: 'Rename a workplace. Only the owner can do this.',
      inputSchema: {
        name: workplaceNameSchema.describe('New display name.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ name, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.renameWorkplace(resolved, name));
    },
  );

  server.registerTool(
    'list_members',
    {
      title: 'List members',
      description:
        'List workplace members with their user IDs, usernames, roles, and join dates. ' +
        'Email addresses are only included for the owner.',
      inputSchema: { workplaceId: workplaceIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.listMembers(resolved));
    },
  );

  server.registerTool(
    'remove_member',
    {
      title: 'Remove member',
      description:
        'Remove a member from a workplace. The owner cannot be removed, and their card ' +
        'assignments in that workplace are cleared. Only the owner can do this.',
      inputSchema: {
        username: z.string().trim().min(1).describe('Username of the member to remove.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ username, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      const members = await client.listMembers(resolved);
      const member = members.find(
        (candidate) => candidate.username.toLowerCase() === username.trim().toLowerCase(),
      );

      if (!member) {
        throw new Error(
          `"${username}" is not a member of this workplace. Members: ` +
            `${members.map((candidate) => candidate.username).join(', ') || '(none)'}.`,
        );
      }

      await client.removeMember(resolved, member.userId);
      return json({ ok: true, removed: member.username, workplaceId: resolved });
    },
  );

  server.registerTool(
    'leave_workplace',
    {
      title: 'Leave workplace',
      description:
        'Leave a workplace as a member. The owner cannot leave their own workplace. ' +
        'This removes your membership and card assignments in that workplace.',
      inputSchema: { workplaceId: workplaceIdSchema },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      await client.leaveWorkplace(resolved);
      return json({ ok: true, left: resolved });
    },
  );
}
