import type { CardSummaryDto } from '@kanban/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListChecks, MessageSquare } from 'lucide-react';
import { Avatar } from '../../components/ui/avatar';
import { cn, timeAgo } from '../../lib/utils';

export function CardFace({
  card,
  dragging = false,
  overlay = false,
}: {
  card: CardSummaryDto;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const visibleTags = card.tags.slice(0, 3);
  const extraTags = card.tags.length - visibleTags.length;

  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface p-3 text-left shadow-card transition-shadow',
        overlay && 'rotate-[1.5deg] shadow-lift',
        dragging && 'opacity-40',
      )}
    >
      <p className="text-[13.5px] font-medium leading-snug text-ink">{card.title}</p>

      {card.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-soft px-1.5 py-0.5 text-[10.5px] font-medium text-muted"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
                aria-hidden
              />
              {tag.name}
            </span>
          ))}
          {extraTags > 0 ? (
            <span className="text-[10.5px] font-medium text-muted">+{extraTags}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted">
        {card.subtaskCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="h-3.5 w-3.5" />
            {card.doneSubtaskCount}/{card.subtaskCount}
          </span>
        ) : null}
        {card.commentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {card.commentCount}
          </span>
        ) : null}
        {card.assignees.length > 0 ? (
          <span className="ml-auto flex items-center -space-x-1.5">
            {card.assignees.slice(0, 3).map((assignee) => (
              <Avatar
                key={assignee.id}
                name={assignee.username}
                size="xs"
                className="ring-surface"
              />
            ))}
            {card.assignees.length > 3 ? (
              <span className="pl-2.5 text-[10.5px] text-muted">+{card.assignees.length - 3}</span>
            ) : null}
          </span>
        ) : null}
        <span
          className={cn(
            'text-[10.5px] text-muted/80',
            card.assignees.length === 0 && 'ml-auto',
          )}
        >
          {timeAgo(card.updatedAt)}
        </span>
      </div>
    </div>
  );
}

interface CardTileProps {
  card: CardSummaryDto;
  onOpen: () => void;
}

export function CardTile({ card, onOpen }: CardTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <button type="button" className="block w-full" onClick={onOpen}>
        <CardFace card={card} dragging={isDragging} />
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${card.title}`}
        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-line opacity-100 transition-opacity hover:bg-surface-soft hover:text-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 active:cursor-grabbing"
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
