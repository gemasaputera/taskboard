import type { SubtaskDto } from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/utils';

interface SubtaskListProps {
  cardId: string;
  workplaceId: string;
  subtasks: SubtaskDto[];
}

export function SubtaskList({ cardId, workplaceId, subtasks }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
  }

  const create = useMutation({
    mutationFn: (nextTitle: string) => api.createSubtask(cardId, nextTitle),
    onSuccess: () => {
      setTitle('');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) =>
      api.updateSubtask(id, { isDone }),
    onSuccess: invalidate,
    onError: (error) => {
      invalidate();
      toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSubtask(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const done = subtasks.filter((subtask) => subtask.isDone).length;
  const percent = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;

  return (
    <section aria-labelledby="subtasks-heading">
      <div className="flex items-center justify-between">
        <h3 id="subtasks-heading" className="text-[13px] font-semibold text-ink">
          Subtasks
        </h3>
        {subtasks.length > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-muted">
            {done}/{subtasks.length}
          </span>
        ) : null}
      </div>

      {subtasks.length > 0 ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted">Break this task into smaller steps.</p>
      )}

      <ul className="mt-2.5 space-y-1">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface-soft"
          >
            <Checkbox
              checked={subtask.isDone}
              onCheckedChange={(checked) =>
                update.mutate({ id: subtask.id, isDone: checked === true })
              }
              aria-label={`Mark ${subtask.title} as ${subtask.isDone ? 'incomplete' : 'complete'}`}
            />
            <span
              className={`min-w-0 flex-1 text-[13px] leading-snug ${
                subtask.isDone ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {subtask.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete subtask ${subtask.title}`}
              onClick={() => remove.mutate(subtask.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = title.trim();
          if (next) create.mutate(next);
        }}
      >
        <Input
          value={title}
          placeholder="Add a subtask"
          maxLength={200}
          className="h-8 text-[13px]"
          onChange={(event) => setTitle(event.target.value)}
        />
        <Button
          type="submit"
          variant="secondary"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Add subtask"
          disabled={!title.trim() || create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </form>
    </section>
  );
}
