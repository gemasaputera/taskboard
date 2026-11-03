import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BoardColumnDto, BoardDto, CardSummaryDto, MemberDto } from '@kanban/shared';
import type { KanbanApiClient } from '../client.js';

/** Every tool returns one pretty-printed JSON document; models read that best. */
export function json(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(value, null, 2) ?? 'null',
      },
    ],
  };
}

export function compactCard(card: CardSummaryDto) {
  return {
    id: card.id,
    title: card.title,
    columnId: card.columnId,
    position: card.position,
    tags: card.tags.map((tag) => tag.name),
    assignees: card.assignees.map((assignee) => assignee.username),
    subtasks: `${card.doneSubtaskCount}/${card.subtaskCount}`,
    comments: card.commentCount,
  };
}

export function compactBoard(board: BoardDto) {
  const byColumn = new Map<string, CardSummaryDto[]>();

  for (const card of board.cards) {
    const list = byColumn.get(card.columnId);
    if (list) list.push(card);
    else byColumn.set(card.columnId, [card]);
  }

  return {
    workplace: board.workplace,
    role: board.role,
    tags: board.tags,
    columns: board.columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
      isHidden: column.isHidden,
      cards: (byColumn.get(column.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map(compactCard),
    })),
  };
}

function describeWorkplaces(workplaces: { id: string; name: string }[]): string {
  return workplaces.map((workplace) => `${workplace.name} (${workplace.id})`).join(', ');
}

/**
 * Most people have exactly one workplace, so `workplaceId` is optional everywhere.
 * With several, the error lists the choices instead of guessing.
 */
export async function resolveWorkplaceId(
  client: KanbanApiClient,
  workplaceId?: string,
): Promise<string> {
  if (workplaceId) return workplaceId;
  if (client.defaultWorkplaceId) return client.defaultWorkplaceId;

  const workplaces = await client.listWorkplaces();

  if (workplaces.length === 1) return workplaces[0].id;

  if (workplaces.length === 0) {
    throw new Error('You are not a member of any workplace yet. Create one with create_workplace.');
  }

  throw new Error(
    `workplaceId is required because you belong to ${workplaces.length} workplaces: ` +
      `${describeWorkplaces(workplaces)}.`,
  );
}

function columnChoices(columns: BoardColumnDto[]): string {
  return columns.map((column) => `${column.name} (${column.id})`).join(', ');
}

export function resolveColumn(
  board: BoardDto,
  where: { columnId?: string; columnName?: string },
): BoardColumnDto {
  if (where.columnId) {
    const column = board.columns.find((candidate) => candidate.id === where.columnId);
    if (column) return column;
    throw new Error(
      `Column ${where.columnId} is not on this board. Columns: ${columnChoices(board.columns)}.`,
    );
  }

  if (where.columnName) {
    const needle = where.columnName.trim().toLowerCase();
    const matches = board.columns.filter((column) => column.name.toLowerCase() === needle);

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        `More than one column is named "${where.columnName}". Pass columnId instead: ` +
          `${matches.map((column) => column.id).join(', ')}.`,
      );
    }

    throw new Error(
      `No column named "${where.columnName}". Columns: ${columnChoices(board.columns)}.`,
    );
  }

  throw new Error('Pass either columnId or columnName.');
}

/** Falls back to the first visible column, which is where new work usually starts. */
export function defaultColumn(board: BoardDto): BoardColumnDto {
  const visible = board.columns.filter((column) => !column.isHidden);
  const column = visible[0] ?? board.columns[0];

  if (!column) {
    throw new Error('This board has no columns. Create one with create_column.');
  }

  return column;
}

export async function resolveTagIds(
  client: KanbanApiClient,
  workplaceId: string,
  where: { tagIds?: string[]; tagNames?: string[] },
): Promise<string[]> {
  const ids = new Set(where.tagIds ?? []);

  if (where.tagNames && where.tagNames.length > 0) {
    const tags = await client.listTags(workplaceId);
    const available = tags.map((tag) => tag.name).join(', ') || '(none yet)';

    for (const rawName of where.tagNames) {
      const name = rawName.trim().toLowerCase();
      const match = tags.find((tag) => tag.name.toLowerCase() === name);

      if (!match) {
        throw new Error(
          `No tag named "${rawName}" in this workplace. Available tags: ${available}. ` +
            'Create it with create_tag, or pass tagIds.',
        );
      }

      ids.add(match.id);
    }
  }

  return [...ids];
}

function describeMembers(members: MemberDto[]): string {
  return members.map((member) => member.username).join(', ') || '(none)';
}

export async function resolveMemberUserIds(
  client: KanbanApiClient,
  workplaceId: string,
  where: { userIds?: string[]; usernames?: string[] },
): Promise<string[]> {
  const ids = new Set(where.userIds ?? []);

  if (where.usernames && where.usernames.length > 0) {
    const members = await client.listMembers(workplaceId);

    for (const rawName of where.usernames) {
      const name = rawName.trim().toLowerCase();
      const match = members.find((member) => member.username.toLowerCase() === name);

      if (!match) {
        throw new Error(
          `"${rawName}" is not a member of this workplace. Members: ${describeMembers(members)}.`,
        );
      }

      ids.add(match.userId);
    }
  }

  return [...ids];
}
