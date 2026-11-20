import { useEffect, useState } from 'react';
import { useSyncExternalStore } from 'react';
import { Timer, ArrowRight } from 'lucide-react';
import { getSnapshot, subscribe } from '@/lib/repo';
import { useHashRoute, ROUTE_TITLES } from '@/lib/use-hash-route';
import { Layout } from '@/components/layout';
import { Decomposer } from '@/components/decomposer';
import { TaskFlow } from '@/components/task-flow';
import { DashboardStats } from '@/components/dashboard-stats';
import { DEADLINE } from '@/config';

function App() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [result, navigate] = useHashRoute();

  const hasSeedData = snapshot.tasks.some((t) => t.source === 'seed');
  const route = result.route ?? 'dashboard';

  useEffect(() => {
    document.title = result.notFound
      ? 'Not Found · FocusPulse AI'
      : ROUTE_TITLES[route];
  }, [route, result.notFound]);

  return (
        <Layout route={route} onNavigate={navigate} hasSeedData={hasSeedData}>
      {result.notFound ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">404</h1>
          <p className="mt-2 text-sm text-muted">This page doesn't exist.</p>
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-400 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Home size={16} />
            Back to Dashboard
          </button>
        </div>
      ) : route === 'dashboard' ? (
        <>
          <DashboardHero onNavigate={() => navigate('decomposer')} />
          <DashboardStats />
        </>
      ) : route === 'flow' ? (
        <TaskFlow onBreakDown={() => navigate('decomposer')} />
      ) : route === 'decomposer' ? (
        <Decomposer onSaved={() => navigate('flow')} />
      ) : null}
    </Layout>
  );
}

export default App;

function CountdownValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</span>
    </div>
  );
}

function DashboardHero({ onNavigate }: { onNavigate: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, DEADLINE - Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, DEADLINE - Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const passed = remaining <= 0;
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <section className="animate-fade-in">
      <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        Deconstruct Chaos.<br />
        Execute with Precision.
      </h1>

      <div className="mt-5 rounded-2xl border border-border bg-gradient-to-br from-surface-2 via-surface to-surface p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-400">
          <Timer size={13} />
          {passed ? 'Deadline passed' : 'Time remaining'}
        </div>
        {passed ? (
          <p className="mt-3 text-sm text-muted">The deadline has passed. Time to reflect and reset.</p>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-4 sm:gap-6">
            <CountdownValue label="Days" value={days} />
            <span className="font-mono text-xl font-bold tabular-nums text-border">:</span>
            <CountdownValue label="Hrs" value={hours} />
            <span className="font-mono text-xl font-bold tabular-nums text-border">:</span>
            <CountdownValue label="Min" value={minutes} />
            <span className="font-mono text-xl font-bold tabular-nums text-border">:</span>
            <CountdownValue label="Sec" value={seconds} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNavigate}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-400 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
      >
        Break down my goal
        <ArrowRight size={16} />
      </button>
    </section>
  );
}
