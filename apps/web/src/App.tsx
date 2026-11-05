import { APP_NAME } from '@kanban/shared';
import { Loader2, Plus } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import {
  createBrowserRouter,
  Link,
  Navigate,
  RouterProvider,
  useSearchParams,
} from 'react-router-dom';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/toaster';
import { SiteFooter } from './components/SiteFooter';
import { useAuth } from './features/auth/AuthProvider';
import { AuthProvider } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { NewWorkplaceDialog } from './features/workplace/NewWorkplaceDialog';
import { getLastWorkplaceId } from './features/workplace/selection';
import { AppLayout } from './components/AppLayout';
import { useSeo } from './lib/seo';

const BoardPage = lazy(() =>
  import('./features/board/BoardPage').then((module) => ({ default: module.BoardPage })),
);

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="flex items-center gap-3 text-muted">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-base font-bold text-white">
          K
        </span>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading {APP_NAME}…</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('next');

  if (loading) return <Splash />;
  // Keep the login page mounted during an OAuth return trip so the submit handler
  // can hand off to the API authorize URL instead of racing a redirect to /app.
  if (user && !returnTo) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return <Navigate to={user ? '/app' : '/login'} replace />;
}

function BoardFallback() {
  return (
    <div className="flex h-full gap-4 p-4 md:p-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-48 w-[85vw] shrink-0 animate-pulse rounded-xl border border-line bg-surface-soft sm:w-[17.5rem]"
        />
      ))}
    </div>
  );
}

function NoWorkplacePage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-lg font-bold text-white">
          K
        </span>
        <h1 className="text-lg font-semibold text-ink">No workplaces yet</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Create a workplace to get a board with To Do, Revision, On Progress, and Done.
        </p>
        <Button className="mt-5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create workplace
        </Button>
        <NewWorkplaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </div>
  );
}

function WorkplaceRedirect() {
  const { workplaces } = useAuth();
  const last = getLastWorkplaceId();
  const target = workplaces.find((workplace) => workplace.id === last) ?? workplaces[0];

  if (!target) return <NoWorkplacePage />;
  return <Navigate to={`/app/w/${target.id}`} replace />;
}

function NotFoundPage() {
  const { user } = useAuth();
  useSeo({
    title: 'Page not found · Kanban',
    description: 'The page you are looking for does not exist or has moved.',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">404</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">Page not found</h1>
          <p className="mt-1.5 text-sm text-muted">
            The page you’re looking for doesn’t exist or has moved.
          </p>
          <Link
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent/90"
            to={user ? '/app' : '/login'}
          >
            Go to {user ? 'your board' : 'sign in'}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnly>
        <RegisterPage />
      </PublicOnly>
    ),
  },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <WorkplaceRedirect /> },
      {
        path: 'w/:workplaceId',
        element: (
          <Suspense fallback={<BoardFallback />}>
            <BoardPage />
          </Suspense>
        ),
      },
      {
        path: 'w/:workplaceId/cards/:cardId',
        element: (
          <Suspense fallback={<BoardFallback />}>
            <BoardPage />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  );
}
