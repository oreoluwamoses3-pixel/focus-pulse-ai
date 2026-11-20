import type { Goal, Snapshot, Task } from '@/types';
import { createSeedSnapshot, SCHEMA_VERSION } from '@/data/seed';

const STORAGE_KEY = 'focuspulse.v1';

let listeners: Array<() => void> = [];
let memorySnapshot: Snapshot | null = null;
let useMemory = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function detectLocalStorageBlocked(): boolean {
  if (!isBrowser()) return true;
  try {
    const testKey = '__fp_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return false;
  } catch {
    return true;
  }
}

useMemory = detectLocalStorageBlocked();

function readFromStorage(): Snapshot | null {
  if (useMemory) return memorySnapshot;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!isValidSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(snapshot: Snapshot): void {
  if (useMemory) {
    memorySnapshot = snapshot;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    useMemory = true;
    memorySnapshot = snapshot;
  }
}

function isValidSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === SCHEMA_VERSION &&
    Array.isArray(v.goals) &&
    Array.isArray(v.tasks) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.promptLogs)
  );
}

let currentSnapshot: Snapshot | null = null;

function getSnapshotInternal(): Snapshot {
  if (currentSnapshot !== null) return currentSnapshot;
  const stored = readFromStorage();
  if (stored !== null) {
    currentSnapshot = stored;
    return currentSnapshot;
  }
  const seed = createSeedSnapshot();
  writeToStorage(seed);
  currentSnapshot = seed;
  return currentSnapshot;
}

function commit(next: Snapshot): void {
  currentSnapshot = next;
  writeToStorage(next);
  emit();
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function handleResetParam(): void {
  if (!isBrowser()) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('reset') === '1') {
    reset();
    url.searchParams.delete('reset');
    window.history.replaceState({}, '', url.toString());
  }
}

if (isBrowser()) {
  handleResetParam();
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    currentSnapshot = null;
    const stored = readFromStorage();
    if (stored) {
      currentSnapshot = stored;
    } else {
      currentSnapshot = createSeedSnapshot();
      writeToStorage(currentSnapshot);
    }
    emit();
  });
}

