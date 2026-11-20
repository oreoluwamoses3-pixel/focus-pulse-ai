import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

function nextFocusMs(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(now.getHours() + 1, 0, 0, 0);
  return target.getTime() - now.getTime();
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Hero({ remainingTasks }: { remainingTasks: number }) {
  const [ms, setMs] = useState(nextFocusMs());

  useEffect(() => {
    const id = window.setInterval(() => setMs(nextFocusMs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="rounded-3xl border border-border bg-gradient-to-br from-surface-2 via-surface to-surface p-6 animate-slide-up">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-400">
        <Flame size={14} />
        Next focus window
      </div>
      <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        {remainingTasks > 0
          ? <>You have <span className="text-accent-400">{remainingTasks}</span> focus blocks left today.</>
          : 'All clear — your focus list is empty.'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        The next deep-work window starts at the top of the hour. Get ready to lock in.
      </p>
      <div className="mt-5 inline-flex items-baseline gap-1 rounded-2xl bg-background/60 px-4 py-3 font-mono text-2xl font-bold tabular-nums text-foreground">
        {fmt(ms)}
      </div>
    </section>
  );
}
