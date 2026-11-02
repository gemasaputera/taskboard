import type { BoardColumnDto, Role, TagDto } from '@kanban/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Input, Textarea } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { api, ApiError } from '../../lib/api';
import { cn, errorMessage, formatDate, timeAgo } from '../../lib/utils';
import { useAuth } from '../auth/AuthProvider';
import { AssigneePicker } from './AssigneePicker';
import { CommentSection } from './CommentSection';
import { Markdown } from './Markdown';
import { SubtaskList } from './SubtaskList';
import { TagPicker } from './TagPicker';

interface CardDialogProps {
  cardId: string;
  workplaceId: string;
  columns: BoardColumnDto[];
  tags: TagDto[];
  role: Role;
  onClose: () => void;
}

export function CardDialog({
  cardId,
  workplaceId,
  columns,
  tags,
  role,
  onClose,
}: CardDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionPreview, setDescriptionPreview] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const cardQuery = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => api.getCard(cardId),
  });

  const membersQuery = useQuery({
    queryKey: ['members', workplaceId],
    queryFn: () => api.getMembers(workplaceId),
  });

  const card = cardQuery.data;
  const column = card ? columns.find((candidate) => candidate.id === card.columnId) : undefined;

  useEffect(() => {
    if (card && !editingTitle) setTitle(card.title);
  }, [card, editingTitle]);

  useEffect(() => {
    if (card && !editingDescription) setDescription(card.description ?? '');
  }, [card, editingDescription]);

  function invalidateCard() {
    void queryClient.invalidateQueries({ queryKey: ['card', cardId] });
  }

  function invalidateBoard() {
    void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
  }

  const saveTitle = useMutation({
    mutationFn: (nextTitle: string) => api.updateCard(cardId, { title: nextTitle }),
    onSuccess: () => {
      invalidateCard();
      invalidateBoard();
    },
    onError: (error) => {
      setTitle(card?.title ?? '');
      toast.error(errorMessage(error));
    },
  });

  const saveDescription = useMutation({
    mutationFn: (nextDescription: string | null) =>
      api.updateCard(cardId, { description: nextDescription }),
    onSuccess: () => {
      invalidateCard();
      invalidateBoard();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const moveCard = useMutation({
    mutationFn: (columnId: string) => api.moveCard(cardId, columnId, 0),
    onSuccess: () => {
      invalidateCard();
      invalidateBoard();
      toast.success('Card moved');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteCard = useMutation({
    mutationFn: () => api.deleteCard(cardId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['card', cardId] });
      invalidateBoard();
      toast.success('Card deleted');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function commitTitle() {
    if (!card) return;
    const next = title.trim();
    setEditingTitle(false);

    if (!next) {
      setTitle(card.title);
      toast.error('A card needs a title.');
      return;
    }

    if (next !== card.title) saveTitle.mutate(next);
  }

  function startDescriptionEditing() {
    setDescription(card?.description ?? '');
    setDescriptionPreview(false);
    setEditingDescription(true);
  }

  function cancelDescriptionEditing() {
    setDescription(card?.description ?? '');
    setDescriptionPreview(false);
    setEditingDescription(false);
  }

  function saveDescriptionNow() {
    const next = description.trim();
    setDescriptionPreview(false);
    setEditingDescription(false);
    if (next === (card?.description ?? '')) return;
    saveDescription.mutate(next || null);
  }

  const dialogs = (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this card?</AlertDialogTitle>
          <AlertDialogDescription>
            The card and its subtasks, tags, and comments will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            destructive
            disabled={deleteCard.isPending}
            onClick={() => deleteCard.mutate()}
          >
            Delete card
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-3xl gap-0 p-0">
          <DialogTitle className="sr-only">{card?.title ?? 'Task detail'}</DialogTitle>
          <DialogDescription className="sr-only">
            Task detail with description, subtasks, tags, and comments.
          </DialogDescription>

          {cardQuery.isLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-2/3" />
              <div className="grid gap-6 pt-4 md:grid-cols-[1fr_15rem]">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ) : cardQuery.isError || !card ? (
            <div className="p-8 text-center">
              <p className="text-base font-semibold text-ink">
                {cardQuery.error instanceof ApiError && cardQuery.error.status === 404
                  ? 'This card is not available'
                  : 'Could not load this card'}
              </p>
              <p className="mt-1.5 text-sm text-muted">
                {cardQuery.error instanceof ApiError && cardQuery.error.status === 404
                  ? 'It may have been deleted or you no longer have access.'
                  : 'Check your connection and try again.'}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Button variant="secondary" onClick={onClose}>
                  Close
                </Button>
                {!(cardQuery.error instanceof ApiError && cardQuery.error.status === 404) ? (
                  <Button onClick={() => void cardQuery.refetch()}>
                    <RotateCw className="h-4 w-4" />
                    Retry
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
                <div className="flex items-start gap-2 pr-9">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-soft px-2 py-0.5 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {column?.name ?? 'Unknown column'}
                        {column?.isHidden ? ' · hidden' : ''}
                      </span>
                      <span>Updated {timeAgo(card.updatedAt)}</span>
                    </div>

                    {editingTitle ? (
                      <Input
                        autoFocus
                        value={title}
                        maxLength={200}
                        className="mt-1 h-10 border-0 px-0 text-xl font-semibold tracking-[-0.01em] shadow-none focus-visible:ring-0"
                        onChange={(event) => setTitle(event.target.value)}
                        onBlur={commitTitle}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitTitle();
                          }
                          if (event.key === 'Escape') {
                            setTitle(card.title);
                            setEditingTitle(false);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="mt-1 block w-full rounded-md text-left text-xl font-semibold tracking-[-0.01em] text-ink hover:bg-surface-soft"
                        onClick={() => setEditingTitle(true)}
                        title="Rename card"
                      >
                        {title}
                      </button>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Card actions"
                        className="text-muted"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Move to</DropdownMenuLabel>
                      {columns.filter((candidate) => candidate.id !== card.columnId).length ===
                      0 ? (
                        <DropdownMenuItem disabled>No other columns</DropdownMenuItem>
                      ) : (
                        columns
                          .filter((candidate) => candidate.id !== card.columnId)
                          .map((candidate) => (
                            <DropdownMenuItem
                              key={candidate.id}
                              onSelect={() => moveCard.mutate(candidate.id)}
                            >
                              {candidate.name}
                              {candidate.isHidden ? ' (hidden)' : ''}
                            </DropdownMenuItem>
                          ))
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        Delete card
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid gap-7 px-6 py-5 md:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="min-w-0 space-y-7">
                  <section aria-labelledby="description-heading">
                    <div className="flex items-center justify-between">
                      <h3 id="description-heading" className="text-[13px] font-semibold text-ink">
                        Description
                      </h3>
                      {!editingDescription ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted"
                          aria-label="Edit description"
                          onClick={startDescriptionEditing}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>

                    {editingDescription ? (
                      <div className="mt-2">
                        <div className="mb-2 inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-soft p-0.5">
                          <button
                            type="button"
                            className={cn(
                              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                              !descriptionPreview
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-muted hover:text-ink',
                            )}
                            onClick={() => setDescriptionPreview(false)}
                          >
                            Write
                          </button>
                          <button
                            type="button"
                            className={cn(
                              'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                              descriptionPreview
                                ? 'bg-surface text-ink shadow-sm'
                                : 'text-muted hover:text-ink',
                            )}
                            onClick={() => setDescriptionPreview(true)}
                          >
                            Preview
                          </button>
                        </div>

                        {descriptionPreview ? (
                          <div className="min-h-28 rounded-lg border border-line bg-surface-soft/40 p-3">
                            {description.trim() ? (
                              <Markdown content={description} />
                            ) : (
                              <p className="text-xs text-muted">Nothing to preview yet.</p>
                            )}
                          </div>
                        ) : (
                          <>
                            <Textarea
                              autoFocus
                              rows={6}
                              value={description}
                              maxLength={10_000}
                              placeholder="Write in Markdown — **bold**, _italic_, lists, [links](https://…), `code`…"
                              className="text-[13px]"
                              onChange={(event) => setDescription(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') cancelDescriptionEditing();
                                if (
                                  event.key === 'Enter' &&
                                  (event.metaKey || event.ctrlKey)
                                ) {
                                  event.preventDefault();
                                  saveDescriptionNow();
                                }
                              }}
                            />
                            <p className="mt-1 text-[10.5px] text-muted">
                              Markdown supported · ⌘/Ctrl + Enter to save
                            </p>
                          </>
                        )}

                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={saveDescriptionNow}
                            disabled={saveDescription.isPending}
                          >
                            {saveDescription.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelDescriptionEditing}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : card.description ? (
                      <Markdown content={card.description} className="mt-2" />
                    ) : (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-lg border border-dashed border-line bg-surface-soft/60 px-3 py-3 text-left text-xs text-muted transition-colors hover:border-line hover:bg-surface-soft"
                        onClick={startDescriptionEditing}
                      >
                        Add a more detailed description… (Markdown supported)
                      </button>
                    )}
                  </section>

                  <SubtaskList
                    cardId={cardId}
                    workplaceId={workplaceId}
                    subtasks={card.subtasks}
                  />

                  <CommentSection
                    cardId={cardId}
                    workplaceId={workplaceId}
                    comments={card.comments}
                    currentUserId={user?.id ?? ''}
                    role={role}
                  />
                </div>

                <aside className="space-y-5 md:border-l md:border-line md:pl-5">
                  <AssigneePicker
                    workplaceId={workplaceId}
                    card={card}
                    members={membersQuery.data ?? []}
                    membersLoading={membersQuery.isLoading}
                  />

                  <TagPicker workplaceId={workplaceId} card={card} boardTags={tags} />

                  <div className="space-y-2.5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Created {formatDate(card.createdAt)}
                    </p>
                    <p className="pl-5">Updated {timeAgo(card.updatedAt)}</p>
                    <p className="flex items-center gap-2">
                      <Avatar name={card.createdBy.username} size="xs" />
                      Created by {card.createdBy.username}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    className="justify-start px-0 text-danger hover:bg-danger-soft"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete card
                  </Button>
                </aside>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}
