import type {
  BoardColumnDto,
  BoardDto,
  CardDetailDto,
  CardSummaryDto,
  TagDto,
} from '@kanban/shared';
import { prisma } from '../db';
import { getMembership } from '../lib/access';
import { AppError } from '../errors';
import { Prisma } from '@prisma/client';

const assigneeInclude = {
  orderBy: { assignedAt: 'asc' as const },
  include: { user: { select: { id: true, username: true } } },
};

const cardSummaryInclude = {
  createdBy: { select: { id: true, username: true } },
  tags: { include: { tag: true } },
  assignees: assigneeInclude,
  subtasks: { select: { isDone: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.CardInclude;

type CardSummaryRecord = Prisma.CardGetPayload<{ include: typeof cardSummaryInclude }>;

function toIso(value: Date): string {
  return value.toISOString();
}

function mapTag(tag: { id: string; name: string; color: string }): TagDto {
  return { id: tag.id, name: tag.name, color: tag.color };
}

export function mapCardSummary(card: CardSummaryRecord): CardSummaryDto {
  return {
    id: card.id,
    workplaceId: card.workplaceId,
    columnId: card.columnId,
    title: card.title,
    position: card.position,
    createdAt: toIso(card.createdAt),
    updatedAt: toIso(card.updatedAt),
    createdBy: card.createdBy,
    tags: card.tags.map((entry) => mapTag(entry.tag)),
    assignees: card.assignees.map((entry) => entry.user),
    subtaskCount: card.subtasks.length,
    doneSubtaskCount: card.subtasks.filter((subtask) => subtask.isDone).length,
    commentCount: card._count.comments,
  };
}

export async function getBoard(userId: string, workplaceId: string): Promise<BoardDto> {
  const membership = await getMembership(userId, workplaceId);

  const [columns, tags, cards] = await Promise.all([
    prisma.boardColumn.findMany({ where: { workplaceId }, orderBy: { position: 'asc' } }),
    prisma.tag.findMany({ where: { workplaceId }, orderBy: { name: 'asc' } }),
    prisma.card.findMany({
      where: { workplaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: cardSummaryInclude,
    }),
  ]);

  return {
    workplace: {
      id: membership.workplace.id,
      name: membership.workplace.name,
      ownerId: membership.workplace.ownerId,
      createdAt: toIso(membership.workplace.createdAt),
    },
    role: membership.role,
    columns: columns.map<BoardColumnDto>((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
      isHidden: column.isHidden,
    })),
    tags: tags.map(mapTag),
    cards: cards.map(mapCardSummary),
  };
}

const cardDetailInclude = {
  createdBy: { select: { id: true, username: true } },
  tags: { include: { tag: true } },
  assignees: assigneeInclude,
  subtasks: { orderBy: { position: 'asc' } },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, username: true } } },
  },
} satisfies Prisma.CardInclude;

export async function getCardDetail(userId: string, cardId: string): Promise<CardDetailDto> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: cardDetailInclude,
  });

  if (!card) {
    throw new AppError(404, 'NOT_FOUND', 'Card not found.');
  }

  await getMembership(userId, card.workplaceId);

  return {
    id: card.id,
    workplaceId: card.workplaceId,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    position: card.position,
    createdAt: toIso(card.createdAt),
    updatedAt: toIso(card.updatedAt),
    createdBy: card.createdBy,
    tags: card.tags.map((entry) => mapTag(entry.tag)),
    assignees: card.assignees.map((entry) => entry.user),
    subtaskCount: card.subtasks.length,
    doneSubtaskCount: card.subtasks.filter((subtask) => subtask.isDone).length,
    commentCount: card.comments.length,
    subtasks: card.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      isDone: subtask.isDone,
      position: subtask.position,
    })),
    comments: card.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: toIso(comment.createdAt),
      updatedAt: toIso(comment.updatedAt),
      author: comment.author,
    })),
  };
}
