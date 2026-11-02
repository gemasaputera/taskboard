import {
  REALTIME_EVENTS,
  createCommentSchema,
  updateCommentSchema,
  type CommentDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getCardForUser, getMembership } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace } from '../realtime/io';

export const commentsRouter = Router();

commentsRouter.use(requireAuth);

function mapComment(comment: {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; username: string };
}): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: comment.author,
  };
}

commentsRouter.post('/cards/:cardId/comments', async (req, res) => {
  const user = currentUser(req);
  const { card } = await getCardForUser(req.params.cardId, user.id);
  const { body } = parseBody(createCommentSchema, req.body);

  const comment = await prisma.comment.create({
    data: { cardId: card.id, authorId: user.id, body },
    include: { author: { select: { id: true, username: true } } },
  });

  emitToWorkplace(card.workplaceId, REALTIME_EVENTS.commentCreated, {
    cardId: card.id,
  });

  res.status(201).json(mapComment(comment));
});

commentsRouter.patch('/comments/:commentId', async (req, res) => {
  const user = currentUser(req);
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.commentId },
    include: { card: { select: { id: true, workplaceId: true } } },
  });

  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Comment not found.');
  }

  await getMembership(user.id, comment.card.workplaceId);

  if (comment.authorId !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You can only edit your own comments.');
  }

  const { body } = parseBody(updateCommentSchema, req.body);

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: { body },
    include: { author: { select: { id: true, username: true } } },
  });

  emitToWorkplace(comment.card.workplaceId, REALTIME_EVENTS.commentUpdated, {
    cardId: comment.card.id,
  });

  res.json(mapComment(updated));
});

commentsRouter.delete('/comments/:commentId', async (req, res) => {
  const user = currentUser(req);
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.commentId },
    include: { card: { select: { id: true, workplaceId: true } } },
  });

  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Comment not found.');
  }

  const membership = await getMembership(user.id, comment.card.workplaceId);

  if (comment.authorId !== user.id && membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments.');
  }

  await prisma.comment.delete({ where: { id: comment.id } });

  emitToWorkplace(comment.card.workplaceId, REALTIME_EVENTS.commentDeleted, {
    cardId: comment.card.id,
  });

  res.status(204).end();
});
