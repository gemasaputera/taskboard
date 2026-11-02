import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMember,
  cardInColumn,
  columnByName,
  createCard,
  getBoard,
  registerUser,
  resetDb,
} from './helpers';

beforeEach(resetDb);

describe('columns', () => {
  it('lets the owner rename, hide, reorder, create, and delete columns', async () => {
    const owner = await registerUser('owner');
    let board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');

    const renamed = await owner.agent
      .patch(`/api/columns/${todo.id}`)
      .send({ name: 'Backlog' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Backlog');

    const hidden = await owner.agent
      .patch(`/api/columns/${todo.id}`)
      .send({ isHidden: true });
    expect(hidden.status).toBe(200);
    expect(hidden.body.isHidden).toBe(true);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(columnByName(board, 'Backlog').isHidden).toBe(true);

    const reordered = await owner.agent
      .put(`/api/workplaces/${owner.workplaceId}/columns/order`)
      .send({ orderedIds: [...board.columns].reverse().map((column) => column.id) });
    expect(reordered.status).toBe(204);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(board.columns.map((column) => column.position)).toEqual([0, 1, 2, 3]);

    const created = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/columns`)
      .send({ name: 'Blocked' });
    expect(created.status).toBe(201);
    expect(created.body.position).toBe(4);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const blocked = columnByName(board, 'Blocked');
    await createCard(owner.agent, owner.workplaceId, blocked.id, 'Waiting on legal');

    const deleted = await owner.agent.delete(`/api/columns/${blocked.id}`);
    expect(deleted.status).toBe(204);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(board.columns.map((column) => column.name)).not.toContain('Blocked');
    expect(
      board.cards.some(
        (card) =>
          card.title === 'Waiting on legal' && card.columnId === board.columns[0]!.id,
      ),
    ).toBe(true);
  });

  it('rejects an invalid reorder and deleting the last column', async () => {
    const owner = await registerUser('last');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;

    const badOrder = await owner.agent
      .put(`/api/workplaces/${owner.workplaceId}/columns/order`)
      .send({ orderedIds: [board.columns[0]!.id] });
    expect(badOrder.status).toBe(400);

    for (const column of board.columns.slice(0, -1)) {
      const response = await owner.agent.delete(`/api/columns/${column.id}`);
      expect(response.status).toBe(204);
    }

    const lastColumn = (await getBoard(owner.agent, owner.workplaceId)).body.columns[0]!;
    const last = await owner.agent.delete(`/api/columns/${lastColumn.id}`);
    expect(last.status).toBe(400);
    expect(last.body.error.code).toBe('LAST_COLUMN');
  });

  it('blocks members from managing columns while allowing card work', async () => {
    const owner = await registerUser('boss');
    const member = await registerUser('mate');
    await addMember(owner, member);

    const board = (await getBoard(member.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');

    const rename = await member.agent
      .patch(`/api/columns/${todo.id}`)
      .send({ name: 'Mine now' });
    expect(rename.status).toBe(403);

    const invite = await member.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: 'someone' });
    expect(invite.status).toBe(403);

    const card = await createCard(member.agent, owner.workplaceId, todo.id, 'Member card');
    expect(card.title).toBe('Member card');

    const moved = await member.agent
      .patch(`/api/cards/${card.id}/move`)
      .send({ columnId: columnByName(board, 'Done').id, position: 0 });
    expect(moved.status).toBe(200);
  });
});

describe('card ordering and isolation', () => {
  it('moves cards across columns with contiguous positions', async () => {
    const owner = await registerUser('mover');
    let board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const revision = columnByName(board, 'Revision');

    const first = await createCard(owner.agent, owner.workplaceId, todo.id, 'First');
    const second = await createCard(owner.agent, owner.workplaceId, todo.id, 'Second');

    let moved = await owner.agent
      .patch(`/api/cards/${first.id}/move`)
      .send({ columnId: revision.id, position: 0 });
    expect(moved.status).toBe(200);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(cardInColumn(board, revision.id).map((card) => card.title)).toEqual(['First']);
    expect(cardInColumn(board, todo.id).map((card) => card.title)).toEqual(['Second']);
    expect(cardInColumn(board, todo.id)[0]?.position).toBe(0);

    moved = await owner.agent
      .patch(`/api/cards/${second.id}/move`)
      .send({ columnId: revision.id, position: 0 });
    expect(moved.status).toBe(200);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(cardInColumn(board, revision.id).map((card) => card.title)).toEqual([
      'Second',
      'First',
    ]);
    expect(cardInColumn(board, revision.id).map((card) => card.position)).toEqual([0, 1]);

    const clamped = await owner.agent
      .patch(`/api/cards/${second.id}/move`)
      .send({ columnId: revision.id, position: 99 });
    expect(clamped.status).toBe(200);

    board = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(cardInColumn(board, revision.id).map((card) => card.title)).toEqual([
      'First',
      'Second',
    ]);
  });

  it('rejects empty titles and foreign columns', async () => {
    const owner = await registerUser('valid');
    const other = await registerUser('other');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const otherBoard = (await getBoard(other.agent, other.workplaceId)).body;

    const blank = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/cards`)
      .send({ columnId: todo.id, title: '   ' });
    expect(blank.status).toBe(400);

    const foreignColumn = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/cards`)
      .send({ columnId: otherBoard.columns[0]!.id, title: 'Sneaky' });
    expect(foreignColumn.status).toBe(400);

    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Private');

    const read = await other.agent.get(`/api/cards/${card.id}`);
    expect(read.status).toBe(404);

    const move = await other.agent
      .patch(`/api/cards/${card.id}/move`)
      .send({ columnId: otherBoard.columns[1]!.id, position: 0 });
    expect(move.status).toBe(404);

    const boardRead = await other.agent.get(`/api/workplaces/${owner.workplaceId}/board`);
    expect(boardRead.status).toBe(404);

    const crossWorkplaceColumn = await owner.agent
      .patch(`/api/cards/${card.id}/move`)
      .send({ columnId: otherBoard.columns[0]!.id, position: 0 });
    expect(crossWorkplaceColumn.status).toBe(400);
  });

  it('keeps card position stable after reload', async () => {
    const owner = await registerUser('reload');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const done = columnByName(board, 'Done');

    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Persist');
    await owner.agent
      .patch(`/api/cards/${card.id}/move`)
      .send({ columnId: done.id, position: 0 });

    const reloaded = (await getBoard(owner.agent, owner.workplaceId)).body;
    expect(cardInColumn(reloaded, done.id).map((entry) => entry.title)).toEqual(['Persist']);
  });
});
