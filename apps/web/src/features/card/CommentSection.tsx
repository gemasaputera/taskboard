import type { CommentDto, Role } from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/input';
import { api } from '../../lib/api';
import { errorMessage, timeAgo } from '../../lib/utils';

interface CommentSectionProps {
  cardId: string;
  workplaceId: string;
  comments: CommentDto[];
  currentUserId: string;
  role: Role;
}

export function CommentSection({
  cardId,
  workplaceId,
  comments,
  currentUserId,
  role,
}: CommentSectionProps) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['card', cardId] });
    void queryClient.invalidateQueries({ queryKey: ['board', workplaceId] });
  }

  const create = useMutation({
    mutationFn: (text: string) => api.createComment(cardId, text),
    onSuccess: () => {
      setBody('');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.updateComment(id, text),
    onSuccess: () => {
      setEditingId(null);
      setEditBody('');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    const text = body.trim();
    if (text && !create.isPending) create.mutate(text);
  }

  return (
    <section aria-labelledby="comments-heading">
      <div className="flex items-center justify-between">
        <h3 id="comments-heading" className="text-[13px] font-semibold text-ink">
          Comments
        </h3>
        {comments.length > 0 ? (
          <span className="text-[11px] font-medium tabular-nums text-muted">
            {comments.length}
          </span>
        ) : null}
      </div>

      {comments.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {comments.map((comment) => {
            const isAuthor = comment.author.id === currentUserId;
            const canDelete = isAuthor || role === 'OWNER';
            const isEditing = editingId === comment.id;

            return (
              <li key={comment.id} className="flex gap-2.5">
                <Avatar name={comment.author.username} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold text-ink">
                      {isAuthor ? 'You' : comment.author.username}
                    </span>
                    <span className="text-[10.5px] text-muted">{timeAgo(comment.createdAt)}</span>
                    {comment.updatedAt !== comment.createdAt ? (
                      <span className="text-[10.5px] text-muted/70">(edited)</span>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-1.5">
                      <Textarea
                        autoFocus
                        rows={2}
                        value={editBody}
                        className="min-h-16 text-[13px]"
                        onChange={(event) => setEditBody(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            const text = editBody.trim();
                            if (text) update.mutate({ id: comment.id, text });
                          }
                          if (event.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <Button
                          size="sm"
                          disabled={!editBody.trim() || update.isPending}
                          onClick={() => {
                            const text = editBody.trim();
                            if (text) update.mutate({ id: comment.id, text });
                          }}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">
                      {comment.body}
                    </p>
                  )}

                  {!isEditing ? (
                    <div className="mt-1 flex items-center gap-3">
                      {isAuthor ? (
                        <button
                          type="button"
                          className="text-[10.5px] font-medium text-muted transition-colors hover:text-ink"
                          onClick={() => {
                            setEditingId(comment.id);
                            setEditBody(comment.body);
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted transition-colors hover:text-danger"
                          onClick={() => remove.mutate(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 rounded-xl border border-line bg-surface-soft/60 p-2.5">
        <Textarea
          rows={2}
          value={body}
          placeholder="Write a comment…"
          className="min-h-14 resize-none border-0 bg-transparent px-1 py-0.5 shadow-none focus-visible:ring-0"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10.5px] text-muted/70">⌘/Ctrl + Enter to send</span>
          <Button size="sm" disabled={!body.trim() || create.isPending} onClick={submit}>
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}
