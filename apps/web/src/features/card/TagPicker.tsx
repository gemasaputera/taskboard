import { TAG_COLORS, type CardDetailDto, type TagDto } from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { api } from '../../lib/api';
import { cn, errorMessage } from '../../lib/utils';

interface TagPickerProps {
  workplaceId: string;
  card: CardDetailDto;
  boardTags: TagDto[];
}

export function TagPicker({ workplaceId, card, boardTags }: TagPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[3]);

  const selected = new Set(card.tags.map((tag) => tag.id));

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
    void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
  }

  const setTags = useMutation({
    mutationFn: (tagIds: string[]) => api.setCardTags(card.id, tagIds),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const createTag = useMutation({
    mutationFn: () => api.createTag(workplaceId, { name: name.trim(), color }),
    onSuccess: (tag) => {
      setName('');
      invalidate();
      setTags.mutate([...selected, tag.id]);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function toggle(tagId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(tagId);
    else next.delete(tagId);
    setTags.mutate([...next]);
  }

  return (
    <section aria-labelledby="tags-heading">
      <h3 id="tags-heading" className="text-[13px] font-semibold text-ink">
        Tags
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: tag.color }}
              aria-hidden
            />
            {tag.name}
          </span>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-muted"
              aria-label="Edit tags"
            >
              {card.tags.length === 0 ? <TagIcon className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {card.tags.length === 0 ? 'Add tags' : ''}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Tags in this workplace
            </p>

            {boardTags.length === 0 ? (
              <p className="mb-3 text-xs text-muted">No tags yet. Create the first one below.</p>
            ) : (
              <div className="mb-3 max-h-48 space-y-0.5 overflow-y-auto">
                {boardTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs text-ink hover:bg-surface-soft"
                  >
                    <Checkbox
                      checked={selected.has(tag.id)}
                      onCheckedChange={(checked) => toggle(tag.id, checked === true)}
                    />
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden
                    />
                    <span className="truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}

            <form
              className="border-t border-line pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) createTag.mutate();
              }}
            >
              <Input
                value={name}
                placeholder="New tag name"
                maxLength={24}
                className="h-8 text-xs"
                onChange={(event) => setName(event.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TAG_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Use color ${swatch}`}
                    aria-pressed={color === swatch}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform hover:scale-105',
                      color === swatch ? 'border-ink' : 'border-transparent',
                    )}
                    style={{ backgroundColor: swatch }}
                    onClick={() => setColor(swatch)}
                  >
                    {color === swatch ? <Check className="h-3 w-3 text-white" /> : null}
                  </button>
                ))}
              </div>
              <Button
                type="submit"
                size="sm"
                className="mt-2 w-full"
                disabled={!name.trim() || createTag.isPending}
              >
                {createTag.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Create tag
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
