import {
  REALTIME_EVENTS,
  createSubtaskSchema,
  updateSubtaskSchema,
  type SubtaskDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getCardForUser, getMembership } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace } from '../realtime/io';

export const subtasksRouter = Router();

subtasksRouter.use(requireAuth);

function mapSubtask(subtask: {
  id: string;
  title: string;
  isDone: boolean;
  position: number;
}): SubtaskDto {
  return {
    id: subtask.id,
    title: subtask.title,
    isDone: subtask.isDone,
    position: subtask.position,
  };
}

subtasksRouter.post('/cards/:cardId/subtasks', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { title } = parseBody(createSubtaskSchema, req.body);

  const subtask = await prisma.$transaction(async (tx) => {
    const aggregate = await tx.subtask.aggregate({
      where: { cardId: card.id },
      _max: { position: true },
    });

    return tx.subtask.create({
      data: {
        cardId: card.id,
        title,
        position: (aggregate._max.position ?? -1) + 1,
      },
    });
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.subtaskCreated, {
    cardId: card.id,
  });

  res.status(201).json(mapSubtask(subtask));
});

subtasksRouter.patch('/subtasks/:subtaskId', async (req, res) => {
  const user = currentUser(req);
  const subtask = await prisma.subtask.findUnique({
    where: { id: req.params.subtaskId },
    include: { card: { select: { id: true, workplaceId: true } } },
  });

  if (!subtask) {
    throw new AppError(404, 'NOT_FOUND', 'Subtask not found.');
  }

  await getMembership(user.id, subtask.card.workplaceId);

  const { title, isDone } = parseBody(updateSubtaskSchema, req.body);

  const updated = await prisma.subtask.update({
    where: { id: subtask.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(isDone !== undefined ? { isDone } : {}),
    },
  });

  emitToWorkplace(subtask.card.workplaceId, REALTIME_EVENTS.subtaskUpdated, {
    cardId: subtask.card.id,
  });

  res.json(mapSubtask(updated));
});

subtasksRouter.delete('/subtasks/:subtaskId', async (req, res) => {
  const user = currentUser(req);
  const subtask = await prisma.subtask.findUnique({
    where: { id: req.params.subtaskId },
    include: { card: { select: { id: true, workplaceId: true } } },
  });

  if (!subtask) {
    throw new AppError(404, 'NOT_FOUND', 'Subtask not found.');
  }

  await getMembership(user.id, subtask.card.workplaceId);

  await prisma.subtask.delete({ where: { id: subtask.id } });

  emitToWorkplace(subtask.card.workplaceId, REALTIME_EVENTS.subtaskDeleted, {
    cardId: subtask.card.id,
  });

  res.status(204).end();
});
