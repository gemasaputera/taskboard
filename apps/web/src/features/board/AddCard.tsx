import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/utils';

interface AddCardProps {
  workplaceId: string;
  columnId: string;
  columnName: string;
}

export function AddCard({ workplaceId, columnId, columnName }: AddCardProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const mutation = useMutation({
    mutationFn: (nextTitle: string) => api.createCard(workplaceId, { columnId, title: nextTitle }),
    onSuccess: () => {
      setTitle('');
      void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    const trimmed = title.trim();
    if (!trimmed || mutation.isPending) return;
    mutation.mutate(trimmed);
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start px-2.5 text-muted"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add a card
      </Button>
    );
  }

  return (
    <form
      className="rounded-lg border border-line bg-surface p-2 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        autoFocus
        value={title}
        rows={2}
        placeholder={`New card in ${columnName}`}
        className="w-full resize-none bg-transparent px-1 py-0.5 text-[13.5px] leading-snug text-ink placeholder:text-muted/70 focus:outline-none"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') {
            setOpen(false);
            setTitle('');
          }
        }}
      />
      <div className="mt-1 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!title.trim() || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add card
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel new card"
          onClick={() => {
            setOpen(false);
            setTitle('');
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
