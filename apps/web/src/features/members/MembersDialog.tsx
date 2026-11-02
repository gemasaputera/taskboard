import type { MemberDto, Role } from '@kanban/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/utils';
import { useAuth } from '../auth/AuthProvider';

interface MembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workplaceId: string;
  role: Role;
}

export function MembersDialog({ open, onOpenChange, workplaceId, role }: MembersDialogProps) {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberDto | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['members', workplaceId],
    queryFn: () => api.getMembers(workplaceId),
    enabled: open,
  });

  const invitesQuery = useQuery({
    queryKey: ['workplaceInvitations', workplaceId],
    queryFn: () => api.listWorkplaceInvitations(workplaceId),
    enabled: open && role === 'OWNER',
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['members', workplaceId] });
    void queryClient.invalidateQueries({ queryKey: ['workplaceInvitations', workplaceId] });
  }

  const invite = useMutation({
    mutationFn: (value: string) => api.invite(workplaceId, value),
    onSuccess: () => {
      setIdentifier('');
      setInviteError(null);
      invalidate();
      toast.success('Invitation sent');
    },
    onError: (error) => {
      setInviteError(errorMessage(error));
      toast.error(errorMessage(error));
    },
  });

  const cancelInvite = useMutation({
    mutationFn: (invitationId: string) => api.cancelInvitation(invitationId),
    onSuccess: () => {
      invalidate();
      toast.success('Invitation cancelled');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeMember(workplaceId, userId),
    onSuccess: async () => {
      setRemoveTarget(null);
      invalidate();
      await refresh();
      toast.success('Member removed');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const leave = useMutation({
    mutationFn: () => api.leaveWorkplace(workplaceId),
    onSuccess: async () => {
      setLeaveOpen(false);
      onOpenChange(false);
      await refresh();
      navigate('/app');
      toast.success('You left the workplace');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Workplace members</DialogTitle>
            <DialogDescription>
              {role === 'OWNER'
                ? 'Invite registered users by exact username or email.'
                : 'People with access to this board.'}
            </DialogDescription>
          </DialogHeader>

          {role === 'OWNER' ? (
            <form
              className="mb-5 rounded-xl border border-line bg-surface-soft/70 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const value = identifier.trim();
                if (value && !invite.isPending) invite.mutate(value);
              }}
            >
              <label
                htmlFor="invite-identifier"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Invite someone
              </label>
              <div className="flex gap-2">
                <Input
                  id="invite-identifier"
                  value={identifier}
                  placeholder="username or email"
                  className="h-8 text-[13px]"
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    setInviteError(null);
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={!identifier.trim() || invite.isPending}
                >
                  {invite.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Invite
                </Button>
              </div>
              {inviteError ? <p className="mt-1.5 text-xs text-danger">{inviteError}</p> : null}
            </form>
          ) : null}

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Members {membersQuery.data ? `(${membersQuery.data.length})` : ''}
            </h3>

            {membersQuery.isLoading ? (
              <p className="py-4 text-center text-xs text-muted">Loading members…</p>
            ) : membersQuery.isError ? (
              <p className="py-4 text-center text-xs text-danger">Could not load members.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {(membersQuery.data ?? []).map((member) => (
                  <li key={member.id} className="flex items-center gap-3 py-2.5">
                    <Avatar name={member.username} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {member.username}
                        {member.userId === user?.id ? (
                          <span className="ml-1 text-[10.5px] font-normal text-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {member.email ?? `Joined ${formatDate(member.joinedAt)}`}
                      </p>
                    </div>
                    <Badge variant={member.role === 'OWNER' ? 'default' : 'neutral'}>
                      {member.role === 'OWNER' ? 'Owner' : 'Member'}
                    </Badge>
                    {role === 'OWNER' &&
                    member.role !== 'OWNER' &&
                    member.userId !== user?.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted hover:text-danger"
                        aria-label={`Remove ${member.username}`}
                        onClick={() => setRemoveTarget(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {role === 'OWNER' ? (
            <section className="mt-5 border-t border-line pt-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Pending invitations{' '}
                {invitesQuery.data ? `(${invitesQuery.data.length})` : ''}
              </h3>
              {invitesQuery.isLoading ? (
                <p className="py-3 text-center text-xs text-muted">Loading invitations…</p>
              ) : (invitesQuery.data ?? []).length === 0 ? (
                <p className="py-2 text-xs text-muted">No pending invitations.</p>
              ) : (
                <ul className="space-y-1">
                  {(invitesQuery.data ?? []).map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center gap-2 rounded-lg px-1 py-1.5"
                    >
                      <Avatar name={invitation.inviteeUsername ?? '?'} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                        {invitation.inviteeUsername}
                      </span>
                      <span className="text-[10.5px] text-muted">
                        {formatDate(invitation.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted"
                        aria-label="Cancel invitation"
                        onClick={() => cancelInvite.mutate(invitation.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {role === 'MEMBER' ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-xs leading-relaxed text-muted">
                Leave this workplace and lose access to its board.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 text-danger"
                onClick={() => setLeaveOpen(true)}
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(removeTarget)}
        onOpenChange={(next) => !next && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will immediately lose access to this workplace. Their cards and comments stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={removeMember.isPending}
              onClick={() => removeTarget && removeMember.mutate(removeTarget.userId)}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this workplace?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need another invitation to get back in. This cannot be undone from your side.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              destructive
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
            >
              Leave workplace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
