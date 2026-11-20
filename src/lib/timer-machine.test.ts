import { describe, expect, it } from 'vitest';
import {
  IDLE_TIMER,
  elapsedSeconds,
  findCompletedSession,
  findLiveSession,
  findRunningSession,
  formatClock,
  fromSession,
  progressFraction,
  remainingSeconds,
  timerReducer,
} from './timer-machine';
import type { FocusSession } from '@/types';

const T0 = 1_000_000;
const MIN = 60_000;

function session(partial: Partial<FocusSession>): FocusSession {
  return {
    id: 's1',
    taskId: 't1',
    plannedSeconds: 1500,
    accumulatedSeconds: 0,
    startedAt: null,
    status: 'paused',
    ...partial,
  };
}

describe('timerReducer', () => {
  it('starts from idle', () => {
    const s = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 1500 });
    expect(s.status).toBe('running');
    expect(s.startedAt).toBe(T0);
    expect(s.plannedSeconds).toBe(1500);
    expect(s.accumulatedSeconds).toBe(0);
  });

  it('pauses and keeps the elapsed time', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 1500 });
    const paused = timerReducer(running, { type: 'PAUSE', now: T0 + 5 * MIN });
    expect(paused.status).toBe('paused');
    expect(paused.accumulatedSeconds).toBe(300);
    expect(paused.startedAt).toBe(null);
    // Time passing while paused does not count.
    expect(elapsedSeconds(paused, T0 + 60 * MIN)).toBe(300);
  });

  it('resumes and adds on top of the paused time', () => {
    let s = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 1500 });
    s = timerReducer(s, { type: 'PAUSE', now: T0 + 5 * MIN });
    s = timerReducer(s, { type: 'RESUME', now: T0 + 20 * MIN });
    expect(s.status).toBe('running');
    expect(elapsedSeconds(s, T0 + 22 * MIN)).toBe(300 + 120);
  });

  it('completes from running and from paused', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    const done = timerReducer(running, { type: 'COMPLETE', now: T0 + 3 * MIN });
    expect(done.status).toBe('completed');
    expect(done.accumulatedSeconds).toBe(180);
    const paused = timerReducer(running, { type: 'PAUSE', now: T0 + 2 * MIN });
    const done2 = timerReducer(paused, { type: 'COMPLETE', now: T0 + 50 * MIN });
    expect(done2.accumulatedSeconds).toBe(120);
  });

  it('abandons', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    const gone = timerReducer(running, { type: 'ABANDON', now: T0 + MIN });
    expect(gone.status).toBe('abandoned');
    expect(gone.accumulatedSeconds).toBe(60);
  });

  it('ignores events that make no sense', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    expect(timerReducer(running, { type: 'START', now: T0 + 1, plannedSeconds: 99 })).toEqual(running);
    expect(timerReducer(running, { type: 'RESUME', now: T0 + 1 })).toEqual(running);
    expect(timerReducer(IDLE_TIMER, { type: 'PAUSE', now: T0 })).toEqual(IDLE_TIMER);
    expect(timerReducer(IDLE_TIMER, { type: 'COMPLETE', now: T0 })).toEqual(IDLE_TIMER);
    const done = timerReducer(running, { type: 'COMPLETE', now: T0 + MIN });
    expect(timerReducer(done, { type: 'PAUSE', now: T0 + 2 * MIN })).toEqual(done);
  });

  it('can start a fresh run after completing', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    const done = timerReducer(running, { type: 'COMPLETE', now: T0 + MIN });
    const again = timerReducer(done, { type: 'START', now: T0 + 5 * MIN, plannedSeconds: 600 });
    expect(again.status).toBe('running');
    expect(again.accumulatedSeconds).toBe(0);
  });

  it('never goes backwards if the clock moves back', () => {
    const running = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    expect(elapsedSeconds(running, T0 - 10_000)).toBe(0);
  });
});

describe('reload', () => {
  it('a running session saved 7 minutes ago shows 7 minutes after reload', () => {
    const saved = session({ status: 'running', startedAt: T0, accumulatedSeconds: 60 });
    const restored = fromSession(saved);
    expect(restored.status).toBe('running');
    expect(elapsedSeconds(restored, T0 + 7 * MIN)).toBe(60 + 420);
    expect(remainingSeconds(restored, T0 + 7 * MIN)).toBe(1500 - 480);
  });

  it('a paused session stays put after reload', () => {
    const restored = fromSession(session({ status: 'paused', accumulatedSeconds: 200 }));
    expect(elapsedSeconds(restored, T0 + 999 * MIN)).toBe(200);
  });

  it('no session means idle', () => {
    expect(fromSession(null)).toEqual(IDLE_TIMER);
    expect(fromSession(undefined)).toEqual(IDLE_TIMER);
  });
});

describe('numbers for the screen', () => {
  it('progress goes from 0 to 1 and stops at 1', () => {
    const s = timerReducer(IDLE_TIMER, { type: 'START', now: T0, plannedSeconds: 600 });
    expect(progressFraction(s, T0)).toBe(0);
    expect(progressFraction(s, T0 + 5 * MIN)).toBe(0.5);
    expect(progressFraction(s, T0 + 30 * MIN)).toBe(1);
    expect(remainingSeconds(s, T0 + 30 * MIN)).toBe(0);
  });

  it('formats the clock', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59.2)).toBe('01:00');
    expect(formatClock(25 * 60)).toBe('25:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('finding sessions', () => {
  const list: FocusSession[] = [
    session({ id: 'a', taskId: 't1', status: 'completed', accumulatedSeconds: 900 }),
    session({ id: 'b', taskId: 't2', status: 'running', startedAt: T0 }),
    session({ id: 'c', taskId: 't1', status: 'paused' }),
  ];
  it('finds the one running session', () => {
    expect(findRunningSession(list)?.id).toBe('b');
    expect(findRunningSession([list[0] as FocusSession])).toBe(null);
  });
  it('finds the live session for a task', () => {
    expect(findLiveSession(list, 't1')?.id).toBe('c');
    expect(findLiveSession(list, 't2')?.id).toBe('b');
    expect(findLiveSession(list, 'nope')).toBe(null);
  });
  it('finds the completed session for a task', () => {
    expect(findCompletedSession(list, 't1')?.id).toBe('a');
    expect(findCompletedSession(list, 't2')).toBe(null);
  });
});