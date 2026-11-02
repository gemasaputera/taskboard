import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useAuth } from '../auth/AuthProvider';
import { NewWorkplaceDialog } from './NewWorkplaceDialog';
import { setLastWorkplaceId } from './selection';

export function WorkplaceSwitcher({ currentWorkplaceId }: { currentWorkplaceId?: string }) {
  const { workplaces } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const current =
    workplaces.find((workplace) => workplace.id === currentWorkplaceId) ?? workplaces[0];

  function select(workplaceId: string) {
    setLastWorkplaceId(workplaceId);
    navigate(`/app/w/${workplaceId}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 min-w-0 gap-2 px-2 text-ink hover:bg-surface-soft"
            aria-label="Switch workplace"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink text-[10px] font-bold text-white">
              {current ? current.name.slice(0, 1).toUpperCase() : 'K'}
            </span>
            <span className="max-w-[9rem] truncate text-[13px] font-medium sm:max-w-[16rem]">
              {current?.name ?? 'No workplace'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Your workplaces</DropdownMenuLabel>
          {workplaces.map((workplace) => (
            <DropdownMenuItem
              key={workplace.id}
              onSelect={() => select(workplace.id)}
              className="justify-between"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={workplace.name} size="xs" />
                <span className="truncate">{workplace.name}</span>
              </span>
              {workplace.id === current?.id ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New workplace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewWorkplaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export function useCurrentWorkplaceId(): string | undefined {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/app\/w\/([^/]+)/);
  return match?.[1];
}
