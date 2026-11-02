import {
  REALTIME_EVENTS,
  inviteSchema,
  type InvitationDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { requireOwner } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToUser, emitToWorkplace, joinUserToWorkplace } from '../realtime/io';

export const invitationsRouter = Router();

invitationsRouter.use(requireAuth);

invitationsRouter.get('/invitations', async (req, res) => {
  const user = currentUser(req);

  const invitations = await prisma.invitation.findMany({
    where: { inviteeId: user.id, status: 'PENDING' },
    include: {
      workplace: { select: { id: true, name: true } },
      inviter: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const payload: InvitationDto[] = invitations.map((invitation) => ({
    id: invitation.id,
    workplaceId: invitation.workplaceId,
    workplaceName: invitation.workplace.name,
    inviterUsername: invitation.inviter.username,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
  }));

  res.json(payload);
});

invitationsRouter.get('/workplaces/:workplaceId/invitations', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  await requireOwner(user.id, workplaceId);

  const invitations = await prisma.invitation.findMany({
    where: { workplaceId, status: 'PENDING' },
    include: {
      workplace: { select: { id: true, name: true } },
      inviter: { select: { username: true } },
      invitee: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    invitations.map((invitation) => ({
      id: invitation.id,
      workplaceId: invitation.workplaceId,
      workplaceName: invitation.workplace.name,
      inviterUsername: invitation.inviter.username,
      inviteeUsername: invitation.invitee.username,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
    })),
  );
});

invitationsRouter.post('/workplaces/:workplaceId/invitations', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const { identifier } = parseBody(inviteSchema, req.body);

  await requireOwner(user.id, workplaceId);

  const normalized = identifier.toLowerCase();
  const invitee = await prisma.user.findFirst({
    where: { OR: [{ username: normalized }, { email: normalized }] },
    select: { id: true, username: true },
  });

  if (!invitee) {
    throw new AppError(
      404,
      'USER_NOT_FOUND',
      'No registered user found with that username or email.',
    );
  }

  if (invitee.id === user.id) {
    throw new AppError(400, 'CANNOT_INVITE_SELF', 'You are already in this workplace.');
  }

  const membership = await prisma.membership.findUnique({
    where: { workplaceId_userId: { workplaceId, userId: invitee.id } },
  });

  if (membership) {
    throw new AppError(409, 'ALREADY_MEMBER', 'That user is already a member.');
  }

  const existing = await prisma.invitation.findUnique({
    where: { workplaceId_inviteeId: { workplaceId, inviteeId: invitee.id } },
  });

  if (existing?.status === 'PENDING') {
    throw new AppError(409, 'ALREADY_INVITED', 'That user already has a pending invitation.');
  }

  const invitation = existing
    ? await prisma.invitation.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          inviterId: user.id,
          createdAt: new Date(),
          respondedAt: null,
        },
      })
    : await prisma.invitation.create({
        data: { workplaceId, inviterId: user.id, inviteeId: invitee.id },
      });

  emitToUser(invitee.id, REALTIME_EVENTS.invitationReceived, {
    workplaceId,
    invitationId: invitation.id,
  });

  res.status(201).json({
    id: invitation.id,
    workplaceId,
    inviteeUsername: invitee.username,
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
  });
});

invitationsRouter.delete('/invitations/:invitationId', async (req, res) => {
  const user = currentUser(req);
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.invitationId },
  });

  if (!invitation) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }

  await requireOwner(user.id, invitation.workplaceId);

  if (invitation.status !== 'PENDING') {
    throw new AppError(409, 'NOT_PENDING', 'This invitation has already been answered.');
  }

  await prisma.invitation.delete({ where: { id: invitation.id } });

  emitToUser(invitation.inviteeId, REALTIME_EVENTS.invitationRemoved, {
    invitationId: invitation.id,
  });

  res.status(204).end();
});

invitationsRouter.post('/invitations/:invitationId/accept', async (req, res) => {
  const user = currentUser(req);
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.invitationId },
    include: { workplace: { select: { id: true, name: true } } },
  });

  if (!invitation || invitation.inviteeId !== user.id) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError(409, 'NOT_PENDING', 'This invitation has already been answered.');
  }

  const workplaceId = invitation.workplaceId;

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { workplaceId_userId: { workplaceId, userId: user.id } },
      update: {},
      create: { workplaceId, userId: user.id, role: 'MEMBER' },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
  });

  await joinUserToWorkplace(user.id, workplaceId);

  emitToWorkplace(workplaceId, REALTIME_EVENTS.memberJoined, { userId: user.id });
  emitToWorkplace(workplaceId, REALTIME_EVENTS.invitationResponded, {
    invitationId: invitation.id,
  });

  res.json({
    workplace: { id: invitation.workplace.id, name: invitation.workplace.name },
    role: 'MEMBER',
  });
});

invitationsRouter.post('/invitations/:invitationId/decline', async (req, res) => {
  const user = currentUser(req);
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.invitationId },
  });

  if (!invitation || invitation.inviteeId !== user.id) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError(409, 'NOT_PENDING', 'This invitation has already been answered.');
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });

  emitToUser(invitation.inviterId, REALTIME_EVENTS.invitationResponded, {
    workplaceId: invitation.workplaceId,
    invitationId: invitation.id,
  });

  res.status(204).end();
});
