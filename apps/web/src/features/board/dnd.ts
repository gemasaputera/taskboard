import type { BoardColumnDto, CardSummaryDto } from '@kanban/shared';

export const COLUMN_DROPPABLE_PREFIX = 'column:';

export function compareCards(a: CardSummaryDto, b: CardSummaryDto): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function cardsForColumn(cards: CardSummaryDto[], columnId: string): CardSummaryDto[] {
  return cards.filter((card) => card.columnId === columnId).sort(compareCards);
}

export function sortedVisibleColumns(columns: BoardColumnDto[]): BoardColumnDto[] {
  return [...columns]
    .filter((column) => !column.isHidden)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function indexOfCard(cards: CardSummaryDto[], cardId: string): number {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) return -1;
  return cardsForColumn(cards, card.columnId).findIndex((candidate) => candidate.id === cardId);
}

/**
 * Moves a card into a target column at a target index, mirroring the server's
 * contiguous-position ordering. Returns a new array; the input is untouched.
 */
export function moveCardInCards(
  cards: CardSummaryDto[],
  cardId: string,
  targetColumnId: string,
  targetIndex: number,
): CardSummaryDto[] {
  const moving = cards.find((card) => card.id === cardId);
  if (!moving) return cards;

  const groups = new Map<string, CardSummaryDto[]>();

  for (const card of cards) {
    if (card.id === cardId) continue;
    const list = groups.get(card.columnId) ?? [];
    list.push(card);
    groups.set(card.columnId, list);
  }

  for (const list of groups.values()) {
    list.sort(compareCards);
  }

  const targetList = groups.get(targetColumnId) ?? [];
  const index = Math.min(Math.max(targetIndex, 0), targetList.length);
  targetList.splice(index, 0, { ...moving, columnId: targetColumnId });
  groups.set(targetColumnId, targetList);

  if (moving.columnId !== targetColumnId) {
    const sourceList = groups.get(moving.columnId) ?? [];
    sourceList.sort(compareCards);
    groups.set(moving.columnId, sourceList);
  }

  const result: CardSummaryDto[] = [];
  for (const [columnId, list] of groups) {
    list.forEach((card, position) => {
      result.push({ ...card, columnId, position });
    });
  }

  return result;
}
