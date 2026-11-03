import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { emailSchema, LIMITS, passwordSchema, usernameSchema } from '@kanban/shared';
import { z } from 'zod';
import type { KanbanApiClient } from '../client.js';
import { json } from './shared.js';

export function registerAuthTools(
  server: McpServer,
  client: KanbanApiClient,
  includeActions = true,
): void {
  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'Return the signed-in Kanban user and every workplace they belong to (id, name, role). ' +
        'Call this first to discover workplaceId values.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(await client.whoami()),
  );

  if (includeActions) {
    server.registerTool(
      'login',
      {
        title: 'Sign in',
        description:
          'Sign in to Kanban with a username or email and password. The resulting session is cached ' +
          'in ~/.kanban-mcp/session.json for future runs. Only needed when KANBAN_USERNAME/' +
          'KANBAN_PASSWORD are not configured and no cached session exists.',
        inputSchema: {
          identifier: z
            .string()
            .trim()
            .min(1, 'Enter your username or email.')
            .max(254)
            .describe('Username or email address.'),
          password: z
            .string()
            .min(1, 'Enter your password.')
            .max(LIMITS.passwordMax)
            .describe('Account password.'),
        },
        annotations: { openWorldHint: false },
      },
      async ({ identifier, password }) => json(await client.login(identifier, password)),
    );

    server.registerTool(
      'register_account',
      {
        title: 'Create account',
        description:
          'Create a new Kanban account. This also creates a default workplace with the columns ' +
          'To Do, Revision, On Progress, and Done. Only use when the user explicitly asks to sign up.',
        inputSchema: {
          username: usernameSchema.describe(
            'Lowercase letters, numbers, underscores; 3-24 characters; not a reserved name.',
          ),
          email: emailSchema.describe('Unique email address.'),
          password: passwordSchema.describe(
            '8-200 characters with uppercase and lowercase letters, a number, and a symbol. ' +
              'Must not be a common password or contain the username/email.',
          ),
        },
        annotations: { openWorldHint: false },
      },
      async (input) => json(await client.registerAccount(input)),
    );

    server.registerTool(
      'logout',
      {
        title: 'Sign out',
        description: 'Discard the cached Kanban session. Board data is not changed.',
        inputSchema: {},
        annotations: { openWorldHint: false },
      },
      async () => {
        await client.logout();
        return json({ ok: true });
      },
    );
  }
}
