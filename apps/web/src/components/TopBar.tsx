import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { cn } from '../lib/utils';
import { useAuth } from '../features/auth/AuthProvider';
import { InvitationsDialog } from '../features/invitations/InvitationsDialog';
import { MembersDialog } from '../features/members/MembersDialog';
import { WorkplaceSwitcher, useCurrentWorkplaceId } from '../features/workplace/WorkplaceSwitcher';

export function TopBar() {
  const { user, workplaces, logout } = useAuth();
  const navigate = useNavigate();
  const currentWorkplaceId = useCurrentWorkplaceId();
  const currentWorkplace = workplaces.find((workplace) => workplace.id === currentWorkplaceId);

  const [membersOpen, setMembersOpen] = useState(false);
  const [invitationsOpen, setInvitationsOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  const invitationsQuery = useQuery({
    queryKey: ['myInvitations'],
    queryFn: () => api.listInvitations(),
    enabled: Boolean(user),
    retry: false,
  });

  const invitationCount = invitationsQuery.data?.length ?? 0;

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [user?.id]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2.5 md:gap-2 md:px-4">
      <Link
        to="/app"
        className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label="Kanban home"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
          K
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight text-ink sm:block">
          Kanban
        </span>
      </Link>

      <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />

      <WorkplaceSwitcher currentWorkplaceId={currentWorkplaceId} />

      <div className="ml-auto flex items-center gap-1">
        <span
          className="mr-1 hidden items-center gap-1.5 rounded-full border border-line bg-surface-soft px-2 py-1 text-[10.5px] font-medium text-muted lg:inline-flex"
          title={connected ? 'Live sync connected' : 'Reconnecting to live sync'}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-amber-500',
            )}
            aria-hidden
          />
          {connected ? 'Live' : 'Reconnecting'}
        </span>

        {currentWorkplaceId ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted"
            onClick={() => setMembersOpen(true)}
            aria-label="Workplace members"
          >
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Members</span>
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted"
          onClick={() => setInvitationsOpen(true)}
          aria-label={
            invitationCount > 0
              ? `Invitations, ${invitationCount} pending`
              : 'Invitations'
          }
        >
          <Bell className="h-4 w-4" />
          {invitationCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">
              {invitationCount > 9 ? '9+' : invitationCount}
            </span>
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
              aria-label="Account menu"
            >
              <Avatar name={user?.username ?? '?'} size="sm" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="px-2.5 pb-2">
              <p className="truncate text-[13px] font-semibold text-ink">{user?.username}</p>
              <p className="truncate text-[11px] text-muted">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            {currentWorkplace ? (
              <div className="px-2.5 py-1.5 text-[11px] text-muted">
                {currentWorkplace.name} ·{' '}
                {currentWorkplace.role === 'OWNER' ? 'Owner' : 'Member'}
              </div>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {currentWorkplaceId ? (
        <MembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          workplaceId={currentWorkplaceId}
          role={currentWorkplace?.role ?? 'MEMBER'}
        />
      ) : null}

      <InvitationsDialog open={invitationsOpen} onOpenChange={setInvitationsOpen} />
    </header>
  );
}