export function getSnapshot(): Snapshot {
  return getSnapshotInternal();
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function reset(): void {
  const seed = createSeedSnapshot();
  commit(seed);
}

export type Action =
  | { type: 'ADD_GOAL'; title: string; rawInput: string }
  | { type: 'ADD_TASK'; goalId: string | null; title: string; description: string; category: Task['category']; step: Task['step']; order: number; durationMinutes: number }
  | { type: 'UPDATE_TASK_STATUS'; taskId: string; status: Task['status'] }
  | { type: 'REORDER_TASK'; taskId: string; newOrder: number }
  | { type: 'DELETE_TASK'; taskId: string }
  | { type: 'START_SESSION'; taskId: string; plannedSeconds: number }
  | { type: 'PAUSE_SESSION'; sessionId: string; accumulatedSeconds: number }
  | { type: 'RESUME_SESSION'; sessionId: string }
  | { type: 'COMPLETE_SESSION'; sessionId: string; accumulatedSeconds: number }
  | { type: 'ABANDON_SESSION'; sessionId: string; accumulatedSeconds: number }
  | { type: 'LOG_PROMPT'; goalId: string; input: string; engine: 'local-heuristic' | 'llm'; latencyMs: number }
  | { type: 'RESET' };

export function dispatch(action: Action): void {
  const state = getSnapshotInternal();

  switch (action.type) {
    case 'ADD_GOAL': {
      const goal: Goal = {
        id: genId(),
        title: action.title,
        rawInput: action.rawInput,
        createdAt: Date.now(),
      };
      commit({ ...state, goals: [...state.goals, goal] });
      break;
    }

    case 'ADD_TASK': {
      const task: Task = {
        id: genId(),
        goalId: action.goalId,
        title: action.title,
        description: action.description,
        category: action.category,
        step: action.step,
        order: action.order,
        durationMinutes: action.durationMinutes,
        status: 'todo',
        source: 'user',
        createdAt: Date.now(),
        completedAt: null,
      };
      commit({ ...state, tasks: [...state.tasks, task] });
      break;
    }

    case 'UPDATE_TASK_STATUS': {
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId
          ? {
              ...t,
              status: action.status,
              completedAt: action.status === 'done' ? Date.now() : null,
            }
          : t
      );
      commit({ ...state, tasks });
      break;
    }

    case 'REORDER_TASK': {
      const tasks = state.tasks.map((t) =>
        t.id === action.taskId ? { ...t, order: action.newOrder } : t
      );
      commit({ ...state, tasks });
      break;
    }

    case 'DELETE_TASK': {
      commit({ ...state, tasks: state.tasks.filter((t) => t.id !== action.taskId) });
      break;
    }

    case 'START_SESSION': {
      const session = {
        id: genId(),
        taskId: action.taskId,
        plannedSeconds: action.plannedSeconds,
        accumulatedSeconds: 0,
        startedAt: Date.now(),
        status: 'running' as const,
      };
      commit({ ...state, sessions: [...state.sessions, session] });
      break;
    }

    case 'PAUSE_SESSION': {
      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? { ...s, status: 'paused' as const, accumulatedSeconds: action.accumulatedSeconds, startedAt: null }
          : s
      );
      commit({ ...state, sessions });
      break;
    }

    case 'RESUME_SESSION': {
      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? { ...s, status: 'running' as const, startedAt: Date.now() }
          : s
      );
      commit({ ...state, sessions });
      break;
    }

    case 'COMPLETE_SESSION': {
      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? { ...s, status: 'completed' as const, accumulatedSeconds: action.accumulatedSeconds, startedAt: null }
          : s
      );
      commit({ ...state, sessions });
      break;
    }

    case 'ABANDON_SESSION': {
      const sessions = state.sessions.map((s) =>
        s.id === action.sessionId
          ? { ...s, status: 'abandoned' as const, accumulatedSeconds: action.accumulatedSeconds, startedAt: null }
          : s
      );
      commit({ ...state, sessions });
      break;
    }

    case 'LOG_PROMPT': {
      const log = {
        id: genId(),
        goalId: action.goalId,
        input: action.input,
        engine: action.engine,
        latencyMs: action.latencyMs,
        createdAt: Date.now(),
      };
      commit({ ...state, promptLogs: [...state.promptLogs, log] });
      break;
    }

    case 'RESET': {
      reset();
      break;
    }
  }
}

export { STORAGE_KEY, useMemory as storageBlocked };
// ---- Paste this at the very END of src/lib/repo.ts (after the last line) ----

export interface GeneratedPlanInput {
  goalTitle: string;
  rawInput: string;
  steps: Array<{
    step: 'scope' | 'execution' | 'polish';
    title: string;
    description: string;
    category: Task['category'];
    durationMinutes: number;
  }>;
  engine: 'local-heuristic' | 'llm';
  latencyMs: number;
}

/** Saves one goal, its tasks (source "generated"), and a prompt log in a single update. Returns the new goal id. */
export function addGeneratedPlan(plan: GeneratedPlanInput): string {
  const state = getSnapshotInternal();
  const now = Date.now();
  const goalId = genId();

  const goal: Goal = {
    id: goalId,
    title: plan.goalTitle,
    rawInput: plan.rawInput,
    createdAt: now,
  };

  const tasks: Task[] = plan.steps.map(
    (s, index): Task => ({
      id: genId(),
      goalId,
      title: s.title,
      description: s.description,
      category: s.category,
      step: s.step,
      order: index + 1,
      durationMinutes: s.durationMinutes,
      status: 'todo',
      source: 'generated',
      createdAt: now,
      completedAt: null,
    }),
  );

  const log: Snapshot['promptLogs'][number] = {
    id: genId(),
    goalId,
    input: plan.rawInput,
    engine: plan.engine,
    latencyMs: plan.latencyMs,
    createdAt: now,
  };

  commit({
    ...state,
    goals: [...state.goals, goal],
    tasks: [...state.tasks, ...tasks],
    promptLogs: [...state.promptLogs, log],
  });

  return goalId;
}