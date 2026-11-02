import { useQuery } from '@tanstack/react-query';
import { EyeOff, RotateCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { api, ApiError } from '../../lib/api';
import { CardDialog } from '../card/CardDialog';
import { setLastWorkplaceId } from '../workplace/selection';
import { Board } from './Board';
import { CustomizeColumnsDialog } from './CustomizeColumnsDialog';
import { sortedVisibleColumns } from './dnd';

export function BoardPage() {
  const { workplaceId, cardId } = useParams<{ workplaceId: string; cardId?: string }>();
  const navigate = useNavigate();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const boardQuery = useQuery({
    queryKey: ['board', workplaceId],
    queryFn: () => api.getBoard(workplaceId!),
    enabled: Boolean(workplaceId),
  });

  useEffect(() => {
    if (workplaceId) setLastWorkplaceId(workplaceId);
  }, [workplaceId]);

  if (!workplaceId) return null;

  if (boardQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-line px-4 py-3 md:px-6">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
        <div className="flex gap-4 p-4 md:p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="w-[17.5rem] shrink-0 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (boardQuery.isError || !boardQuery.data) {
    const error = boardQuery.error;
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403);

    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-base font-semibold text-ink">
            {notFound ? 'This board is not available' : 'Could not load this board'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {notFound
              ? 'You may have been removed from this workplace, or it no longer exists.'
              : 'Check your connection and try again.'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/app')}>
              Back to your workplaces
            </Button>
            {!notFound ? (
              <Button onClick={() => void boardQuery.refetch()}>
                <RotateCw className="h-4 w-4" />
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const board = boardQuery.data;
  const visibleColumns = sortedVisibleColumns(board.columns);
  const hiddenCount = board.columns.length - visibleColumns.length;
  const isOwner = board.role === 'OWNER';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-canvas/90 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.015em] text-ink">
              {board.workplace.name}
            </h1>
            {!isOwner ? (
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-medium text-muted">
                Member
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {visibleColumns.length} {visibleColumns.length === 1 ? 'column' : 'columns'} ·{' '}
            {board.cards.length} {board.cards.length === 1 ? 'task' : 'tasks'}
            {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isOwner && hiddenCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted"
              onClick={() => setCustomizeOpen(true)}
            >
              <EyeOff className="h-4 w-4" />
              {hiddenCount} hidden
            </Button>
          ) : null}
          {isOwner ? (
            <Button variant="secondary" size="sm" onClick={() => setCustomizeOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Customize
            </Button>
          ) : null}
        </div>
      </header>

      <Board
        board={board}
        workplaceId={workplaceId}
        visibleColumns={visibleColumns}
        isOwner={isOwner}
        onOpenCard={(id) => navigate(`/app/w/${workplaceId}/cards/${id}`)}
        onManageColumns={() => setCustomizeOpen(true)}
      />

      <CustomizeColumnsDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        workplaceId={workplaceId}
        columns={board.columns}
        tags={board.tags}
      />

      {cardId ? (
        <CardDialog
          cardId={cardId}
          workplaceId={workplaceId}
          columns={board.columns}
          tags={board.tags}
          role={board.role}
          onClose={() => navigate(`/app/w/${workplaceId}`)}
        />
      ) : null}
    </div>
  );
}
