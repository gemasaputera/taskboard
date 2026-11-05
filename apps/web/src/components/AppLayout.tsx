import { Outlet } from 'react-router-dom';
import { useSeo } from '../lib/seo';
import { TopBar } from './TopBar';

export function AppLayout() {
  // Signed-in surfaces are private; keep them out of search and AI indexes even
  // though the SPA shell itself is also used by the public auth pages.
  useSeo({
    title: 'Your board · Kanban',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <TopBar />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
