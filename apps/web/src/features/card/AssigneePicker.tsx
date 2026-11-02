import type { CardDetailDto, MemberDto } from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/utils';

interface AssigneePickerProps {
  workplaceId: string;
  card: CardDetailDto;
  members: MemberDto[];
  membersLoading?: boolean;
}

export function AssigneePicker({
  workplaceId,
  card,
  members,
  membersLoading = false,
}: AssigneePickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const selected = new Set(card.assignees.map((assignee) => assignee.id));

  const setAssignees = useMutation({
    mutationFn: (userIds: string[]) => api.setCardAssignees(card.id, userIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['card', card.id] });
      void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function toggle(userId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(userId);
    else next.delete(userId);
    setAssignees.mutate([...next]);
  }

  return (
    <section aria-labelledby="assignees-heading">
      <div className="flex items-center justify-between gap-2">
        <h3 id="assignees-heading" className="text-[13px] font-semibold text-ink">
          Assigned
        </h3>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={card.assignees.length === 0 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2 text-muted"
              title={card.assignees.length === 0 ? 'Assign members' : 'Edit assignees'}
              aria-label={card.assignees.length === 0 ? 'Assign members' : 'Edit assignees'}
            >
              {card.assignees.length === 0 ? (
                <>
                  <Users className="h-3.5 w-3.5" />
                  Assign
                </>
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-64">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Workplace members
            </p>

            {membersLoading ? (
              <div className="flex items-center justify-center py-5 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="py-2 text-xs text-muted">No members found.</p>
            ) : (
              <div className="max-h-60 space-y-0.5 overflow-y-auto">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-xs text-ink hover:bg-surface-soft"
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest('[role="checkbox"]') || setAssignees.isPending) return;
                      toggle(member.userId, !selected.has(member.userId));
                    }}
                  >
                    <Checkbox
                      checked={selected.has(member.userId)}
                      disabled={setAssignees.isPending}
                      onCheckedChange={(checked) => toggle(member.userId, checked === true)}
                    />
                    <Avatar name={member.username} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{member.username}</span>
                    {member.role === 'OWNER' ? (
                      <span className="shrink-0 text-[9.5px] font-medium uppercase tracking-[0.06em] text-muted">
                        owner
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}

            {setAssignees.isPending ? (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </p>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>

      {card.assignees.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">Unassigned</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.assignees.map((assignee) => (
            <span
              key={assignee.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-ink"
            >
              <Avatar name={assignee.username} size="xs" />
              {assignee.username}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
