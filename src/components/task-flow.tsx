import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, Check, Circle, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { getSnapshot, subscribe } from '@/lib/repo';
import {
  abandonFocus,
  completeFocus,
  pauseFocus,
  resumeFocus,
  startFocus,
  toggleFocus,
} from '@/lib/focus-actions';
import {
  elapsedSeconds,
  findCompletedSession,
  findLiveSession,
  findRunningSession,
  formatClock,
  fromSession,
  progressFraction,
  remainingSeconds,
} from '@/lib/timer-machine';
import type { FocusSession, Goal, Task } from '@/types';

const PRIMARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-400 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BTN =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-surface-2 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

const STEP_RANK: Record<string, number> = { scope: 0, execution: 1, polish: 2 };
const STEP_LABEL: Record<string, string> = { scope: 'Scope', execution: 'Execution', polish: 'Polish' };

const STATUS_META: Record<Task['status'], { label: string; Icon: typeof Circle; cls: string }> = {
  todo: { label: 'To do', Icon: Circle, cls: 'border-border text-muted' },
  active: { label: 'Active', Icon: Play, cls: 'border-accent-500 text-accent-400' },
  done: { label: 'Done', Icon: Check, cls: 'border-border text-foreground' },
};

interface Group {
  key: string;
  title: string;
  tasks: Task[];
}

function stepRank(task: Task): number {
  if (task.step === null) return 3;
  return STEP_RANK[task.step] ?? 3;
}

function byStepThenOrder(a: Task, b: Task): number {
  return stepRank(a) - stepRank(b) || a.order - b.order;
}

/** Tasks grouped by goal (newest goal first), each group in step order. */
function groupTasks(goals: Goal[], tasks: Task[]): Group[] {
  const known = new Set(goals.map((g) => g.id));
  const newestFirst = [...goals].sort((a, b) => b.createdAt - a.createdAt);
  const groups: Group[] = [];
  for (const goal of newestFirst) {
    const inGoal = tasks.filter((t) => t.goalId === goal.id).sort(byStepThenOrder);
    if (inGoal.length > 0) groups.push({ key: goal.id, title: goal.title, tasks: inGoal });
  }
  const loose = tasks
    .filter((t) => t.goalId === null || !known.has(t.goalId))
    .sort(byStepThenOrder);
  if (loose.length > 0) groups.push({ key: 'other', title: 'Other tasks', tasks: loose });
  return groups;
}

function chooseSelected(
  pickedId: string | null,
  tasks: Task[],
  ordered: Task[],
  sessions: FocusSession[],
): Task | null {
  const byId = (id: string | null): Task | null =>
    id === null ? null : (tasks.find((t) => t.id === id) ?? null);
  const picked = byId(pickedId);
  if (picked) return picked;
  // After a reload, go straight back to the task that is being timed.
  const running = findRunningSession(sessions);
  if (running) {
    const t = byId(running.taskId);
    if (t) return t;
  }
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (s && s.status === 'paused') {
      const t = byId(s.taskId);
      if (t) return t;
    }
  }
  return ordered.find((t) => t.status !== 'done') ?? ordered[0] ?? null;
}

