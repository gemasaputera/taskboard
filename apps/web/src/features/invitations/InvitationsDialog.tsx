import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { api } from '../../lib/api';
import { errorMessage, timeAgo } from '../../lib/utils';
import { useAuth } from '../auth/AuthProvider';
import { setLastWorkplaceId } from '../workplace/selection';

interface InvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvitationsDialog({ open, onOpenChange }: InvitationsDialogProps) {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const invitationsQuery = useQuery({
    queryKey: ['myInvitations'],
    queryFn: () => api.listInvitations(),
    enabled: open,
  });

  const accept = useMutation({
    mutationFn: (invitationId: string) => api.acceptInvitation(invitationId),
    onSuccess: async (result) => {
      await refresh();
      setLastWorkplaceId(result.workplace.id);
      void queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      onOpenChange(false);
      navigate(`/app/w/${result.workplace.id}`);
      toast.success(`Joined ${result.workplace.name}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const decline = useMutation({
    mutationFn: (invitationId: string) => api.declineInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['myInvitations'] });
      toast.success('Invitation declined');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const invitations = invitationsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invitations</DialogTitle>
          <DialogDescription>
            Workplaces other owners invited you to join.
          </DialogDescription>
        </DialogHeader>

        {invitationsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : invitationsQuery.isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-danger">Could not load invitations.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void invitationsQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft text-muted">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-ink">No pending invitations</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
              When a workplace owner invites you, it will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="rounded-xl border border-line bg-surface-soft/60 p-3"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={invitation.workplaceName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {invitation.workplaceName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Invited by {invitation.inviterUsername} · {timeAgo(invitation.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={accept.isPending || decline.isPending}
                    onClick={() => accept.mutate(invitation.id)}
                  >
                    {accept.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    disabled={accept.isPending || decline.isPending}
                    onClick={() => decline.mutate(invitation.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
