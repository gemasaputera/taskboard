import { TAG_COLORS } from '@kanban/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createHarness,
  resetDb,
  signUp,
  startTestApi,
  stopTestApi,
  type TestApi,
  type ToolHarness,
} from './helpers';

let api: TestApi;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await stopTestApi(api);
});

let harnesses: ToolHarness[] = [];

async function harness(overrides: Parameters<typeof createHarness>[1] = {}) {
  const created = await createHarness(api.url, overrides);
  harnesses.push(created);
  return created;
}

async function signedUp(username = 'ada') {
  const created = await signUp(api.url, username);
  harnesses.push(created);
  return created;
}

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  await Promise.all(harnesses.map((created) => created.close()));
  harnesses = [];
});

describe('tool registration', () => {
  it('exposes the whole board surface', async () => {
    const ada = await harness();
    const names = await ada.toolNames();

    expect(names).toContain('whoami');
    expect(names).toContain('login');
    expect(names).toContain('get_board');
    expect(names).toContain('create_card');
    expect(names).toContain('move_card');
    expect(names).toContain('set_card_tags');
    expect(names).toContain('add_subtask');
    expect(names).toContain('invite_member');
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('accounts and workplaces', () => {
  it('registers, reports the user, and lists the default workplace', async () => {
    const ada = await harness();

    const me = await ada.call('register_account', {
      username: 'ada',
      email: 'ada@example.com',
      password: 'Kanban!Passw0rd',
    });

    expect(me.user).toMatchObject({ username: 'ada', email: 'ada@example.com' });
    expect(me.workplaces).toHaveLength(1);
    expect(me.workplaces[0].name).toBe("ada's Workplace");
    expect(me.workplaces[0].role).toBe('OWNER');

    const who = await ada.call('whoami');
    expect(who.user.id).toBe(me.user.id);

    const workplaces = await ada.call('list_workplaces');
    expect(workplaces).toEqual(me.workplaces);
  });

  it('reads an empty board with the default columns', async () => {
    const ada = await signedUp();
    const board = await ada.call('get_board');

    expect(board.workplace.name).toBe("ada's Workplace");
    expect(board.role).toBe('OWNER');
    expect(board.columns.map((column: { name: string }) => column.name)).toEqual([
      'To Do',
      'Revision',
      'On Progress',
      'Done',
    ]);
    expect(board.tags).toEqual([]);
    expect(board.columns.every((column: { cards: unknown[] }) => column.cards.length === 0)).toBe(
      true,
    );
  });

  it('requires workplaceId when the user belongs to several workplaces', async () => {
    const ada = await signedUp();
    await ada.call('create_workplace', { name: 'Second' });

    const ambiguous = await ada.raw('get_board');
    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.text).toContain('workplaceId is required');

    const workplaces = await ada.call('list_workplaces');
    expect(workplaces).toHaveLength(2);

    const first = await ada.call('get_board', { workplaceId: workplaces[0].id });
    expect(first.workplace.name).toBe("ada's Workplace");
  });

  it('signs out and refuses authenticated calls afterwards', async () => {
    const ada = await signedUp();
    await ada.call('logout');

    const result = await ada.raw('whoami');
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Not signed in');
  });

  it('recovers from a stale injected session token using configured credentials', async () => {
    await signedUp();

    const ada = await harness({
      username: 'ada',
      password: 'Kanban!Passw0rd',
      sessionToken: 'stale-cookie-value',
    });

    const workplaces = await ada.call('list_workplaces');
    expect(workplaces).toHaveLength(1);
    expect(workplaces[0].name).toBe("ada's Workplace");
  });
});

describe('cards', () => {
  it('creates a card by column name and reads it back in full', async () => {
    const ada = await signedUp();

    const created = await ada.call('create_card', {
      title: 'Ship the MCP server',
      description: '**AI** access, no browser needed.',
      columnName: 'To Do',
    });

    expect(created.title).toBe('Ship the MCP server');
    expect(created.workplaceId).toBeTruthy();
    expect(created.columnId).toBeTruthy();

    const board = await ada.call('get_board');
    const todo = board.columns.find((column: { name: string }) => column.name === 'To Do');
    expect(todo.cards.map((card: { id: string }) => card.id)).toEqual([created.id]);
    expect(todo.cards[0].tags).toEqual([]);

    const detail = await ada.call('get_card', { cardId: created.id });
    expect(detail.description).toBe('**AI** access, no browser needed.');
    expect(detail.subtasks).toEqual([]);
    expect(detail.comments).toEqual([]);
  });

  it('changes title and description, including clearing the description', async () => {
    const ada = await signedUp();
    const card = await ada.call('create_card', {
      title: 'Draft',
      description: 'Let me explain',
      columnName: 'Revision',
    });

    const updated = await ada.call('update_card', {
      cardId: card.id,
      title: 'Final',
      description: null,
    });

    expect(updated.title).toBe('Final');
    expect(updated.description).toBeNull();
  });

  it('moves a card between columns and finds it by title', async () => {
    const ada = await signedUp();
    const first = await ada.call('create_card', {
      title: 'Fix the drag handle',
      columnName: 'To Do',
    });
    await ada.call('create_card', { title: 'Write the docs', columnName: 'To Do' });

    const moved = await ada.call('move_card', {
      cardId: first.id,
      columnName: 'Done',
    });

    expect(moved).toMatchObject({ cardId: first.id, position: 0 });
    expect(moved.column).toBe('Done');

    const board = await ada.call('get_board');
    const done = board.columns.find((column: { name: string }) => column.name === 'Done');
    expect(done.cards.map((card: { id: string }) => card.id)).toEqual([first.id]);

    const found = await ada.call('find_cards', { query: 'drag' });
    expect(found.count).toBe(1);
    expect(found.cards[0]).toMatchObject({ id: first.id, column: 'Done' });
    expect(found.cards[0].tags).toEqual([]);
  });

  it('deletes a card and reports not found afterwards', async () => {
    const ada = await signedUp();
    const card = await ada.call('create_card', { title: 'Temporary', columnName: 'To Do' });

    await ada.call('delete_card', { cardId: card.id });

    const missing = await ada.raw('get_card', { cardId: card.id });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('Card not found');
  });
});

describe('checklists and comments', () => {
  it('adds, completes, and edits card details', async () => {
    const ada = await signedUp();
    const card = await ada.call('create_card', { title: 'Release', columnName: 'On Progress' });

    const subtask = await ada.call('add_subtask', {
      cardId: card.id,
      title: 'Bump the version',
    });
    const done = await ada.call('update_subtask', { subtaskId: subtask.id, isDone: true });
    expect(done.isDone).toBe(true);

    const comment = await ada.call('add_comment', {
      cardId: card.id,
      body: 'Looks good to me.',
    });
    await ada.call('update_comment', { commentId: comment.id, body: 'Looks great to me.' });

    const detail = await ada.call('get_card', { cardId: card.id });
    expect(detail.subtasks).toHaveLength(1);
    expect(detail.subtasks[0].isDone).toBe(true);
    expect(detail.subtaskCount).toBe(1);
    expect(detail.doneSubtaskCount).toBe(1);
    expect(detail.comments[0].body).toBe('Looks great to me.');

    await ada.call('delete_subtask', { subtaskId: subtask.id });
    await ada.call('delete_comment', { commentId: comment.id });

    const cleared = await ada.call('get_card', { cardId: card.id });
    expect(cleared.subtasks).toEqual([]);
    expect(cleared.comments).toEqual([]);
  });
});

describe('tags and assignees', () => {
  it('resolves tag names and usernames, then clears them', async () => {
    const ada = await signedUp();
    const card = await ada.call('create_card', { title: 'Triage', columnName: 'To Do' });

    const tag = await ada.call('create_tag', { name: 'bug' });
    expect(TAG_COLORS).toContain(tag.color);

    const tagged = await ada.call('set_card_tags', {
      cardId: card.id,
      tagNames: ['BUG'],
    });
    expect(tagged.tags.map((entry: { name: string }) => entry.name)).toEqual(['bug']);

    const assigned = await ada.call('set_card_assignees', {
      cardId: card.id,
      usernames: ['ADA'],
    });
    expect(assigned.assignees.map((entry: { username: string }) => entry.username)).toEqual([
      'ada',
    ]);

    const untagged = await ada.call('set_card_tags', { cardId: card.id, tagNames: [] });
    expect(untagged.tags).toEqual([]);

    const unassigned = await ada.call('set_card_assignees', {
      cardId: card.id,
      usernames: [],
    });
    expect(unassigned.assignees).toEqual([]);

    const unknown = await ada.raw('set_card_tags', {
      cardId: card.id,
      tagNames: ['not-a-tag'],
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('Available tags: bug');
  });
});

describe('columns', () => {
  it('creates, hides, reorders, and deletes a column while keeping its cards', async () => {
    const ada = await signedUp();
    const board = await ada.call('get_board');

    const review = await ada.call('create_column', { name: 'Review' });
    const hidden = await ada.call('update_column', { columnId: review.id, isHidden: true });
    expect(hidden.isHidden).toBe(true);

    const ordered = await ada.call('reorder_columns', {
      orderedIds: [review.id, ...board.columns.map((column: { id: string }) => column.id)],
    });
    expect(ordered.columns[0].id).toBe(review.id);

    const card = await ada.call('create_card', { title: 'Needs review', columnName: 'Review' });
    await ada.call('delete_column', { columnId: review.id });

    const after = await ada.call('get_board');
    expect(after.columns.some((column: { id: string }) => column.id === review.id)).toBe(false);

    const destination = after.columns.find((column: { cards: { id: string }[] }) =>
      column.cards.some((entry) => entry.id === card.id),
    );
    expect(destination.name).toBe('To Do');
  });
});

describe('collaboration', () => {
  it('invites, accepts, lists, and removes a member', async () => {
    const ada = await signedUp('ada');
    const bob = await signedUp('bob');

    const invitation = await ada.call('invite_member', { identifier: 'bob' });
    expect(invitation.inviteeUsername).toBe('bob');

    const pending = await bob.call('list_my_invitations');
    expect(pending).toHaveLength(1);
    expect(pending[0].workplaceName).toBe("ada's Workplace");

    const accepted = await bob.call('accept_invitation', { invitationId: pending[0].id });
    expect(accepted.role).toBe('MEMBER');

    const members = await ada.call('list_members');
    expect(members.map((member: { username: string }) => member.username).sort()).toEqual([
      'ada',
      'bob',
    ]);
    expect(members.find((member: { username: string }) => member.username === 'ada').email).toBe(
      'ada@example.com',
    );

    const asMember = await bob.call('list_members', {
      workplaceId: accepted.workplace.id,
    });
    expect(asMember.every((member: { email?: string }) => member.email === undefined)).toBe(true);

    await ada.call('remove_member', { username: 'bob' });

    const remaining = await bob.call('list_workplaces');
    expect(remaining.map((workplace: { name: string }) => workplace.name)).toEqual([
      "bob's Workplace",
    ]);
  });
});

describe('actionable errors', () => {
  it('suggests available columns when a name is wrong', async () => {
    const ada = await signedUp();

    const result = await ada.raw('create_card', {
      title: 'Nope',
      columnName: 'Missing',
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('No column named "Missing"');
    expect(result.text).toContain('To Do');
  });

  it('explains that an update needs at least one field', async () => {
    const ada = await signedUp();
    const card = await ada.call('create_card', { title: 'Stable', columnName: 'To Do' });

    const result = await ada.raw('update_card', { cardId: card.id });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Pass title, description, or both');
  });

  it('reports an unreachable API clearly', async () => {
    const ada = await harness({
      apiUrl: 'http://127.0.0.1:1',
      username: 'ada',
      password: 'Kanban!Passw0rd',
    });

    const result = await ada.raw('whoami');
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Could not reach the Kanban API');
    expect(result.text).toContain('pnpm dev:api');
  });
});