/** Re-renders once a second, but only while something is running. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);
  return now;
}

function formatActual(seconds: number): string {
  if (seconds < 30) return 'under 1 min';
  return `${Math.round(seconds / 60)} min`;
}

function StatusChip({ status }: { status: Task['status'] }) {
  const { label, Icon, cls } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

function Ring({
  progress,
  label,
  children,
}: {
  progress: number;
  label: string;
  children: ReactNode;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="relative mx-auto h-48 w-48"
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-border"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="text-accent-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function FocusTimer({
  task,
  sessions,
  now,
  onPick,
}: {
  task: Task;
  sessions: FocusSession[];
  now: number;
  onPick: (taskId: string) => void;
}) {
  const live = findLiveSession(sessions, task.id);
  const finished = findCompletedSession(sessions, task.id);
  const state = fromSession(live);
  const status = state.status; // idle, running or paused here
  const isRunning = status === 'running';
  const isLive = live !== null;
  const plannedSeconds = isLive ? state.plannedSeconds : task.durationMinutes * 60;
  const elapsed = elapsedSeconds(state, now);
  const remaining = isLive ? remainingSeconds(state, now) : plannedSeconds;
  const overtime = isLive && elapsed > plannedSeconds;
  const isDone = !isLive && task.status === 'done';
  const progress = isLive ? progressFraction(state, now) : isDone ? 1 : 0;

  // Keep the tab title showing the time left while running.
  useEffect(() => {
    if (!isRunning) return undefined;
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, [isRunning]);
  useEffect(() => {
    if (!isRunning) return;
    document.title = `${formatClock(remaining)} · FocusPulse AI`;
  }, [isRunning, remaining]);

  // Keyboard: Space pauses/resumes, C completes (never while typing).
  const taskId = task.id;
  useEffect(() => {
    if (!isLive) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const tag = el ? el.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (el !== null && el.isContentEditable) return;
      if (e.key === ' ') {
        // On a focused button or link, Space already does its own thing.
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault();
        onPick(taskId);
        toggleFocus(taskId, Date.now());
      } else if (e.key === 'c' || e.key === 'C') {
        onPick(taskId);
        completeFocus(taskId, Date.now());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLive, taskId, onPick]);

  // Any action keeps this task selected, so finishing it still shows its result.
  const run = (action: (id: string, at: number) => void) => () => {
    onPick(task.id);
    action(task.id, Date.now());
  };

  let statusText = `Ready · ${task.durationMinutes} min`;
  if (isRunning) statusText = overtime ? "Time's up. Complete it or keep going." : 'Focusing';
  else if (status === 'paused') statusText = 'Paused';
  else if (isDone) statusText = 'Done';

  const clock = overtime ? `+${formatClock(elapsed - plannedSeconds)}` : formatClock(remaining);

  return (
    <section
      aria-label={`Focus timer for ${task.title}`}
      className="rounded-2xl border border-border bg-gradient-to-br from-surface-2 via-surface to-surface p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-accent-400">Focus timer</p>
      <h2 className="mt-1 text-base font-semibold leading-snug">{task.title}</h2>

      <div className="mt-4">
        <Ring progress={progress} label={`Progress on ${task.title}`}>
          <span className="font-mono text-4xl font-bold tabular-nums text-foreground">
            {isDone ? 'Done' : clock}
          </span>
          <span className="mt-1 text-[11px] uppercase tracking-wider text-muted">
            {isDone ? 'Finished' : overtime ? 'Over time' : 'Left'}
          </span>
        </Ring>
      </div>

      <p aria-live="polite" className="mt-3 text-center text-sm text-muted">
        {statusText}
      </p>

      {isDone && finished !== null ? (
        <p className="mt-1 text-center text-sm font-semibold text-foreground">
          Estimated {task.durationMinutes} min · Actual {formatActual(finished.accumulatedSeconds)}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {!isLive && !isDone ? (
          <button type="button" className={PRIMARY_BTN} onClick={run(startFocus)}>
            <Play size={16} />
            Start
          </button>
        ) : null}
        {!isLive && isDone ? (
          <button type="button" className={SECONDARY_BTN} onClick={run(startFocus)}>
            <RotateCcw size={16} />
            Start again
          </button>
        ) : null}
        {isRunning ? (
          <>
            <button type="button" className={SECONDARY_BTN} onClick={run(pauseFocus)}>
              <Pause size={16} />
              Pause
            </button>
            <button type="button" className={PRIMARY_BTN} onClick={run(completeFocus)}>
              <Check size={16} />
              Complete
            </button>
          </>
        ) : null}
        {status === 'paused' ? (
          <>
            <button type="button" className={PRIMARY_BTN} onClick={run(resumeFocus)}>
              <Play size={16} />
              Resume
            </button>
            <button type="button" className={SECONDARY_BTN} onClick={run(completeFocus)}>
              <Check size={16} />
              Complete
            </button>
          </>
        ) : null}
        {isLive ? (
          <button type="button" className={SECONDARY_BTN} onClick={run(abandonFocus)}>
            <X size={16} />
            Abandon
          </button>
        ) : null}
      </div>

      {isLive ? (
        <p className="mt-3 text-center text-xs text-muted">Space: pause or resume · C: complete</p>
      ) : null}
    </section>
  );
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: () => void;
}) {
  const stepText = task.step !== null ? (STEP_LABEL[task.step] ?? task.category) : task.category;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex min-h-[44px] w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          selected ? 'border-accent-500 bg-surface-2' : 'border-border bg-surface hover:bg-surface-2'
        }`}
      >
        <span className="text-sm font-semibold leading-snug text-foreground">{task.title}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusChip status={task.status} />
          <span>
            {stepText} · {task.durationMinutes} min
          </span>
          {task.source === 'seed' ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">Sample data</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export function TaskFlow({ onBreakDown }: { onBreakDown: () => void }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { goals, tasks, sessions } = snapshot;
  const [pickedId, setPickedId] = useState<string | null>(null);
  const now = useNow(findRunningSession(sessions) !== null);

  const groups = groupTasks(goals, tasks);
  const ordered = groups.flatMap((g) => g.tasks);
  const selected = chooseSelected(pickedId, tasks, ordered, sessions);

  if (tasks.length === 0) {
    return (
      <section className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight">Task Flow</h1>
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border p-8 text-center">
          <Timer size={28} className="text-muted" />
          <p className="mt-3 text-sm text-muted">No tasks yet. Break a goal down to get started.</p>
          <button type="button" className={`${PRIMARY_BTN} mt-4`} onClick={onBreakDown}>
            Break down my goal
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Task Flow</h1>
      <p className="mt-1 text-sm text-muted">Pick a task, then focus on it.</p>

      {selected !== null ? (
        <div className="mt-4">
          <FocusTimer task={selected} sessions={sessions} now={now} onPick={setPickedId} />
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <section key={group.key} aria-label={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</h2>
            <ul className="mt-2 space-y-2">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selected !== null && selected.id === task.id}
                  onSelect={() => setPickedId(task.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}