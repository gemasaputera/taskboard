import type { BoardColumnDto, CardSummaryDto } from '@kanban/shared';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EyeOff, MoreHorizontal, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { api } from '../../lib/api';
import { cn, errorMessage } from '../../lib/utils';
import { AddCard } from './AddCard';
import { CardTile } from './CardTile';
import { COLUMN_DROPPABLE_PREFIX, cardsForColumn } from './dnd';

interface ColumnProps {
  workplaceId: string;
  column: BoardColumnDto;
  cards: CardSummaryDto[];
  isOwner: boolean;
  onOpenCard: (cardId: string) => void;
  onManageColumns: () => void;
}

export function Column({
  workplaceId,
  column,
  cards,
  isOwner,
  onOpenCard,
  onManageColumns,
}: ColumnProps) {
  const queryClient = useQueryClient();
  const columnCards = cardsForColumn(cards, column.id);

  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_DROPPABLE_PREFIX}${column.id}`,
    data: { type: 'column', columnId: column.id },
  });

  const hideColumn = useMutation({
    mutationFn: () => api.updateColumn(column.id, { isHidden: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
      toast.success(`“${column.name}” hidden`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section
      className={cn(
        'flex max-h-full w-[85vw] shrink-0 flex-col rounded-xl border border-line bg-surface-soft/90 sm:w-[17.5rem]',
        isOver && 'border-accent/40 bg-accent-soft/40',
      )}
      aria-label={`${column.name} column`}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <h2 className="truncate text-[13px] font-semibold text-ink">{column.name}</h2>
        <Badge variant="neutral" className="tabular-nums">
          {columnCards.length}
        </Badge>
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7 text-muted"
                aria-label={`Column options for ${column.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onManageColumns}>
                <Settings2 className="h-4 w-4" />
                Manage columns
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => hideColumn.mutate()}
                disabled={hideColumn.isPending}
              >
                <EyeOff className="h-4 w-4" />
                Hide column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div
        ref={setNodeRef}
        className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext
          items={columnCards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {columnCards.map((card) => (
            <CardTile key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>

        {columnCards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line/80 px-3 py-6 text-center text-[11.5px] text-muted/80">
            Drop a card here
          </div>
        ) : null}
      </div>

      <div className="px-2 pb-2">
        <AddCard workplaceId={workplaceId} columnId={column.id} columnName={column.name} />
      </div>
    </section>
  );
}
