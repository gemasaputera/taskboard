import { APP_NAME } from '@kanban/shared';
import { ArrowRight, CheckCircle2, GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiteFooter } from '../../components/SiteFooter';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const previewCards = [
  { title: 'Polish onboarding copy', tag: 'Revision', tagClass: 'bg-[#fdf0d5] text-[#8a5a00]' },
  { title: 'Ship the board filters', tag: 'On Progress', tagClass: 'bg-[#e6eefc] text-[#1e40af]' },
  { title: 'Invite the design crew', tag: 'To Do', tagClass: 'bg-[#f1f0ed] text-[#57534e]' },
];

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh grid-rows-[1fr_auto] bg-canvas lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="auth-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-base font-bold text-ink">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="relative mt-24 max-w-lg">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
            A calmer way to ship
          </p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] xl:text-5xl">
            The board your team
            <br />
            actually keeps in sync.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
            One workplace, four clear lanes, and every task — checklist, tags, comments — moving
            live with the people who care about it.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-white/40" />
              Drag-and-drop that stays in sync
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-white/40" />
              Owner-controlled columns and invites
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-white/40" />
              Subtasks, tags, and threaded comments
            </li>
          </ul>
        </div>

        <div className="relative mt-auto w-full max-w-sm">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">
              <span>On Progress</span>
              <span>3</span>
            </div>
            <div className="space-y-2">
              {previewCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl bg-white p-3 text-ink shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-line" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{card.title}</p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.tagClass}`}
                      >
                        {card.tag}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/35">
            <ArrowRight className="h-3.5 w-3.5" />
            Live for everyone in the workplace
          </p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-base font-bold text-white">
            K
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
          </div>

          {children}

          <div className="mt-8 text-sm text-muted">{footer}</div>
        </div>
      </main>

      <SiteFooter className="lg:col-span-2" />
    </div>
  );
}
