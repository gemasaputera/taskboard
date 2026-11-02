import type { Membership, Workplace } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';

export type MembershipWithWorkplace = Membership & { workplace: Workplace };

export async function getMembership(
  userId: string,
  workplaceId: string,
): Promise<MembershipWithWorkplace> {
  const membership = await prisma.membership.findUnique({
    where: { workplaceId_userId: { workplaceId, userId } },
    include: { workplace: true },
  });

  if (!membership) {
    throw new AppError(404, 'NOT_FOUND', 'Workplace not found.');
  }

  return membership;
}

export async function requireOwner(
  userId: string,
  workplaceId: string,
): Promise<MembershipWithWorkplace> {
  const membership = await getMembership(userId, workplaceId);
  if (membership.role !== 'OWNER') {
    throw new AppError(403, 'FORBIDDEN', 'Only the workplace owner can do that.');
  }
  return membership;
}

export interface CardWithColumn {
  id: string;
  workplaceId: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  createdById: string;
}

export async function getCardForUser(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      column: { select: { id: true, name: true, position: true, isHidden: true } },
    },
  });

  if (!card) {
    throw new AppError(404, 'NOT_FOUND', 'Card not found.');
  }

  const membership = await getMembership(userId, card.workplaceId);
  return { card, membership };
}

export async function getColumnForUser(columnId: string, userId: string) {
  const column = await prisma.boardColumn.findUnique({ where: { id: columnId } });

  if (!column) {
    throw new AppError(404, 'NOT_FOUND', 'Column not found.');
  }

  const membership = await getMembership(userId, column.workplaceId);
  return { column, membership };
}
