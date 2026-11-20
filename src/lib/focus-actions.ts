import { dispatch, getSnapshot } from '@/lib/repo';
import {
  findLiveSession,
  findRunningSession,
  fromSession,
  timerReducer,
} from '@/lib/timer-machine';
import type { TimerEvent } from '@/lib/timer-machine';

/** Seconds counted so far after applying an event to a saved session. */
function secondsAfter(sessionId: string, event: TimerEvent): number | null {
  const session = getSnapshot().sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  return timerReducer(fromSession(session), event).accumulatedSeconds;
}

/** Only one session may run at a time, so pause any other running one first. */
function pauseOtherRunning(taskId: string, now: number): void {
  const running = findRunningSession(getSnapshot().sessions);
  if (running && running.taskId !== taskId) {
    const seconds = secondsAfter(running.id, { type: 'PAUSE', now });
    if (seconds !== null) {
      dispatch({ type: 'PAUSE_SESSION', sessionId: running.id, accumulatedSeconds: seconds });
    }
  }
}

export function startFocus(taskId: string, now: number): void {
  const state = getSnapshot();
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  // Already running or paused (for example a double click): do nothing.
  if (findLiveSession(state.sessions, taskId)) return;
  pauseOtherRunning(taskId, now);
  dispatch({ type: 'START_SESSION', taskId, plannedSeconds: Math.max(1, task.durationMinutes) * 60 });
  dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'active' });
}

export function pauseFocus(taskId: string, now: number): void {
  const live = findLiveSession(getSnapshot().sessions, taskId);
  if (!live || live.status !== 'running') return;
  const seconds = secondsAfter(live.id, { type: 'PAUSE', now });
  if (seconds === null) return;
  dispatch({ type: 'PAUSE_SESSION', sessionId: live.id, accumulatedSeconds: seconds });
}

export function resumeFocus(taskId: string, now: number): void {
  const live = findLiveSession(getSnapshot().sessions, taskId);
  if (!live || live.status !== 'paused') return;
  pauseOtherRunning(taskId, now);
  dispatch({ type: 'RESUME_SESSION', sessionId: live.id });
}

export function toggleFocus(taskId: string, now: number): void {
  const live = findLiveSession(getSnapshot().sessions, taskId);
  if (!live) return;
  if (live.status === 'running') pauseFocus(taskId, now);
  else resumeFocus(taskId, now);
}

export function completeFocus(taskId: string, now: number): void {
  const live = findLiveSession(getSnapshot().sessions, taskId);
  if (!live) return;
  const seconds = secondsAfter(live.id, { type: 'COMPLETE', now });
  if (seconds === null) return;
  dispatch({ type: 'COMPLETE_SESSION', sessionId: live.id, accumulatedSeconds: seconds });
  dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'done' });
}

export function abandonFocus(taskId: string, now: number): void {
  const live = findLiveSession(getSnapshot().sessions, taskId);
  if (!live) return;
  const seconds = secondsAfter(live.id, { type: 'ABANDON', now });
  if (seconds === null) return;
  dispatch({ type: 'ABANDON_SESSION', sessionId: live.id, accumulatedSeconds: seconds });
  dispatch({ type: 'UPDATE_TASK_STATUS', taskId, status: 'todo' });
}