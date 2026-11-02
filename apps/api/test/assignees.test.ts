import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMember,
  columnByName,
  createCard,
  getBoard,
  registerUser,
  resetDb,
} from './helpers';

beforeEach(resetDb);

describe('card assignees', () => {
  it('starts unassigned and lets any member assign workplace members', async () => {
    const owner = await registerUser('assignowner');
    const member = await registerUser('assignmember');
    const outsider = await registerUser('assignoutsider');
    await addMember(owner, member);

    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Assigned task');

    expect(card.assignees).toEqual([]);

    const assigned = await member.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [member.user.id, owner.user.id] });

    expect(assigned.status).toBe(200);
    expect(assigned.body.map((assignee: { username: string }) => assignee.username)).toEqual([
      member.username,
      owner.username,
    ]);

    const detail = await member.agent.get(`/api/cards/${card.id}`);
    expect(detail.body.assignees).toHaveLength(2);

    const reloaded = (await getBoard(owner.agent, owner.workplaceId)).body;
    const summary = reloaded.cards.find((entry) => entry.id === card.id);
    expect(summary?.assignees.map((assignee) => assignee.username)).toEqual([
      member.username,
      owner.username,
    ]);

    const outsiderAttempt = await member.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [outsider.user.id] });
    expect(outsiderAttempt.status).toBe(400);
    expect(outsiderAttempt.body.error.code).toBe('INVALID_ASSIGNEE');

    const cleared = await member.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual([]);

    const afterClear = await member.agent.get(`/api/cards/${card.id}`);
    expect(afterClear.body.assignees).toEqual([]);
  });

  it('removes a member’s assignments when they leave the workplace', async () => {
    const owner = await registerUser('unassignowner');
    const member = await registerUser('unassignmember');
    await addMember(owner, member);

    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Handoff');

    await owner.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [member.user.id] });

    const removed = await owner.agent.delete(
      `/api/workplaces/${owner.workplaceId}/members/${member.user.id}`,
    );
    expect(removed.status).toBe(204);

    const detail = await owner.agent.get(`/api/cards/${card.id}`);
    expect(detail.body.assignees).toEqual([]);
  });

  it('does not allow assigning through a card from another workplace', async () => {
    const owner = await registerUser('isolateowner');
    const outsider = await registerUser('isolateoutsider');

    const board = (await getBoard(owner.agent, owner.workplaceId)).body;
    const todo = columnByName(board, 'To Do');
    const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Private card');

    const response = await outsider.agent
      .put(`/api/cards/${card.id}/assignees`)
      .send({ userIds: [outsider.user.id] });

    expect(response.status).toBe(404);
  });
});
