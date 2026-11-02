import type { BoardColumnDto, TagDto } from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { api } from '../../lib/api';
import { cn, errorMessage } from '../../lib/utils';

interface CustomizeColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workplaceId: string;
  columns: BoardColumnDto[];
  tags: TagDto[];
}

interface RowProps {
  column: BoardColumnDto;
  onRename: (columnId: string, name: string) => void;
  onToggleHidden: (columnId: string, isHidden: boolean) => void;
  onDelete: (column: BoardColumnDto) => void;
}

function ColumnRow({ column, onRename, onToggleHidden, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(column.name);
  }, [column.name]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const name = draft.trim();
    if (!name || name === column.name) {
      setDraft(column.name);
      setEditing(false);
      return;
    }
    onRename(column.id, name);
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2',
        isDragging && 'z-10 opacity-70 shadow-lift',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${column.name}`}
        className="cursor-grab rounded-md p-1 text-line transition-colors hover:bg-surface-soft hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <Input
          autoFocus
          value={draft}
          className="h-8 flex-1"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') {
              cancelled.current = true;
              setDraft(column.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="flex-1 truncate rounded-md px-1 py-1 text-left text-sm font-medium text-ink hover:bg-surface-soft"
          onClick={() => setEditing(true)}
          title="Rename column"
        >
          {column.name}
        </button>
      )}

      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        {column.isHidden ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        <Switch
          checked={!column.isHidden}
          onCheckedChange={(checked) => onToggleHidden(column.id, !checked)}
          aria-label={`${column.isHidden ? 'Show' : 'Hide'} ${column.name}`}
        />
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-danger"
        aria-label={`Delete ${column.name}`}
        onClick={() => onDelete(column)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}


interface TagRowProps {
  tag: TagDto;
  onRename: (tagId: string, name: string) => void;
  onDelete: (tag: TagDto) => void;
}

function TagRow({ tag, onRename, onDelete }: TagRowProps) {
  const [draft, setDraft] = useState(tag.name);
  const cancelled = useRef(false);

  useEffect(() => {
    setDraft(tag.name);
  }, [tag.name]);

  function commit() {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const name = draft.trim();
    if (!name || name === tag.name) {
      setDraft(tag.name);
      return;
    }
    onRename(tag.id, name);
  }

  return (
    <li className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-surface-soft/70">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
        aria-hidden
      />
      <Input
        value={draft}
        maxLength={24}
        aria-label={`Rename tag ${tag.name}`}
        className="h-7 flex-1 border-transparent bg-transparent px-1 text-[13px] shadow-none focus-visible:border-line"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            cancelled.current = true;
            setDraft(tag.name);
            event.currentTarget.blur();
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted hover:text-danger"
        aria-label={`Delete tag ${tag.name}`}
        onClick={() => onDelete(tag)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

export function CustomizeColumnsDialog({
  open,
  onOpenChange,
  workplaceId,
  columns,
  tags,
}: CustomizeColumnsDialogProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BoardColumnDto[]>([]);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BoardColumnDto | null>(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState<TagDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!open) return;
    setItems([...columns].sort((a, b) => a.position - b.position));
    setNewName('');
  }, [open, columns]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
  }

  const rename = useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      api.updateColumn(columnId, { name }),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleHidden = useMutation({
    mutationFn: ({ columnId, isHidden }: { columnId: string; isHidden: boolean }) =>
      api.updateColumn(columnId, { isHidden }),
    onMutate: ({ columnId, isHidden }) => {
      setItems((previous) =>
        previous.map((column) => (column.id === columnId ? { ...column, isHidden } : column)),
      );
    },
    onSuccess: invalidate,
    onError: (error) => {
      invalidate();
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (columnId: string) => api.deleteColumn(columnId),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success('Column deleted');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const create = useMutation({
    mutationFn: (name: string) => api.createColumn(workplaceId, name),
    onSuccess: () => {
      setNewName('');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const renameTag = useMutation({
    mutationFn: ({ tagId, name }: { tagId: string; name: string }) =>
      api.updateTag(tagId, { name }),
    onSuccess: invalidate,
    onError: (error) => {
      invalidate();
      toast.error(errorMessage(error));
    },
  });

  const removeTag = useMutation({
    mutationFn: (tagId: string) => api.deleteTag(tagId),
    onSuccess: () => {
      invalidate();
      setDeleteTagTarget(null);
      toast.success('Tag deleted');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderColumns(workplaceId, orderedIds),
    onSuccess: invalidate,
    onError: (error) => {
      invalidate();
      toast.error(errorMessage(error));
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((column) => column.id === active.id);
    const newIndex = items.findIndex((column) => column.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    reorder.mutate(next.map((column) => column.id));
  }

  function handleDelete(column: BoardColumnDto) {
    if (items.length <= 1) {
      toast.error('A board needs at least one column.');
      return;
    }
    setDeleteTarget(column);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Customize board</DialogTitle>
            <DialogDescription>
              Drag to reorder columns, hide a lane without losing its cards, and manage workplace tags.
            </DialogDescription>
          </DialogHeader>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((column) => column.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((column) => (
                  <ColumnRow
                    key={column.id}
                    column={column}
                    onRename={(columnId, name) => rename.mutate({ columnId, name })}
                    onToggleHidden={(columnId, isHidden) =>
                      toggleHidden.mutate({ columnId, isHidden })
                    }
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <form
            className="mt-4 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newName.trim();
              if (name) create.mutate(name);
            }}
          >
            <Input
              value={newName}
              placeholder="New column name"
              maxLength={40}
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={!newName.trim() || create.isPending}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            Hidden columns stay in the board data. Use the “hidden” chip on the board to reopen
            this manager and bring them back.
          </p>

          <section className="mt-6 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-ink">Tags</h3>
              <span className="text-[11px] text-muted">{tags.length}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Rename or remove workplace tags. Removing a tag clears it from every card.
            </p>
            {tags.length === 0 ? (
              <p className="mt-3 text-xs text-muted">
                No tags yet — create one from any card’s tag picker.
              </p>
            ) : (
              <ul className="mt-2 space-y-0.5">
                {tags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    onRename={(tagId, name) => renameTag.mutate({ tagId, name })}
                    onDelete={setDeleteTagTarget}
                  />
                ))}
              </ul>
            )}
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its cards will move to the first remaining column. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              disabled={remove.isPending}
            >
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTagTarget)}
        onOpenChange={(next) => !next && setDeleteTagTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTagTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the tag from every card in the workplace. The cards themselves stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => deleteTagTarget && removeTag.mutate(deleteTagTarget.id)}
              disabled={removeTag.isPending}
            >
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
