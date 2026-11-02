import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, getBoard, registerUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('invitations', () => {
  it('invites a registered user by username and lets them accept', async () => {
    const owner = await registerUser('owner');
    const invitee = await registerUser('invitee');

    const invited = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.username });
    expect(invited.status).toBe(201);
    expect(invited.body.inviteeUsername).toBe(invitee.username);

    const pending = await invitee.agent.get('/api/invitations');
    expect(pending.status).toBe(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].workplaceName).toContain('Workplace');

    const accepted = await invitee.agent.post(
      `/api/invitations/${invited.body.id as string}/accept`,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe('MEMBER');

    const board = await getBoard(invitee.agent, owner.workplaceId);
    expect(board.status).toBe(200);
    expect(board.body.role).toBe('MEMBER');

    const me = await invitee.agent.get('/api/auth/me');
    expect(
      me.body.workplaces.some((workplace: { id: string }) => workplace.id === owner.workplaceId),
    ).toBe(true);

    const again = await invitee.agent.post(
      `/api/invitations/${invited.body.id as string}/accept`,
    );
    expect(again.status).toBe(409);
  });

  it('invites by email and handles duplicate, self, and unknown users', async () => {
    const owner = await registerUser('owner');
    const invitee = await registerUser('byemail');

    const byEmail = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.user.email });
    expect(byEmail.status).toBe(201);

    const duplicate = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.username });
    expect(duplicate.status).toBe(409);

    const self = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: owner.username });
    expect(self.status).toBe(400);

    const unknown = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: 'nobody_here' });
    expect(unknown.status).toBe(404);

    await invitee.agent.post(`/api/invitations/${byEmail.body.id as string}/accept`);

    const memberAsInviter = await invitee.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: owner.username });
    expect(memberAsInviter.status).toBe(403);
  });

  it('supports decline and re-invites the same user afterwards', async () => {
    const owner = await registerUser('owner');
    const invitee = await registerUser('decliner');

    const first = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.username });
    expect(first.status).toBe(201);

    const declined = await invitee.agent.post(
      `/api/invitations/${first.body.id as string}/decline`,
    );
    expect(declined.status).toBe(204);

    const empty = await invitee.agent.get('/api/invitations');
    expect(empty.body).toHaveLength(0);

    const second = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.username });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const accepted = await invitee.agent.post(
      `/api/invitations/${second.body.id as string}/accept`,
    );
    expect(accepted.status).toBe(200);
  });

  it('lets the owner remove a member and the member leave', async () => {
    const owner = await registerUser('owner');
    const member = await registerUser('leaver');
    await addMember(owner, member);

    expect((await getBoard(member.agent, owner.workplaceId)).status).toBe(200);

    const removed = await owner.agent.delete(
      `/api/workplaces/${owner.workplaceId}/members/${member.user.id}`,
    );
    expect(removed.status).toBe(204);
    expect((await getBoard(member.agent, owner.workplaceId)).status).toBe(404);

    const ownerCannotLeave = await owner.agent.post(
      `/api/workplaces/${owner.workplaceId}/leave`,
    );
    expect(ownerCannotLeave.status).toBe(400);

    const secondMember = await registerUser('leaver2');
    await addMember(owner, secondMember);
    const left = await secondMember.agent.post(`/api/workplaces/${owner.workplaceId}/leave`);
    expect(left.status).toBe(204);
    expect((await getBoard(secondMember.agent, owner.workplaceId)).status).toBe(404);
  });

  it('returns 404 for invitations addressed to someone else', async () => {
    const owner = await registerUser('owner');
    const invitee = await registerUser('target');
    const outsider = await registerUser('outsider');

    const invited = await owner.agent
      .post(`/api/workplaces/${owner.workplaceId}/invitations`)
      .send({ identifier: invitee.username });

    const response = await outsider.agent.post(
      `/api/invitations/${invited.body.id as string}/accept`,
    );
    expect(response.status).toBe(404);
  });
});
