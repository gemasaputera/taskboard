import {
  REALTIME_EVENTS,
  createCardSchema,
  moveCardSchema,
  setCardAssigneesSchema,
  setCardTagsSchema,
  updateCardSchema,
  type CardAssigneeDto,
  type TagDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getCardForUser, getMembership } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace } from '../realtime/io';
import { getCardDetail } from '../services/board';
import { moveCardOrder, nextCardPosition, runSerializable } from '../services/ordering';

export const cardsRouter = Router();

cardsRouter.use(requireAuth);

cardsRouter.post('/workplaces/:workplaceId/cards', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const { columnId, title, description } = parseBody(createCardSchema, req.body);

  await getMembership(user.id, workplaceId);

  const card = await prisma.$transaction(async (tx) => {
    const column = await tx.boardColumn.findFirst({
      where: { id: columnId, workplaceId },
      select: { id: true },
    });

    if (!column) {
      throw new AppError(400, 'INVALID_COLUMN', 'That column does not belong to this workplace.');
    }

    const position = await nextCardPosition(tx, columnId);

    return tx.card.create({
      data: {
        workplaceId,
        columnId,
        title,
        description: description ?? null,
        position,
        createdById: user.id,
      },
    });
  });

  emitToWorkplace(workplaceId, REALTIME_EVENTS.cardCreated, {
    cardId: card.id,
    columnId: card.columnId,
  });

  res.status(201).json(await getCardDetail(user.id, card.id));
});

cardsRouter.get('/cards/:cardId', async (req, res) => {
  const user = currentUser(req);
  res.json(await getCardDetail(user.id, req.params.cardId));
});

cardsRouter.patch('/cards/:cardId', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { title, description } = parseBody(updateCardSchema, req.body);

  const updated = await prisma.card.update({
    where: { id: card.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.cardUpdated, {
    cardId: card.id,
    columnId: updated.columnId,
  });

  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    updatedAt: updated.updatedAt.toISOString(),
  });
});

cardsRouter.patch('/cards/:cardId/move', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { columnId, position } = parseBody(moveCardSchema, req.body);

  const result = await runSerializable(async (tx) => {
    const fresh = await tx.card.findUnique({
      where: { id: card.id },
      select: { id: true, columnId: true, workplaceId: true },
    });

    if (!fresh) {
      throw new AppError(404, 'NOT_FOUND', 'Card not found.');
    }

    const target = await tx.boardColumn.findFirst({
      where: { id: columnId, workplaceId: fresh.workplaceId },
      select: { id: true },
    });

    if (!target) {
      throw new AppError(400, 'INVALID_COLUMN', 'That column does not belong to this workplace.');
    }

    return moveCardOrder(tx, fresh, columnId, position);
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.cardMoved, {
    cardId: card.id,
    columnId: result.toColumnId,
  });

  res.json({ cardId: card.id, columnId: result.toColumnId, position: result.position });
});

cardsRouter.delete('/cards/:cardId', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);

  await prisma.card.delete({ where: { id: card.id } });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.cardDeleted, {
    cardId: card.id,
    columnId: card.columnId,
  });

  res.status(204).end();
});

cardsRouter.put('/cards/:cardId/assignees', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { userIds } = parseBody(setCardAssigneesSchema, req.body);
  const uniqueUserIds = [...new Set(userIds)];

  const memberships = await prisma.membership.findMany({
    where: { workplaceId: card.workplaceId, userId: { in: uniqueUserIds } },
    select: { userId: true },
  });

  if (memberships.length !== uniqueUserIds.length) {
    throw new AppError(
      400,
      'INVALID_ASSIGNEE',
      'One or more assignees are not members of this workplace.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.cardAssignee.deleteMany({ where: { cardId: card.id } });

    if (uniqueUserIds.length > 0) {
      await tx.cardAssignee.createMany({
        data: uniqueUserIds.map((userId) => ({ cardId: card.id, userId })),
      });
    }

    // Join-table writes never touch the Card row, so bump it here to keep
    // `card.updated` (and the card's `updatedAt`) honest.
    await tx.card.update({
      where: { id: card.id },
      data: { updatedAt: new Date() },
    });
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.cardUpdated, {
    cardId: card.id,
    columnId: card.columnId,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, username: true },
  });

  const ordered: CardAssigneeDto[] = uniqueUserIds
    .map((userId) => users.find((candidate) => candidate.id === userId))
    .filter((candidate): candidate is (typeof users)[number] => Boolean(candidate))
    .map((candidate) => ({ id: candidate.id, username: candidate.username }));

  res.json(ordered);
});

cardsRouter.put('/cards/:cardId/tags', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { tagIds } = parseBody(setCardTagsSchema, req.body);
  const uniqueTagIds = [...new Set(tagIds)];

  const tags = await prisma.tag.findMany({
    where: { workplaceId: card.workplaceId, id: { in: uniqueTagIds } },
  });

  if (tags.length !== uniqueTagIds.length) {
    throw new AppError(400, 'INVALID_TAG', 'One or more tags do not belong to this workplace.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.cardTag.deleteMany({ where: { cardId: card.id } });

    if (uniqueTagIds.length > 0) {
      await tx.cardTag.createMany({
        data: uniqueTagIds.map((tagId) => ({ cardId: card.id, tagId })),
      });
    }

    // Same as assignees: the Card row must change for `card.updated` to be true.
    await tx.card.update({
      where: { id: card.id },
      data: { updatedAt: new Date() },
    });
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.cardUpdated, {
    cardId: card.id,
    columnId: card.columnId,
  });

  const ordered: TagDto[] = uniqueTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is (typeof tags)[number] => Boolean(tag))
    .map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }));

  res.json(ordered);
});
