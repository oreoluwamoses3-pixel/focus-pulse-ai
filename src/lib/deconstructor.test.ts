import { describe, expect, it } from 'vitest';
import { decompose, MAX_INPUT_LENGTH } from './deconstructor';

const BRAINDUMP =
  "ok so the demo is due in about 6 hours and honestly nothing works end to end yet. need to cut scope hard. auth is half done but we dont even need it, kill it. the dashboard looks terrible on my phone, buttons overlap. the README is basically empty and I havent recorded the demo video at all. tests are flaky, one of them fails every third run and I dont know why. deploy to Vercel will probably break because of the env vars. also need to add the thing judges will actually see first, the landing hero. must polish before submission and somehow sleep. what do I even do first??";

describe('decompose', () => {
  it('returns exactly 3 steps in order for the example braindump', async () => {
    const result = await decompose(BRAINDUMP);
    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((s) => s.step)).toEqual(['scope', 'execution', 'polish']);
    expect(result.engine).toBe('local-heuristic');
  });

  it('is deterministic', async () => {
    const a = await decompose(BRAINDUMP);
    const b = await decompose(BRAINDUMP);
    expect(a.steps).toEqual(b.steps);
    expect(a.goalTitle).toBe(b.goalTitle);
  });

  it('finds the hours available', async () => {
    const result = await decompose(BRAINDUMP);
    expect(result.hoursAvailable).toBe(6);
  });

  it('keeps durations between 5 and 90 minutes, in steps of 5', async () => {
    const result = await decompose(BRAINDUMP);
    for (const step of result.steps) {
      expect(step.durationMinutes).toBeGreaterThanOrEqual(5);
      expect(step.durationMinutes).toBeLessThanOrEqual(90);
      expect(step.durationMinutes % 5).toBe(0);
    }
  });

  it('keeps every rationale at 140 characters or less', async () => {
    const result = await decompose(BRAINDUMP);
    for (const step of result.steps) {
      expect(step.rationale.length).toBeLessThanOrEqual(140);
      expect(step.rationale.length).toBeGreaterThan(0);
    }
  });

  it('plans for less time when the deadline is short', async () => {
    const tight = await decompose(`${BRAINDUMP} Actually only 1 hour left.`.replace('6 hours', 'x'));
    const loose = await decompose(BRAINDUMP);
    const sum = (steps: { durationMinutes: number }[]) => steps.reduce((t, s) => t + s.durationMinutes, 0);
    expect(sum(tight.steps)).toBeLessThanOrEqual(sum(loose.steps));
  });

  it('handles very short input', async () => {
    const result = await decompose('ship it');
    expect(result.steps).toHaveLength(3);
  });

  it('handles emoji and non-English text', async () => {
    const result = await decompose('🔥🔥 kí ni mo máa ṣe? 完成项目!!!');
    expect(result.steps).toHaveLength(3);
    expect(result.goalTitle.length).toBeGreaterThan(0);
  });

  it('handles very long input without breaking', async () => {
    const result = await decompose('fix the bug and build the page. '.repeat(500));
    expect(result.steps).toHaveLength(3);
    for (const step of result.steps) {
      expect(step.durationMinutes).toBeLessThanOrEqual(90);
    }
    expect(MAX_INPUT_LENGTH).toBe(4000);
  });

  it('rejects empty input', async () => {
    await expect(decompose('   ')).rejects.toThrow();
  });
});