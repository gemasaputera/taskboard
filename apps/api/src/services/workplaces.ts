import { DEFAULT_COLUMN_NAMES, type MeResponse } from '@kanban/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

export async function createWorkplaceWithDefaults(
  tx: Prisma.TransactionClient,
  ownerId: string,
  name: string,
) {
  const workplace = await tx.workplace.create({
    data: { name, ownerId },
  });

  await tx.membership.create({
    data: { workplaceId: workplace.id, userId: ownerId, role: 'OWNER' },
  });

  await tx.boardColumn.createMany({
    data: DEFAULT_COLUMN_NAMES.map((columnName, position) => ({
      workplaceId: workplace.id,
      name: columnName,
      position,
    })),
  });

  return workplace;
}

export async function getMePayload(user: {
  id: string;
  username: string;
  email: string;
}): Promise<MeResponse> {
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workplace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return {
    user,
    workplaces: memberships.map((membership) => ({
      id: membership.workplace.id,
      name: membership.workplace.name,
      role: membership.role,
    })),
  };
}
