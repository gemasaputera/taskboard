import {
  REALTIME_EVENTS,
  createTagSchema,
  updateTagSchema,
  type TagDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getMembership } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace } from '../realtime/io';

export const tagsRouter = Router();

tagsRouter.use(requireAuth);

function mapTag(tag: { id: string; name: string; color: string }): TagDto {
  return { id: tag.id, name: tag.name, color: tag.color };
}

tagsRouter.get('/workplaces/:workplaceId/tags', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  await getMembership(user.id, workplaceId);

  const tags = await prisma.tag.findMany({
    where: { workplaceId },
    orderBy: { name: 'asc' },
  });

  res.json(tags.map(mapTag));
});

tagsRouter.post('/workplaces/:workplaceId/tags', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  await getMembership(user.id, workplaceId);

  const { name, color } = parseBody(createTagSchema, req.body);

  const duplicate = await prisma.tag.findFirst({
    where: { workplaceId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(409, 'TAG_EXISTS', 'A tag with that name already exists.');
  }

  const tag = await prisma.tag.create({ data: { workplaceId, name, color } });

  emitToWorkplace(workplaceId, REALTIME_EVENTS.tagCreated, { tagId: tag.id });

  res.status(201).json(mapTag(tag));
});

tagsRouter.patch('/tags/:tagId', async (req, res) => {
  const user = currentUser(req);
  const tag = await prisma.tag.findUnique({ where: { id: req.params.tagId } });

  if (!tag) {
    throw new AppError(404, 'NOT_FOUND', 'Tag not found.');
  }

  const membership = await getMembership(user.id, tag.workplaceId);

  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the workplace owner can edit tags.');
  }

  const { name, color } = parseBody(updateTagSchema, req.body);

  if (name) {
    const duplicate = await prisma.tag.findFirst({
      where: {
        workplaceId: tag.workplaceId,
        id: { not: tag.id },
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new AppError(409, 'TAG_EXISTS', 'A tag with that name already exists.');
    }
  }

  const updated = await prisma.tag.update({
    where: { id: tag.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(color !== undefined ? { color } : {}),
    },
  });

  emitToWorkplace(tag.workplaceId, REALTIME_EVENTS.tagUpdated, { tagId: tag.id });

  res.json(mapTag(updated));
});

tagsRouter.delete('/tags/:tagId', async (req, res) => {
  const user = currentUser(req);
  const tag = await prisma.tag.findUnique({ where: { id: req.params.tagId } });

  if (!tag) {
    throw new AppError(404, 'NOT_FOUND', 'Tag not found.');
  }

  const membership = await getMembership(user.id, tag.workplaceId);

  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the workplace owner can delete tags.');
  }

  await prisma.tag.delete({ where: { id: tag.id } });

  emitToWorkplace(tag.workplaceId, REALTIME_EVENTS.tagDeleted, { tagId: tag.id });

  res.status(204).end();
});
