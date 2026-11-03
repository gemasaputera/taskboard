import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json, resolveWorkplaceId } from './shared.js';

const workplaceIdSchema = z
  .string()
  .uuid()
  .optional()
  .describe('Workplace UUID. Omit when you belong to exactly one workplace.');

const invitationIdSchema = z.string().uuid().describe('Invitation UUID.');

export function registerInvitationTools(server: McpServer, client: KanbanApiClient): void {
  server.registerTool(
    'list_my_invitations',
    {
      title: 'List my invitations',
      description:
        'List pending invitations addressed to the signed-in user, with the workplace name ' +
        'and inviter. Accept or decline them with the invitation ID.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(await client.listMyInvitations()),
  );

  server.registerTool(
    'list_workplace_invitations',
    {
      title: 'List workplace invitations',
      description: 'List pending invitations sent by a workplace. Only the owner can do this.',
      inputSchema: { workplaceId: workplaceIdSchema },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.listWorkplaceInvitations(resolved));
    },
  );

  server.registerTool(
    'invite_member',
    {
      title: 'Invite member',
      description:
        'Invite an already-registered user to a workplace by exact username or email. ' +
        'Only the owner can do this. The invitee accepts it themselves.',
      inputSchema: {
        identifier: z
          .string()
          .trim()
          .min(1)
          .max(254)
          .describe('Exact username or email of a registered user.'),
        workplaceId: workplaceIdSchema,
      },
      annotations: { openWorldHint: false },
    },
    async ({ identifier, workplaceId }) => {
      const resolved = await resolveWorkplaceId(client, workplaceId);
      return json(await client.inviteMember(resolved, identifier));
    },
  );

  server.registerTool(
    'accept_invitation',
    {
      title: 'Accept invitation',
      description:
        'Accept an invitation addressed to the signed-in user. You join the workplace as a member.',
      inputSchema: { invitationId: invitationIdSchema },
      annotations: { openWorldHint: false },
    },
    async ({ invitationId }) => json(await client.acceptInvitation(invitationId)),
  );

  server.registerTool(
    'decline_invitation',
    {
      title: 'Decline invitation',
      description: 'Decline an invitation addressed to the signed-in user.',
      inputSchema: { invitationId: invitationIdSchema },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ invitationId }) => {
      await client.declineInvitation(invitationId);
      return json({ ok: true, declinedInvitationId: invitationId });
    },
  );

  server.registerTool(
    'cancel_invitation',
    {
      title: 'Cancel invitation',
      description:
        'Cancel a pending invitation before it is answered. Only the workplace owner can do this.',
      inputSchema: { invitationId: invitationIdSchema },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ invitationId }) => {
      await client.cancelInvitation(invitationId);
      return json({ ok: true, cancelledInvitationId: invitationId });
    },
  );
}
