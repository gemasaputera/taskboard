import { TAG_COLORS } from '@kanban/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cardInColumn,
  columnByName,
  createCard,
  getBoard,
  registerUser,
  resetDb,
} from './helpers';

beforeEach(resetDb);

/** Date.now() only has millisecond resolution; make consecutive writes distinguishable. */
async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

async function cardsUpdatedAt(
  agent: Parameters<typeof getBoard>[0],
  workplaceId: string,
): Promise<Map<string, string>> {
  const board = (await getBoard(agent, workplaceId)).body;
  return new Map(board.cards.map((card) => [card.id, card.updatedAt]));
}

describe('card updatedAt', () => {
  it('bumps only the moved card, leaving re-sequenced siblings untouched', async () => {
    const owner = await registerUser('stampmove');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const done = columnByName(board, 'Done');

    const first = await createCard(owner.agent, owner.workplaceId, todo.id, 'First');
    const second = await createCard(owner.agent, owner.workplaceId, todo.id, 'Second');
    const untouched = await createCard(owner.agent, owner.workplaceId, done.id, 'Untouched');

    const before = await cardsUpdatedAt(owner.agent, owner.workplaceId);

    await tick();

    const moved = await owner.agent
      .patch(`/api/cards/${first.id}/move`)
      .send({ columnId: done.id, position: 0 });
    expect(moved.status).toBe(200);

    const after = await cardsUpdatedAt(owner.agent, owner.workplaceId);

    expect(after.get(first.id)).not.toBe(before.get(first.id));
    expect(new Date(after.get(first.id) as string).getTime()).toBeGreaterThan(
      new Date(before.get(first.id) as string).getTime(),
    );

    // second was re-sequenced to position 0 in the source column; untouched lived elsewhere.
    expect(after.get(second.id)).toBe(before.get(second.id));
    expect(after.get(untouched.id)).toBe(before.get(untouched.id));
  });

  it('bumps updatedAt when assignees change', async () => {
    const owner = await registerUser('stampassign');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Assign me');

    await tick();

    const assigned = await owner.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [owner.user.id] });
    expect(assigned.status).toBe(200);

    const detail = await owner.agent.get(`/api/cards/${card.id}`);
    expect(new Date(detail.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(card.updatedAt).getTime(),
    );
  });

  it('bumps updatedAt when tags change', async () => {
    const owner = await registerUser('stamptag');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Tag me');

    const tag = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/tags`)
      .send({ name: 'Stamped', color: TAG_COLORS[0] });
    expect(tag.status).toBe(201);

    await tick();

    const assigned = await owner.agent
      .put(`/api/cards/${card.id}/tags`)
      .send({ tagIds: [tag.body.id as string] });
    expect(assigned.status).toBe(200);

    const detail = await owner.agent.get(`/api/cards/${card.id}`);
    expect(new Date(detail.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(card.updatedAt).getTime(),
    );

    // The board payload must agree with the detail payload.
    const summary = (await getBoard(owner.agent, owner.workplaceId)).body.cards.find(
      (entry) => entry.id === card.id,
    );
    expect(summary?.updatedAt).toBe(detail.body.updatedAt);
  });

  it('keeps the moved card in place after the stamping update', async () => {
    const owner = await registerUser('stampposition');
    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const done = columnByName(board, 'Done');

    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Move me');
    await tick();

    const moved = await owner.agent
      .patch(`/api/cards/${card.id}/move`)
      .send({ columnId: done.id, position: 0 });
    expect(moved.status).toBe(200);

    const reloaded = (await getBoard(owner.agent, owner.workplaceId)).body;
    const inDone = cardInColumn(reloaded, done.id);
    expect(inDone.map((entry) => entry.id)).toEqual([card.id]);
    expect(inDone[0]?.position).toBe(0);
    expect(cardInColumn(reloaded, todo.id)).toEqual([]);
  });
});
