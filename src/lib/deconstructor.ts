import type { TaskCategory } from '@/types';

export type StepKey = 'scope' | 'execution' | 'polish';

export interface DecomposedStep {
  step: StepKey;
  title: string;
  description: string;
  category: TaskCategory;
  durationMinutes: number;
  rationale: string;
}

export interface DecomposeResult {
  goalTitle: string;
  steps: DecomposedStep[];
  engine: 'local-heuristic';
  latencyMs: number;
  hoursAvailable: number | null;
}

export const MIN_INPUT_LENGTH = 10;
export const MAX_INPUT_LENGTH = 4000;

// Cue words. A cue matches a whole word, with an optional s/es/ed/ing ending.
const SCOPE_CUES = [
  'cut', 'scope', 'kill', 'drop', 'skip', 'prioritize', 'priority', 'mvp',
  'decide', 'plan', 'first', 'dont need', "don't need", 'not needed', 'unclear',
];
const BUILD_CUES = [
  'build', 'add', 'implement', 'create', 'make', 'feature', 'hero', 'landing',
  'dashboard', 'auth', 'login', 'api', 'page', 'screen', 'timer', 'form',
];
const DEBUG_CUES = [
  'fix', 'bug', 'flaky', 'fail', 'broken', 'error', 'crash', 'overlap',
  'nothing works', 'doesnt work', "doesn't work", 'slow', 'terrible',
];
const POLISH_CUES = [
  'polish', 'readme', 'docs', 'document', 'demo', 'video', 'record', 'deploy',
  'vercel', 'netlify', 'submit', 'submission', 'test', 'present', 'pitch',
  'slides', 'sleep',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCue(text: string, cue: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(cue)}(?:s|es|ed|ing)?\\b`);
  return pattern.test(text);
}

function countCues(text: string, cues: string[]): number {
  let count = 0;
  for (const cue of cues) {
    if (matchesCue(text, cue)) count += 1;
  }
  return count;
}

function snippet(clause: string, max = 70): string {
  const clean = clause.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function roundToFive(minutes: number): number {
  return Math.min(90, Math.max(5, Math.round(minutes / 5) * 5));
}

function findHoursAvailable(text: string): number | null {
  const lower = text.toLowerCase();
  const hours = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  if (hours && hours[1] !== undefined) return Number.parseFloat(hours[1]);
  const days = lower.match(/(\d+(?:\.\d+)?)\s*days?\b/);
  if (days && days[1] !== undefined) return Number.parseFloat(days[1]) * 24;
  const mins = lower.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/);
  if (mins && mins[1] !== undefined) return Number.parseFloat(mins[1]) / 60;
  return null;
}

function splitClauses(raw: string): string[] {
  const clauses: string[] = [];
  for (const piece of raw.split(/[.!?\n;]+/)) {
    const clean = piece.replace(/\s+/g, ' ').trim();
    if (clean.length < 3) continue;
    if (clean.length > 90) {
      for (const part of clean.split(/,\s+/)) {
        const trimmed = part.trim();
        if (trimmed.length >= 3) clauses.push(trimmed);
      }
    } else {
      clauses.push(clean);
    }
  }
  return clauses;
}

interface Buckets {
  scope: string[];
  build: string[];
  debug: string[];
  polish: string[];
}

function bucketClauses(clauses: string[]): Buckets {
  const buckets: Buckets = { scope: [], build: [], debug: [], polish: [] };
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const scores: Array<[keyof Buckets, number]> = [
      ['scope', countCues(lower, SCOPE_CUES)],
      ['debug', countCues(lower, DEBUG_CUES)],
      ['build', countCues(lower, BUILD_CUES)],
      ['polish', countCues(lower, POLISH_CUES)],
    ];
    let best: keyof Buckets | null = null;
    let bestScore = 0;
    for (const [name, score] of scores) {
      if (score > bestScore) {
        best = name;
        bestScore = score;
      }
    }
    if (best !== null) buckets[best].push(clause);
  }
  return buckets;
}

function polishTitle(lowerText: string): string {
  const parts: string[] = [];
  if (/\b(readme|docs?|document)/.test(lowerText)) parts.push('the README');
  if (/\b(demo|video|record)/.test(lowerText)) parts.push('the demo video');
  if (/\b(deploy|vercel|netlify|submit|submission)/.test(lowerText)) parts.push('deployment');
  if (/\btests?\b/.test(lowerText)) parts.push('tests');
  return parts.length > 0 ? `Finish ${listJoin(parts)}` : 'Polish and double-check everything';
}

function describe(intro: string, clauses: string[], fallback: string): string {
  if (clauses.length === 0) return fallback;
  const quoted = clauses.slice(0, 2).map((c) => `"${snippet(c)}"`);
  return `${intro} From your notes: ${quoted.join(' and ')}.`;
}

export async function decompose(input: string): Promise<DecomposeResult> {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const raw = input.replace(/[\u2018\u2019]/g, "'").slice(0, MAX_INPUT_LENGTH);
  if (raw.trim().length === 0) {
    throw new Error('Type or paste something first.');
  }

  const lowerAll = raw.toLowerCase();
  const clauses = splitClauses(raw);
  const buckets = bucketClauses(clauses);
  const hoursAvailable = findHoursAvailable(raw);

  const scopeCount = buckets.scope.length;
  const executionClauses = [...buckets.debug, ...buckets.build];
  const executionCount = executionClauses.length;
  const polishCount = buckets.polish.length;

  // Base minutes, grown a little for every matching note.
  let scopeMinutes = 10 + 5 * Math.min(scopeCount, 3) + (raw.length > 1500 ? 10 : 0);
  let executionMinutes = 30 + 10 * Math.min(executionCount, 4);
  let polishMinutes = 15 + 5 * Math.min(polishCount, 4);

  // If a time limit is mentioned, plan to use at most 60% of it.
  if (hoursAvailable !== null && hoursAvailable > 0) {
    const budget = hoursAvailable * 60 * 0.6;
    const total = scopeMinutes + executionMinutes + polishMinutes;
    if (total > budget) {
      const scale = Math.max(0.3, budget / total);
      scopeMinutes *= scale;
      executionMinutes *= scale;
      polishMinutes *= scale;
    }
  }

  const scopeTitle =
    scopeCount > 0
      ? 'Cut scope and lock the one flow you will demo'
      : 'Define the goal and the smallest version that works';
  const executionTitle =
    executionCount === 0
      ? 'Do the main work in one focused block'
      : buckets.debug.length > buckets.build.length
        ? 'Fix what is broken, then finish the core flow'
        : 'Build the core flow end to end';

  const steps: DecomposedStep[] = [
    {
      step: 'scope',
      title: scopeTitle,
      description: describe(
        'Decide what is in and what is out.',
        buckets.scope,
        'Write one sentence about what must work, and drop everything else.',
      ),
      category: 'design',
      durationMinutes: roundToFive(scopeMinutes),
      rationale:
        scopeCount > 0
          ? `Scope comes first: ${plural(scopeCount, 'note')} about cutting or deciding. Less to build means less to break.`.slice(0, 140)
          : 'Scope comes first: with no clear cut line, pick the smallest version that still works.',
    },
    {
      step: 'execution',
      title: executionTitle,
      description: describe(
        'Work in one focused block, core flow first.',
        executionClauses,
        'Work in one focused block and finish the main flow before anything else.',
      ),
      category: buckets.debug.length > buckets.build.length ? 'debug' : 'build',
      durationMinutes: roundToFive(executionMinutes),
      rationale:
        executionCount > 0
          ? `${plural(executionCount, 'note')} about building or fixing. The core flow gets the longest block.`.slice(0, 140)
          : 'This is the main work, so it gets the longest block of the three.',
    },
    {
      step: 'polish',
      title: polishTitle(lowerAll),
      description: describe(
        'Do these last so they match the final app.',
        buckets.polish,
        'Re-check the main flow, fix small rough edges, and make sure it is ready to show.',
      ),
      category: /\b(deploy|vercel|netlify|submit|submission|demo|video|record)/.test(lowerAll) ? 'ship' : 'review',
      durationMinutes: roundToFive(polishMinutes),
      rationale:
        polishCount > 0
          ? `${plural(polishCount, 'note')} about docs, tests, or shipping. Doing them last keeps them accurate.`.slice(0, 140)
          : 'Polish last, so the final checks match what you actually built.',
    },
  ];

  const first = clauses[0];
  let goalTitle = first !== undefined ? capitalize(snippet(first, 60)) : 'My goal';
  if (hoursAvailable !== null && hoursAvailable > 0) {
    goalTitle =
      hoursAvailable >= 1
        ? `Plan for the next ${Math.round(hoursAvailable)} ${Math.round(hoursAvailable) === 1 ? 'hour' : 'hours'}`
        : `Plan for the next ${Math.max(1, Math.round(hoursAvailable * 60))} minutes`;
  }
  const finished = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    goalTitle,
    steps,
    engine: 'local-heuristic',
    latencyMs: Math.max(0, Math.round(finished - started)),
    hoursAvailable,
  };
}