import { APP_NAME } from '@kanban/shared';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

const DOCS_URL = 'https://kanbantask.readme.io';
const GITHUB_URL = 'https://github.com/gemasaputera/taskboard';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const groups: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Board', href: '/app' },
      { label: 'Documentation', href: DOCS_URL, external: true },
      { label: 'MCP server', href: `${DOCS_URL}/docs/mcp`, external: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Quick start', href: `${DOCS_URL}/docs/quickstart`, external: true },
      { label: 'REST API', href: `${DOCS_URL}/docs/rest-api`, external: true },
      { label: 'Report an issue', href: `${GITHUB_URL}/issues`, external: true },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: GITHUB_URL, external: true },
      { label: 'Contributing', href: `${GITHUB_URL}#contributing`, external: true },
      { label: 'License', href: `${GITHUB_URL}/blob/main/LICENSE`, external: true },
    ],
  },
];

export function SiteFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn('border-t border-line bg-surface text-ink', className)}>
      <div className="mx-auto grid w-full max-w-6xl gap-9 px-5 py-10 sm:px-10 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-12 lg:px-16">
        <div className="max-w-xs">
          <Link
            to="/app"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label={`${APP_NAME} home`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-sm font-bold text-white">
              K
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-ink">{APP_NAME}</span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            One workplace, four clear lanes, and every task moving live with the people who care
            about it.
          </p>
        </div>

        <nav
          className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3"
          aria-label="Footer navigation"
        >
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                {group.title}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <p>
            © {year} {APP_NAME}. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Built for small teams
          </p>
        </div>
      </div>
    </footer>
  );
}
