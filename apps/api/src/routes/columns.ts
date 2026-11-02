import {
  REALTIME_EVENTS,
  createColumnSchema,
  reorderColumnsSchema,
  updateColumnSchema,
  type BoardColumnDto,
} from '@kanban/shared';
import { Router } from 'express';
import { currentUser, requireAuth } from '../auth/session';
import { prisma } from '../db';
import { AppError } from '../errors';
import { getColumnForUser, requireOwner } from '../lib/access';
import { parseBody } from '../lib/validate';
import { emitToWorkplace } from '../realtime/io';
import {
  bulkUpdateCardOrder,
  bulkUpdateColumnOrder,
  nextColumnPosition,
  runSerializable,
} from '../services/ordering';

export const columnsRouter = Router();

columnsRouter.use(requireAuth);

function mapColumn(column: {
  id: string;
  name: string;
  position: number;
  isHidden: boolean;
}): BoardColumnDto {
  return {
    id: column.id,
    name: column.name,
    position: column.position,
    isHidden: column.isHidden,
  };
}

columnsRouter.post('/workplaces/:workplaceId/columns', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const { name } = parseBody(createColumnSchema, req.body);

  await requireOwner(user.id, workplaceId);

  const column = await prisma.$transaction(async (tx) => {
    const position = await nextColumnPosition(tx, workplaceId);
    return tx.boardColumn.create({ data: { workplaceId, name, position } });
  });

  emitToWorkplace(workplaceId, REALTIME_EVENTS.columnCreated, { columnId: column.id });

  res.status(201).json(mapColumn(column));
});

columnsRouter.put('/workplaces/:workplaceId/columns/order', async (req, res) => {
  const user = currentUser(req);
  const workplaceId = req.params.workplaceId;
  const { orderedIds } = parseBody(reorderColumnsSchema, req.body);

  await requireOwner(user.id, workplaceId);

  const columns = await prisma.boardColumn.findMany({
    where: { workplaceId },
    select: { id: true },
  });

  const existingIds = new Set(columns.map((column) => column.id));
  const uniqueIds = new Set(orderedIds);

  if (
    columns.length !== orderedIds.length ||
    uniqueIds.size !== orderedIds.length ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new AppError(
      400,
      'INVALID_ORDER',
      'Column order must include every column exactly once.',
    );
  }

  await prisma.$transaction((tx) =>
    bulkUpdateColumnOrder(
      tx,
      orderedIds.map((id, position) => ({ id, position })),
    ),
  );

  emitToWorkplace(workplaceId, REALTIME_EVENTS.columnsReordered);

  res.status(204).end();
});

columnsRouter.patch('/columns/:columnId', async (req, res) => {
  const user = currentUser(req);
  const { column, membership } = await getColumnForUser(req.params.columnId, user.id);

  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the workplace owner can edit columns.');
  }

  const { name, isHidden } = parseBody(updateColumnSchema, req.body);

  const updated = await prisma.boardColumn.update({
    where: { id: column.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(isHidden !== undefined ? { isHidden } : {}),
    },
  });

  emitToWorkplace(column.workplaceId, REALTIME_EVENTS.columnUpdated, {
    columnId: column.id,
  });

  res.json(mapColumn(updated));
});

columnsRouter.delete('/columns/:columnId', async (req, res) => {
  const user = currentUser(req);
  const { column, membership } = await getColumnForUser(req.params.columnId, user.id);

  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the workplace owner can delete columns.');
  }

  await runSerializable(async (tx) => {
    const columns = await tx.boardColumn.findMany({
      where: { workplaceId: column.workplaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    if (columns.length <= 1) {
      throw new AppError(400, 'LAST_COLUMN', 'A board needs at least one column.');
    }

    const destination =
      columns.find((candidate) => candidate.id !== column.id && !candidate.isHidden) ??
      columns.find((candidate) => candidate.id !== column.id);
    if (!destination) {
      throw new AppError(400, 'LAST_COLUMN', 'A board needs at least one column.');
    }

    const cards = await tx.card.findMany({
      where: { columnId: column.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const maxPosition = await tx.card.aggregate({
      where: { columnId: destination.id },
      _max: { position: true },
    });

    const start = (maxPosition._max.position ?? -1) + 1;

    if (cards.length > 0) {
      await bulkUpdateCardOrder(
        tx,
        cards.map((card, index) => ({
          id: card.id,
          columnId: destination.id,
          position: start + index,
        })),
      );
    }

    await tx.boardColumn.delete({ where: { id: column.id } });
  });

  emitToWorkplace(column.workplaceId, REALTIME_EVENTS.columnDeleted, {
    columnId: column.id,
  });

  res.status(204).end();
});
