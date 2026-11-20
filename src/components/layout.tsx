import type { ReactNode } from 'react';
import { Sparkles, LayoutDashboard, Workflow, Split } from 'lucide-react';
import type { Route } from '@/lib/use-hash-route';
import { DemoBadge } from './demo-badge';

interface LayoutProps {
  route: Route;
  onNavigate: (r: Route) => void;
  hasSeedData: boolean;
  children: ReactNode;
}

const TABS: { route: Route; label: string; icon: typeof LayoutDashboard; desktopLabel: string }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desktopLabel: 'Dashboard' },
  { route: 'flow', label: 'Task Flow', icon: Workflow, desktopLabel: 'Task Flow' },
  { route: 'decomposer', label: 'AI Decomposer', icon: Split, desktopLabel: 'AI Decomposer' },
];

export function Layout({ route, onNavigate, hasSeedData, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 rounded-lg"
            aria-label="FocusPulse AI home"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-500 text-white">
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-bold tracking-tight">FocusPulse AI</span>
          </button>

          <nav className="hidden sm:flex items-center gap-1" aria-label="Primary">
            {TABS.map(({ route: r, desktopLabel, icon: Icon }) => {
              const active = route === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onNavigate(r)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                    active
                      ? 'bg-accent-500/15 text-accent-400'
                      : 'text-muted hover:bg-surface-2 hover:text-foreground'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={16} />
                  {desktopLabel}
                </button>
              );
            })}
          </nav>

          <DemoBadge visible={hasSeedData} />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:pb-12" tabIndex={-1}>
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md sm:hidden"
        aria-label="Primary"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-5xl items-stretch">
          {TABS.map(({ route: r, label, icon: Icon }) => {
            const active = route === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onNavigate(r)}
                className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                  active ? 'text-accent-400' : 'text-muted hover:text-foreground'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} />
                {label}
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-400" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
