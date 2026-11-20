import type { FocusSession } from '@/types';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned';

export interface TimerState {
  status: TimerStatus;
  plannedSeconds: number;
  /** Seconds already counted before the current run began. */
  accumulatedSeconds: number;
  /** Epoch ms when the current run began. Only set while running. */
  startedAt: number | null;
}

export type TimerEvent =
  | { type: 'START'; now: number; plannedSeconds: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'COMPLETE'; now: number }
  | { type: 'ABANDON'; now: number };

export const IDLE_TIMER: TimerState = {
  status: 'idle',
  plannedSeconds: 0,
  accumulatedSeconds: 0,
  startedAt: null,
};

/**
 * Seconds of focus so far. Time is passed in (never read from the clock here),
 * and it is worked out from startedAt, so it stays right after a reload or a
 * sleeping tab.
 */
export function elapsedSeconds(state: TimerState, now: number): number {
  if (state.status === 'running' && state.startedAt !== null) {
    return state.accumulatedSeconds + Math.max(0, (now - state.startedAt) / 1000);
  }
  return state.accumulatedSeconds;
}

export function remainingSeconds(state: TimerState, now: number): number {
  return Math.max(0, state.plannedSeconds - elapsedSeconds(state, now));
}

/** 0 to 1, for the progress ring. */
export function progressFraction(state: TimerState, now: number): number {
  if (state.plannedSeconds <= 0) return 0;
  return Math.min(1, elapsedSeconds(state, now) / state.plannedSeconds);
}

export function timerReducer(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'START': {
      // A new run can only begin when nothing is running or paused.
      if (state.status === 'running' || state.status === 'paused') return state;
      return {
        status: 'running',
        plannedSeconds: Math.max(0, event.plannedSeconds),
        accumulatedSeconds: 0,
        startedAt: event.now,
      };
    }
    case 'PAUSE': {
      if (state.status !== 'running') return state;
      return {
        ...state,
        status: 'paused',
        accumulatedSeconds: elapsedSeconds(state, event.now),
        startedAt: null,
      };
    }
    case 'RESUME': {
      if (state.status !== 'paused') return state;
      return { ...state, status: 'running', startedAt: event.now };
    }
    case 'COMPLETE': {
      if (state.status !== 'running' && state.status !== 'paused') return state;
      return {
        ...state,
        status: 'completed',
        accumulatedSeconds: elapsedSeconds(state, event.now),
        startedAt: null,
      };
    }
    case 'ABANDON': {
      if (state.status !== 'running' && state.status !== 'paused') return state;
      return {
        ...state,
        status: 'abandoned',
        accumulatedSeconds: elapsedSeconds(state, event.now),
        startedAt: null,
      };
    }
  }
}

/** Turns a saved session back into timer state. This is what makes a reload resume. */
export function fromSession(session: FocusSession | null | undefined): TimerState {
  if (!session) return IDLE_TIMER;
  return {
    status: session.status,
    plannedSeconds: session.plannedSeconds,
    accumulatedSeconds: session.accumulatedSeconds,
    startedAt: session.status === 'running' ? session.startedAt : null,
  };
}

/** The one session that is running right now, if any. */
export function findRunningSession(sessions: FocusSession[]): FocusSession | null {
  return sessions.find((s) => s.status === 'running') ?? null;
}

/** The newest running or paused session for a task, if any. */
export function findLiveSession(sessions: FocusSession[], taskId: string): FocusSession | null {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (s && s.taskId === taskId && (s.status === 'running' || s.status === 'paused')) return s;
  }
  return null;
}

/** The newest finished (completed) session for a task, if any. */
export function findCompletedSession(sessions: FocusSession[], taskId: string): FocusSession | null {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const s = sessions[i];
    if (s && s.taskId === taskId && s.status === 'completed') return s;
  }
  return null;
}

/** m:ss, or h:mm:ss for an hour or more. Rounds up so it never shows 0:00 early. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${String(m).padStart(2, '0')}:${ss}`;
}