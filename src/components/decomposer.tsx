import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight, Check, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { addGeneratedPlan } from '@/lib/repo';
import { decompose, MAX_INPUT_LENGTH, MIN_INPUT_LENGTH } from '@/lib/deconstructor';
import type { DecomposeResult, StepKey } from '@/lib/deconstructor';
import { DEADLINE } from '@/config';

const EXAMPLE_BRAINDUMP =
  "ok so the demo is due in about 6 hours and honestly nothing works end to end yet. need to cut scope hard. auth is half done but we dont even need it, kill it. the dashboard looks terrible on my phone, buttons overlap. the README is basically empty and I havent recorded the demo video at all. tests are flaky, one of them fails every third run and I dont know why. deploy to Vercel will probably break because of the env vars. also need to add the thing judges will actually see first, the landing hero. must polish before submission and somehow sleep. what do I even do first??";

const STEP_LABEL: Record<StepKey, string> = {
  scope: 'Step 1: Scope',
  execution: 'Step 2: Execution',
  polish: 'Step 3: Polish',
};

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-400 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-surface-2 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

type Phase = 'idle' | 'loading' | 'done' | 'error';

function toMinutes(text: string, fallback: number): number {
  const n = Number.parseInt(text, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(180, Math.max(5, n));
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function Decomposer({ onSaved }: { onSaved: () => void }) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<DecomposeResult | null>(null);
  const [minutes, setMinutes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const runRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const trimmedLength = input.trim().length;
  const canSubmit = trimmedLength >= MIN_INPUT_LENGTH && phase !== 'loading';

  async function run() {
    if (!canSubmit) return;
    runRef.current += 1;
    const runId = runRef.current;
    setPhase('loading');
    setError('');
    setSaved(false);
    savingRef.current = false;
    try {
      // The short wait keeps the loading state visible, so the change is easy to notice.
      const [res] = await Promise.all([
        decompose(input),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 450);
        }),
      ]);
      if (runId !== runRef.current) return;
      setResult(res);
      setMinutes(res.steps.map((s) => String(s.durationMinutes)));
      setPhase('done');
    } catch (e) {
      if (runId !== runRef.current) return;
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPhase('error');
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void run();
    }
  }

  function loadExample() {
    setInput(EXAMPLE_BRAINDUMP);
    textareaRef.current?.focus();
  }

  function setMinuteText(index: number, text: string) {
    setMinutes((prev) => prev.map((m, i) => (i === index ? text : m)));
  }

  function normalizeMinutes(index: number, fallback: number) {
    setMinutes((prev) => prev.map((m, i) => (i === index ? String(toMinutes(m, fallback)) : m)));
  }

  function discard() {
    runRef.current += 1;
    savingRef.current = false;
    setResult(null);
    setMinutes([]);
    setSaved(false);
    setError('');
    setPhase('idle');
  }

  const finalMinutes = result
    ? result.steps.map((s, i) => toMinutes(minutes[i] ?? '', s.durationMinutes))
    : [];
  const totalMinutes = finalMinutes.reduce((sum, m) => sum + m, 0);
  const minutesLeft = Math.max(0, Math.floor((DEADLINE - Date.now()) / 60000));

  function save() {
    if (!result || savingRef.current) return;
    savingRef.current = true;
    addGeneratedPlan({
      goalTitle: result.goalTitle,
      rawInput: input.trim(),
      steps: result.steps.map((s, i) => ({
        step: s.step,
        title: s.title,
        description: s.description,
        category: s.category,
        durationMinutes: finalMinutes[i] ?? s.durationMinutes,
      })),
      engine: result.engine,
      latencyMs: result.latencyMs,
    });
    setSaved(true);
  }

  return (
    <section className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Break down your goal</h1>
      <p className="mt-2 text-sm text-muted">
        Paste everything on your mind. You get three steps with time estimates.
      </p>

      <div className="mt-5">
        <label htmlFor="braindump" className="text-sm font-medium text-foreground">
          Your braindump
        </label>
        <textarea
          id="braindump"
          ref={textareaRef}
          value={input}
          maxLength={MAX_INPUT_LENGTH}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={8}
          aria-describedby="braindump-hint"
          placeholder="What is on your mind? Deadlines, worries, half-finished work..."
          className="mt-2 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
          <span id="braindump-hint">
            {trimmedLength < MIN_INPUT_LENGTH
              ? `Write at least ${MIN_INPUT_LENGTH} characters to continue.`
              : 'Press Ctrl or Cmd + Enter to submit.'}
          </span>
          <span className="font-mono tabular-nums">
            {input.length}/{MAX_INPUT_LENGTH}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => void run()} disabled={!canSubmit} className={PRIMARY_BTN}>
          Split into 3 steps
          <ArrowRight size={16} />
        </button>
        <button type="button" onClick={loadExample} className={SECONDARY_BTN}>
          Load example braindump
        </button>
      </div>

      {phase === 'loading' && (
        <div className="mt-6 space-y-3" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Splitting your goal into steps</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface-2" />
          ))}
        </div>
      )}

      {phase === 'error' && (
        <div role="alert" className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm text-foreground">Could not split your goal. {error}</p>
          <button type="button" onClick={() => void run()} disabled={!canSubmit} className={`${SECONDARY_BTN} mt-3`}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}

      {phase === 'done' && result !== null && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">
              <Sparkles size={12} />
              Local heuristic (rule-based, no AI model) in {result.latencyMs} ms
            </span>
          </div>

          <h2 className="mt-3 text-lg font-semibold text-foreground">{result.goalTitle}</h2>

          <ol className="mt-3 space-y-3">
            {result.steps.map((s, i) => (
              <li
                key={s.step}
                className="animate-fade-in rounded-2xl border border-border bg-surface p-4"
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-accent-400">{STEP_LABEL[s.step]}</p>
                    <h3 className="mt-1 text-base font-semibold text-foreground">{s.title}</h3>
                  </div>
                  <label className="flex shrink-0 flex-col items-end text-xs text-muted">
                    Minutes
                    <input
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={180}
                      value={minutes[i] ?? ''}
                      onChange={(e) => setMinuteText(i, e.target.value)}
                      onBlur={() => normalizeMinutes(i, s.durationMinutes)}
                      className="mt-1 w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-right font-mono text-sm tabular-nums text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
                    />
                  </label>
                </div>
                <p className="mt-2 text-sm text-muted">{s.description}</p>
                <p className="mt-2 text-xs text-muted">Why: {s.rationale}</p>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-sm text-muted">
            Your plan takes {formatDuration(totalMinutes)}. Time left until the deadline: {formatDuration(minutesLeft)}.{' '}
            {totalMinutes <= minutesLeft
              ? 'It fits.'
              : 'It is longer than the time left, so shorten a step or cut scope.'}
          </p>

          {saved ? (
            <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Check size={16} />
                Saved 3 tasks to Task Flow.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onSaved} className={PRIMARY_BTN}>
                  Open Task Flow
                  <ArrowRight size={16} />
                </button>
                <button type="button" onClick={discard} className={SECONDARY_BTN}>
                  Start over
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={save} className={PRIMARY_BTN}>
                Save as active tasks
              </button>
              <button type="button" onClick={() => void run()} disabled={!canSubmit} className={SECONDARY_BTN}>
                <RefreshCw size={16} />
                Regenerate
              </button>
              <button type="button" onClick={discard} className={SECONDARY_BTN}>
                <Trash2 size={16} />
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}