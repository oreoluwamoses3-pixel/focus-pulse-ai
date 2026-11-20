import { useEffect, useState, useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from '@/lib/repo';
import { elapsedSeconds, findRunningSession, fromSession } from '@/lib/timer-machine';

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function DashboardStats() {
  const { tasks, sessions } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const running = findRunningSession(sessions) !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running]);

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const plannedMinutes = tasks.reduce((sum, t) => sum + t.durationMinutes, 0);
  const focusSeconds = sessions.reduce((sum, s) => sum + elapsedSeconds(fromSession(s), now), 0);

  return (
    <section aria-label="Your progress" className="mt-4 grid grid-cols-3 gap-3">
      <Tile label="Done" value={`${doneCount}/${tasks.length}`} />
      <Tile label="Planned" value={formatDuration(plannedMinutes)} />
      <Tile label="Focused" value={formatDuration(Math.floor(focusSeconds / 60))} />
    </section>
  );
}