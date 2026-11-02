import type { BoardDto, BoardColumnDto, CardSummaryDto } from '@kanban/shared';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/utils';
import { CardFace } from './CardTile';
import { Column } from './Column';
import {
  COLUMN_DROPPABLE_PREFIX,
  cardsForColumn,
  moveCardInCards,
} from './dnd';

interface BoardProps {
  board: BoardDto;
  workplaceId: string;
  visibleColumns: BoardColumnDto[];
  isOwner: boolean;
  onOpenCard: (cardId: string) => void;
  onManageColumns: () => void;
}

interface MoveVariables {
  cardId: string;
  columnId: string;
  position: number;
  snapshot: CardSummaryDto[];
}

export function Board({
  board,
  workplaceId,
  visibleColumns,
  isOwner,
  onOpenCard,
  onManageColumns,
}: BoardProps) {
  const queryClient = useQueryClient();
  const queryKey = ['board', workplaceId] as const;
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CardSummaryDto[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function currentCards(): CardSummaryDto[] {
    return queryClient.getQueryData<BoardDto>(queryKey)?.cards ?? board.cards;
  }

  function setCards(updater: (cards: CardSummaryDto[]) => CardSummaryDto[]) {
    queryClient.setQueryData<BoardDto>(queryKey, (old) =>
      old ? { ...old, cards: updater(old.cards) } : old,
    );
  }

  const moveMutation = useMutation({
    mutationFn: (variables: MoveVariables) =>
      api.moveCard(variables.cardId, variables.columnId, variables.position),
    onError: (error, variables) => {
      setCards(() => variables.snapshot);
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  function resolveTarget(
    overId: string,
    cards: CardSummaryDto[],
    currentActiveId: string,
  ): { columnId: string; index: number } | null {
    if (overId.startsWith(COLUMN_DROPPABLE_PREFIX)) {
      const columnId = overId.slice(COLUMN_DROPPABLE_PREFIX.length);
      return {
        columnId,
        index: cardsForColumn(cards, columnId).filter((card) => card.id !== currentActiveId)
          .length,
      };
    }

    const overCard = cards.find((card) => card.id === overId);
    const activeCard = cards.find((card) => card.id === currentActiveId);
    if (!overCard || !activeCard) return null;

    const list = cardsForColumn(cards, overCard.columnId);

    if (overCard.columnId === activeCard.columnId) {
      const overIndex = list.findIndex((card) => card.id === overCard.id);
      return { columnId: overCard.columnId, index: overIndex };
    }

    const withoutActive = list.filter((card) => card.id !== currentActiveId);
    const overIndex = withoutActive.findIndex((card) => card.id === overCard.id);
    return {
      columnId: overCard.columnId,
      index: overIndex < 0 ? withoutActive.length : overIndex,
    };
  }

  function handleDragStart(event: DragStartEvent) {
    const cards = currentCards();
    setSnapshot(cards);
    setActiveCardId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over || !activeCardId) return;

    const cards = currentCards();
    const target = resolveTarget(String(event.over.id), cards, activeCardId);
    if (!target) return;

    const moving = cards.find((card) => card.id === activeCardId);
    if (!moving) return;

    const currentIndex = cardsForColumn(cards, moving.columnId).findIndex(
      (card) => card.id === activeCardId,
    );

    if (moving.columnId === target.columnId && currentIndex === target.index) return;

    setCards((previous) =>
      moveCardInCards(previous, activeCardId, target.columnId, target.index),
    );
  }

  function handleDragEnd() {
    const cardId = activeCardId;
    const startSnapshot = snapshot;

    setActiveCardId(null);
    setSnapshot(null);

    if (!cardId || !startSnapshot) return;

    const cards = currentCards();
    const moving = cards.find((card) => card.id === cardId);
    if (!moving) return;

    const position = cardsForColumn(cards, moving.columnId).findIndex(
      (card) => card.id === cardId,
    );
    const previous = startSnapshot.find((card) => card.id === cardId);
    const previousPosition = previous
      ? cardsForColumn(startSnapshot, previous.columnId).findIndex(
          (card) => card.id === cardId,
        )
      : -1;

    const changed =
      !previous || previous.columnId !== moving.columnId || previousPosition !== position;

    if (!changed) return;

    moveMutation.mutate({
      cardId,
      columnId: moving.columnId,
      position,
      snapshot: startSnapshot,
    });

  }

  function handleDragCancel() {
    if (snapshot) setCards(() => snapshot);
    setActiveCardId(null);
    setSnapshot(null);
  }

  const activeCard = activeCardId
    ? currentCards().find((card) => card.id === activeCardId)
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board-canvas flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 py-4 md:gap-4 md:px-6 md:py-5">
        {visibleColumns.length > 0 ? (
          visibleColumns.map((column) => (
            <Column
              key={column.id}
              workplaceId={workplaceId}
              column={column}
              cards={board.cards}
              isOwner={isOwner}
              onOpenCard={onOpenCard}
              onManageColumns={onManageColumns}
            />
          ))
        ) : (
          <div className="flex min-h-56 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-surface/70 p-8 text-center">
            <div className="max-w-sm">
              <p className="text-sm font-medium text-ink">No visible columns</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {isOwner
                  ? 'Every column is hidden. Open the column manager to bring one back.'
                  : 'The owner has hidden every column on this board.'}
              </p>
              {isOwner ? (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-accent hover:underline"
                  onClick={onManageColumns}
                >
                  Manage columns
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? <CardFace card={activeCard} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
