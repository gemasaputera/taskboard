import { TAG_COLORS } from '@kanban/shared';
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

async function setup() {
  const owner = await registerUser('owner');
  const member = await registerUser('member');
  await addMember(owner, member);

  const board = (await getBoard(owner.agent, owner.workplaceId)).body;
  const todo = columnByName(board, 'To Do');
  const card = await createCard(owner.agent, owner.workplaceId, todo.id, 'Ship it');

  return { owner, member, board, card };
}

describe('tags', () => {
  it('lets members create tags but only the owner edits or deletes them', async () => {
    const { owner, member, card } = await setup();

    const created = await member.agent
      .post(`/api/workplaces/${owner.workplaceId}/tags`)
      .send({ name: 'Urgent', color: TAG_COLORS[0] });
    expect(created.status).toBe(201);

    const tagId = created.body.id as string;

    const duplicate = await member.agent
      .post(`/api/workplaces/${owner.workplaceId}/tags`)
      .send({ name: 'urgent', color: TAG_COLORS[1] });
    expect(duplicate.status).toBe(409);

    const assigned = await member.agent
      .put(`/api/cards/${card.id}/tags`)
      .send({ tagIds: [tagId] });
    expect(assigned.status).toBe(200);
    expect(assigned.body).toHaveLength(1);

    const cardDetail = await member.agent.get(`/api/cards/${card.id}`);
    expect(cardDetail.body.tags.map((tag: { name: string }) => tag.name)).toEqual(['Urgent']);

    const memberRename = await member.agent
      .patch(`/api/tags/${tagId}`)
      .send({ name: 'Critical' });
    expect(memberRename.status).toBe(403);

    const ownerRename = await owner.agent
      .patch(`/api/tags/${tagId}`)
      .send({ name: 'Critical' });
    expect(ownerRename.status).toBe(200);

    const memberDelete = await member.agent.delete(`/api/tags/${tagId}`);
    expect(memberDelete.status).toBe(403);

    const ownerDelete = await owner.agent.delete(`/api/tags/${tagId}`);
    expect(ownerDelete.status).toBe(204);

    const afterDelete = await member.agent.get(`/api/cards/${card.id}`);
    expect(afterDelete.body.tags).toHaveLength(0);
  });

  it('rejects tags from another workplace', async () => {
    const { owner, card } = await setup();
    const other = await registerUser('tagother');

    const otherTag = await other.agent
      .post(`/api/workplaces/${other.workplaceId}/tags`)
      .send({ name: 'Theirs', color: TAG_COLORS[2] });
    expect(otherTag.status).toBe(201);

    const assigned = await owner.agent
      .put(`/api/cards/${card.id}/tags`)
      .send({ tagIds: [otherTag.body.id as string] });
    expect(assigned.status).toBe(400);
  });
});

describe('subtasks', () => {
  it('creates, toggles, and deletes checklist items', async () => {
    const { member, card } = await setup();

    const created = await member.agent
      .post(`/api/cards/${card.id}/subtasks`)
      .send({ title: 'Write the spec' });
    expect(created.status).toBe(201);
    expect(created.body.position).toBe(0);

    const second = await member.agent
      .post(`/api/cards/${card.id}/subtasks`)
      .send({ title: 'Review it' });
    expect(second.body.position).toBe(1);

    const toggled = await member.agent
      .patch(`/api/subtasks/${created.body.id as string}`)
      .send({ isDone: true });
    expect(toggled.status).toBe(200);
    expect(toggled.body.isDone).toBe(true);

    const detail = await member.agent.get(`/api/cards/${card.id}`);
    expect(detail.body.subtasks).toHaveLength(2);
    expect(detail.body.doneSubtaskCount).toBe(1);

    const removed = await member.agent.delete(`/api/subtasks/${second.body.id as string}`);
    expect(removed.status).toBe(204);

    const after = await member.agent.get(`/api/cards/${card.id}`);
    expect(after.body.subtasks).toHaveLength(1);
  });

  it('does not allow access through another workplace', async () => {
    const { card } = await setup();
    const outsider = await registerUser('subother');

    const response = await outsider.agent
      .post(`/api/cards/${card.id}/subtasks`)
      .send({ title: 'Nope' });
    expect(response.status).toBe(404);
  });
});

describe('comments', () => {
  it('supports threads with author and owner permissions', async () => {
    const { owner, member, card } = await setup();

    const ownerComment = await owner.agent
      .post(`/api/cards/${card.id}/comments`)
      .send({ body: 'Owner note' });
    expect(ownerComment.status).toBe(201);

    const memberComment = await member.agent
      .post(`/api/cards/${card.id}/comments`)
      .send({ body: 'Member note' });
    expect(memberComment.status).toBe(201);

    const memberEditOwn = await member.agent
      .patch(`/api/comments/${memberComment.body.id as string}`)
      .send({ body: 'Member note edited' });
    expect(memberEditOwn.status).toBe(200);

    const memberEditOwner = await member.agent
      .patch(`/api/comments/${ownerComment.body.id as string}`)
      .send({ body: 'Hijacked' });
    expect(memberEditOwner.status).toBe(403);

    const ownerDeleteMember = await owner.agent.delete(
      `/api/comments/${memberComment.body.id as string}`,
    );
    expect(ownerDeleteMember.status).toBe(204);

    const memberDeleteOwner = await member.agent.delete(
      `/api/comments/${ownerComment.body.id as string}`,
    );
    expect(memberDeleteOwner.status).toBe(403);

    const detail = await member.agent.get(`/api/cards/${card.id}`);
    expect(detail.body.comments).toHaveLength(1);
    expect(detail.body.comments[0].body).toBe('Owner note');
  });

  it('rejects empty comments', async () => {
    const { member, card } = await setup();
    const response = await member.agent
      .post(`/api/cards/${card.id}/comments`)
      .send({ body: '   ' });
    expect(response.status).toBe(400);
  });
});
