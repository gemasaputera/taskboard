import type { BoardColumnDto, CardSummaryDto } from '@kanban/shared';
import { describe, expect, it } from 'vitest';
import {
  cardsForColumn,
  indexOfCard,
  moveCardInCards,
  sortedVisibleColumns,
} from './dnd';

function card(id: string, columnId: string, position: number): CardSummaryDto {
  return {
    id,
    columnId,
    title: id,
    position,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: { id: 'u1', username: 'gema' },
    tags: [],
    assignees: [],
    subtaskCount: 0,
    doneSubtaskCount: 0,
    commentCount: 0,
  };
}

const cards = [card('a', 'todo', 0), card('b', 'todo', 1), card('c', 'doing', 0)];

describe('moveCardInCards', () => {
  it('moves a card across columns and reindexes both columns', () => {
    const next = moveCardInCards(cards, 'a', 'doing', 1);
    expect(cardsForColumn(next, 'todo').map((entry) => entry.id)).toEqual(['b']);
    expect(cardsForColumn(next, 'doing').map((entry) => entry.id)).toEqual(['c', 'a']);
    expect(cardsForColumn(next, 'todo')[0]?.position).toBe(0);
    expect(cardsForColumn(next, 'doing').map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('reorders within a column', () => {
    const next = moveCardInCards(cards, 'b', 'todo', 0);
    expect(cardsForColumn(next, 'todo').map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(cardsForColumn(next, 'todo').map((entry) => entry.position)).toEqual([0, 1]);
  });

  it('clamps the target index to the column length', () => {
    const next = moveCardInCards(cards, 'a', 'doing', 99);
    expect(cardsForColumn(next, 'doing').map((entry) => entry.id)).toEqual(['c', 'a']);
  });

  it('returns the original array for an unknown card', () => {
    expect(moveCardInCards(cards, 'missing', 'doing', 0)).toBe(cards);
  });
});

describe('helpers', () => {
  it('finds a card index inside its column', () => {
    expect(indexOfCard(cards, 'c')).toBe(0);
    expect(indexOfCard(cards, 'missing')).toBe(-1);
  });

  it('sorts visible columns by position and drops hidden ones', () => {
    const columns: BoardColumnDto[] = [
      { id: 'done', name: 'Done', position: 3, isHidden: false },
      { id: 'todo', name: 'To Do', position: 0, isHidden: false },
      { id: 'hidden', name: 'Hidden', position: 1, isHidden: true },
      { id: 'doing', name: 'Doing', position: 2, isHidden: false },
    ];
    expect(sortedVisibleColumns(columns).map((column) => column.id)).toEqual([
      'todo',
      'doing',
      'done',
    ]);
  });
});
