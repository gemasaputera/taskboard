import {
  REALTIME_EVENTS,
  createWorkplaceSchema,
  updateWorkplaceSchema,
  type MemberDto,
  type WorkplaceSummary,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getMembership, requireOwner } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace, leaveUserFromWorkplace } from '../realtime/io';
import { getBoard } from '../services/board';
import { createWorkplaceWithDefaults } from '../services/workplaces';

export const workplacesRouter = Router();

workplacesRouter.use(requireAuth);

workplacesRouter.get('/workplaces', async (req, res) => {
  const user = currentUser(req);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workplace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  const workplaces: WorkplaceSummary[] = memberships.map((membership) => ({
    id: membership.workplace.id,
    name: membership.workplace.name,
    role: membership.role,
  }));

  res.json(workplaces);
});

workplacesRouter.post('/workplaces', async (req, res) => {
  const user = currentUser(req);
  const { name } = parseBody(createWorkplaceSchema, req.body);

  const workplace = await prisma.$transaction((tx) =>
    createWorkplaceWithDefaults(tx, user.id, name),
  );

  res.status(201).json({
    id: workplace.id,
    name: workplace.name,
    ownerId: workplace.ownerId,
    createdAt: workplace.createdAt.toISOString(),
  });
});

workplacesRouter.patch('/workplaces/:workplaceId', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const { name } = parseBody(updateWorkplaceSchema, req.body);

  await requireOwner(user.id, workplaceId);

  const workplace = await prisma.workplace.update({
    where: { id: workplaceId },
    data: { name },
  });

  emitToWorkplace(workplaceId, REALTIME_EVENTS.workplaceUpdated);

  res.json({
    id: workplace.id,
    name: workplace.name,
    ownerId: workplace.ownerId,
    createdAt: workplace.createdAt.toISOString(),
  });
});

workplacesRouter.get('/workplaces/:workplaceId/board', async (req, res) => {
  const user = currentUser(req);
  const board = await getBoard(user.id, req.params.workplaceId);
  res.json(board);
});

workplacesRouter.get('/workplaces/:workplaceId/members', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const membership = await getMembership(user.id, workplaceId);

  const members = await prisma.membership.findMany({
    where: { workplaceId },
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  const payload: MemberDto[] = members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    username: member.user.username,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    ...(membership.role === 'OWNER' ? { email: member.user.email } : {}),
  }));

  res.json(payload);
});

workplacesRouter.delete('/workplaces/:workplaceId/members/:userId', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const targetUserId = req.params.userId;

  const ownerMembership = await requireOwner(user.id, workplaceId);

  if (targetUserId === ownerMembership.workplace.ownerId) {
    throw new AppError(400, 'CANNOT_REMOVE_OWNER', 'The workplace owner cannot be removed.');
  }

  const membership = await prisma.membership.findUnique({
    where: { workplaceId_userId: { workplaceId, userId: targetUserId } },
  });

  if (!membership) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });

    const cards = await tx.card.findMany({
      where: { workplaceId },
      select: { id: true },
    });

    await tx.cardAssignee.deleteMany({
      where: { userId: targetUserId, cardId: { in: cards.map((card) => card.id) } },
    });
  });

  leaveUserFromWorkplace(targetUserId, workplaceId);
  emitToWorkplace(workplaceId, REALTIME_EVENTS.memberRemoved, { userId: targetUserId });

  res.status(204).end();
});

workplacesRouter.post('/workplaces/:workplaceId/leave', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const membership = await getMembership(user.id, workplaceId);

  if (membership.role === 'OWNER') {
    throw new AppError(
      400,
      'OWNER_CANNOT_LEAVE',
      'The owner cannot leave their own workplace. Ownership transfer is not available yet.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id: membership.id } });

    const cards = await tx.card.findMany({
      where: { workplaceId },
      select: { id: true },
    });

    await tx.cardAssignee.deleteMany({
      where: { userId: user.id, cardId: { in: cards.map((card) => card.id) } },
    });
  });

  leaveUserFromWorkplace(user.id, workplaceId);
  emitToWorkplace(workplaceId, REALTIME_EVENTS.memberRemoved, { userId: user.id });

  res.status(204).end();
});
