import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { getSnapshot, subscribe, dispatch, reset } from '@/lib/repo';
import { SEED_TASK_COUNT, SEED_GOAL_COUNT } from '@/data/seed';

const STORAGE_KEY = 'focuspulse.v1';

function setRawStorage(value: string | null): void {
  if (value === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
}

function clearModuleCache(): void {
  vi.resetModules();
}

describe('repo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearModuleCache();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads seed data on first access', () => {
    const snap = getSnapshot();
    expect(snap.goals).toHaveLength(SEED_GOAL_COUNT);
    expect(snap.tasks).toHaveLength(SEED_TASK_COUNT);
    expect(snap.sessions).toEqual([]);
    expect(snap.promptLogs).toEqual([]);
  });

  it('persists across reloads (simulated by re-importing)', async () => {
    dispatch({ type: 'ADD_GOAL', title: 'Test goal', rawInput: 'test input' });
    const before = getSnapshot();
    expect(before.goals).toHaveLength(SEED_GOAL_COUNT + 1);

    clearModuleCache();
    const { getSnapshot: freshGetSnapshot } = await import('@/lib/repo');
    const after = freshGetSnapshot();
    expect(after.goals).toHaveLength(SEED_GOAL_COUNT + 1);
    expect(after.goals.some((g) => g.title === 'Test goal')).toBe(true);
  });

  it('falls back to seed when stored JSON is corrupt', async () => {
    setRawStorage('{not valid json');
    clearModuleCache();
    const { getSnapshot: freshGetSnapshot } = await import('@/lib/repo');
    const snap = freshGetSnapshot();
    expect(snap.tasks).toHaveLength(SEED_TASK_COUNT);
    expect(snap.goals).toHaveLength(SEED_GOAL_COUNT);
  });

  it('falls back to seed when stored JSON has wrong schema version', async () => {
    setRawStorage(JSON.stringify({ version: 999, goals: [], tasks: [], sessions: [], promptLogs: [] }));
    clearModuleCache();
    const { getSnapshot: freshGetSnapshot } = await import('@/lib/repo');
    const snap = freshGetSnapshot();
    expect(snap.tasks).toHaveLength(SEED_TASK_COUNT);
  });

  it('falls back to seed when stored JSON has missing arrays', async () => {
    setRawStorage(JSON.stringify({ version: 1, goals: [], tasks: [], sessions: [] }));
    clearModuleCache();
    const { getSnapshot: freshGetSnapshot } = await import('@/lib/repo');
    const snap = freshGetSnapshot();
    expect(snap.tasks).toHaveLength(SEED_TASK_COUNT);
  });

  it('reset() restores exactly the seed tasks', () => {
    dispatch({ type: 'ADD_TASK', goalId: null, title: 'Extra', description: 'x', category: 'build', step: null, order: 99, durationMinutes: 10 });
    dispatch({ type: 'ADD_GOAL', title: 'Extra goal', rawInput: 'x' });
    const before = getSnapshot();
    expect(before.tasks.length).toBe(SEED_TASK_COUNT + 1);

    reset();
    const after = getSnapshot();
    expect(after.tasks).toHaveLength(SEED_TASK_COUNT);
    expect(after.goals).toHaveLength(SEED_GOAL_COUNT);
    const doneTasks = after.tasks.filter((t) => t.status === 'done');
    expect(doneTasks).toHaveLength(2);
    expect(after.tasks.every((t) => t.source === 'seed')).toBe(true);
  });

  it('subscribe fires on dispatch', () => {
    let callCount = 0;
    const unsubscribe = subscribe(() => { callCount++; });
    dispatch({ type: 'ADD_GOAL', title: 'Trigger', rawInput: 'x' });
    expect(callCount).toBeGreaterThanOrEqual(1);
    unsubscribe();
    dispatch({ type: 'ADD_GOAL', title: 'No trigger', rawInput: 'x' });
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  it('getSnapshot returns stable reference when no change occurs', () => {
    const a = getSnapshot();
    const b = getSnapshot();
    expect(a).toBe(b);
  });

  it('UPDATE_TASK_STATUS marks done with completedAt', () => {
    const first = getSnapshot();
    const taskId = first.tasks.find((t) => t.status === 'todo')!.id;
    dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'done' });
    const after = getSnapshot();
    const task = after.tasks.find((t) => t.id === taskId)!;
    expect(task.status).toBe('done');
    expect(task.completedAt).not.toBeNull();
  });

  it('UPDATE_TASK_STATUS back to todo clears completedAt', () => {
    const first = getSnapshot();
    const taskId = first.tasks.find((t) => t.status === 'todo')!.id;
    dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'done' });
    dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'todo' });
    const after = getSnapshot();
    const task = after.tasks.find((t) => t.id === taskId)!;
    expect(task.status).toBe('todo');
    expect(task.completedAt).toBeNull();
  });

  it('DELETE_TASK removes a task', () => {
    const first = getSnapshot();
    const taskId = first.tasks[0].id;
    dispatch({ type: 'DELETE_TASK', taskId });
    const after = getSnapshot();
    expect(after.tasks.find((t) => t.id === taskId)).toBeUndefined();
  });

  it('REORDER_TASK changes order', () => {
    const first = getSnapshot();
    const taskId = first.tasks[0].id;
    dispatch({ type: 'REORDER_TASK', taskId, newOrder: 999 });
    const after = getSnapshot();
    expect(after.tasks.find((t) => t.id === taskId)!.order).toBe(999);
  });

  it('START_SESSION creates a running session', () => {
    const first = getSnapshot();
    const taskId = first.tasks[0].id;
    dispatch({ type: 'START_SESSION', taskId, plannedSeconds: 1500 });
    const after = getSnapshot();
    expect(after.sessions).toHaveLength(1);
    expect(after.sessions[0].status).toBe('running');
    expect(after.sessions[0].startedAt).not.toBeNull();
  });

  it('session lifecycle: start → pause → resume → complete', () => {
    const first = getSnapshot();
    const taskId = first.tasks[0].id;
    dispatch({ type: 'START_SESSION', taskId, plannedSeconds: 1500 });
    const session = getSnapshot().sessions[0];

    dispatch({ type: 'PAUSE_SESSION', sessionId: session.id, accumulatedSeconds: 300 });
    expect(getSnapshot().sessions[0].status).toBe('paused');

    dispatch({ type: 'RESUME_SESSION', sessionId: session.id });
    expect(getSnapshot().sessions[0].status).toBe('running');

    dispatch({ type: 'COMPLETE_SESSION', sessionId: session.id, accumulatedSeconds: 1500 });
    expect(getSnapshot().sessions[0].status).toBe('completed');
    expect(getSnapshot().sessions[0].accumulatedSeconds).toBe(1500);
  });

  it('LOG_PROMPT adds a prompt log entry', () => {
    const first = getSnapshot();
    const goalId = first.goals[0].id;
    dispatch({ type: 'LOG_PROMPT', goalId, input: 'generate tasks', engine: 'local-heuristic', latencyMs: 12 });
    const after = getSnapshot();
    expect(after.promptLogs).toHaveLength(1);
    expect(after.promptLogs[0].engine).toBe('local-heuristic');
  });

  it('ADD_TASK creates a user-source task with todo status', () => {
    dispatch({ type: 'ADD_TASK', goalId: null, title: 'My task', description: 'desc', category: 'design', step: 'execution', order: 10, durationMinutes: 15 });
    const after = getSnapshot();
    const task = after.tasks.find((t) => t.title === 'My task')!;
    expect(task.source).toBe('user');
    expect(task.status).toBe('todo');
    expect(task.completedAt).toBeNull();
  });

  it('falls back to in-memory when localStorage is blocked', async () => {
    const realLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
      writable: true,
      configurable: true,
    });

    clearModuleCache();
    const { getSnapshot: freshGetSnapshot, dispatch: freshDispatch } = await import('@/lib/repo');
    const snap = freshGetSnapshot();
    expect(snap.tasks).toHaveLength(SEED_TASK_COUNT);

    freshDispatch({ type: 'ADD_GOAL', title: 'Memory goal', rawInput: 'x' });
    const after = freshGetSnapshot();
    expect(after.goals.some((g) => g.title === 'Memory goal')).toBe(true);

    Object.defineProperty(window, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('storage event triggers cross-tab sync', async () => {
    clearModuleCache();
    const { getSnapshot: freshGetSnapshot } = await import('@/lib/repo');
    freshGetSnapshot();

    const otherTabData = JSON.stringify({
      version: 1,
      goals: [],
      tasks: [{ id: 'cross-tab-task', goalId: null, title: 'From other tab', description: '', category: 'build', step: null, order: 0, durationMinutes: 10, status: 'todo', source: 'user', createdAt: 0, completedAt: null }],
      sessions: [],
      promptLogs: [],
    });

    setRawStorage(otherTabData);

    let callCount = 0;
    const unsub = subscribe(() => { callCount++; });

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: otherTabData }));

    const snap = freshGetSnapshot();
    expect(snap.tasks.some((t) => t.id === 'cross-tab-task')).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(1);

    unsub();
  });
});
