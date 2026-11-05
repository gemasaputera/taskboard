import { Prisma } from '@prisma/client';
import { prisma } from '../db';

type Tx = Prisma.TransactionClient;

export interface CardOrderRow {
  id: string;
  columnId: string;
  position: number;
}

export async function bulkUpdateCardOrder(tx: Tx, rows: CardOrderRow[]): Promise<void> {
  if (rows.length === 0) return;

  const values = rows.map(
    (row) => Prisma.sql`(${row.id}::text, ${row.columnId}::text, ${row.position}::int)`,
  );

  await tx.$executeRaw(Prisma.sql`
    UPDATE "Card" AS c
    SET "columnId" = v."columnId", "position" = v."position"
    FROM (VALUES ${Prisma.join(values)}) AS v(id, "columnId", "position")
    WHERE c.id = v.id
  `);
}

export async function bulkUpdateColumnOrder(
  tx: Tx,
  rows: { id: string; position: number }[],
): Promise<void> {
  if (rows.length === 0) return;

  const values = rows.map((row) => Prisma.sql`(${row.id}::text, ${row.position}::int)`);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "BoardColumn" AS c
    SET "position" = v."position"
    FROM (VALUES ${Prisma.join(values)}) AS v(id, "position")
    WHERE c.id = v.id
  `);
}

export async function moveCardOrder(
  tx: Tx,
  card: { id: string; columnId: string },
  targetColumnId: string,
  targetPosition: number,
): Promise<{ fromColumnId: string; toColumnId: string; position: number }> {
  const orderBy: Prisma.CardOrderByWithRelationInput[] = [
    { position: 'asc' },
    { createdAt: 'asc' },
    { id: 'asc' },
  ];

  const sourceCards = await tx.card.findMany({
    where: { columnId: card.columnId, id: { not: card.id } },
    orderBy,
    select: { id: true },
  });

  const sameColumn = card.columnId === targetColumnId;
  const targetCards = sameColumn
    ? sourceCards
    : await tx.card.findMany({
        where: { columnId: targetColumnId },
        orderBy,
        select: { id: true },
      });

  const targetIndex = Math.min(Math.max(targetPosition, 0), targetCards.length);
  const targetIds = targetCards.map((row) => row.id);
  targetIds.splice(targetIndex, 0, card.id);

  const rows: CardOrderRow[] = [];

  if (!sameColumn) {
    sourceCards.forEach((row, index) => {
      rows.push({ id: row.id, columnId: card.columnId, position: index });
    });
  }

  targetIds.forEach((id, index) => {
    rows.push({ id, columnId: targetColumnId, position: index });
  });

  await bulkUpdateCardOrder(tx, rows);

  // bulkUpdateCardOrder writes through raw SQL, which bypasses Prisma's
  // @updatedAt. Stamp only the card the user actually moved so "updated"
  // reflects the drag without disturbing every re-sequenced sibling.
  await tx.card.update({
    where: { id: card.id },
    data: { updatedAt: new Date() },
  });

  return { fromColumnId: card.columnId, toColumnId: targetColumnId, position: targetIndex };
}

export async function nextCardPosition(tx: Tx, columnId: string): Promise<number> {
  const result = await tx.card.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

export async function nextColumnPosition(tx: Tx, workplaceId: string): Promise<number> {
  const result = await tx.boardColumn.aggregate({
    where: { workplaceId },
    _max: { position: true },
  });
  return (result._max.position ?? -1) + 1;
}

export async function runSerializable<T>(
  fn: (tx: Tx) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      lastError = error;
      if (
        attempt < attempts &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
