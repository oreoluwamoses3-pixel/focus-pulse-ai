import type { Goal, Snapshot, Task } from '@/types';

const SCHEMA_VERSION = 1;

const GOAL_1_ID = 'goal-ship-hackathon';
const GOAL_2_ID = 'goal-deep-work';

const goals: Goal[] = [
  {
    id: GOAL_1_ID,
    title: 'Ship a winning hackathon project',
    rawInput: 'I want to ship a polished hackathon project with a flawless 2-minute demo',
    createdAt: 1_700_000_000_000,
  },
  {
    id: GOAL_2_ID,
    title: 'Build a sustainable deep-work practice',
    rawInput: 'I want to build a daily deep-work habit that compounds over time',
    createdAt: 1_700_000_000_000,
  },
];

const tasks: Task[] = [
  {
    id: 'task-cut-scope',
    goalId: GOAL_1_ID,
    title: 'Cut scope to one demoable flow',
    description: 'Identify the single end-to-end user story that can be demonstrated in 90 seconds and ruthlessly remove everything else from the plan.',
    category: 'review',
    step: 'scope',
    order: 0,
    durationMinutes: 30,
    status: 'done',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: 1_700_000_100_000,
  },
  {
    id: 'task-architecture-readme',
    goalId: GOAL_1_ID,
    title: 'Write README architecture section',
    description: 'Document the system architecture, key design decisions, and separation of pure logic from UI so judges can see engineering quality at a glance.',
    category: 'review',
    step: 'polish',
    order: 1,
    durationMinutes: 25,
    status: 'done',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: 1_700_000_200_000,
  },
  {
    id: 'task-demo-video',
    goalId: GOAL_1_ID,
    title: 'Record 90-second demo video',
    description: 'Script and record a tight 90-second demo walking through the core flow. Practice the narration three times before recording the final cut.',
    category: 'ship',
    step: 'polish',
    order: 2,
    durationMinutes: 45,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
  {
    id: 'task-pure-logic-tests',
    goalId: GOAL_1_ID,
    title: 'Write unit tests for pure logic layer',
    description: 'Cover the reducer, deconstructor, and insight engine with unit tests. Inject clock, storage, and id so logic is deterministic and testable.',
    category: 'build',
    step: 'execution',
    order: 3,
    durationMinutes: 40,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
  {
    id: 'task-ci-pipeline',
    goalId: GOAL_1_ID,
    title: 'Set up CI pipeline with typecheck + tests',
    description: 'Configure a CI workflow that runs typecheck, unit tests, and build on every push. Fail fast on any regression.',
    category: 'build',
    step: 'execution',
    order: 4,
    durationMinutes: 20,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
  {
    id: 'task-polish-animations',
    goalId: GOAL_1_ID,
    title: 'Polish micro-interactions and transitions',
    description: 'Add hover states, fade-in transitions, and subtle animations that make the app feel alive during the demo without distracting from the core flow.',
    category: 'design',
    step: 'polish',
    order: 5,
    durationMinutes: 35,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
  {
    id: 'task-deep-work-block',
    goalId: GOAL_2_ID,
    title: 'Schedule a 90-minute deep-work block',
    description: 'Block a 90-minute calendar slot with no notifications, no Slack, and a single defined outcome. Treat it as immovable.',
    category: 'build',
    step: 'scope' as const,
    order: 0,
    durationMinutes: 15,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
  {
    id: 'task-weekly-review',
    goalId: GOAL_2_ID,
    title: 'Run a weekly deep-work review',
    description: 'Every Friday, review which focus blocks actually happened, what broke them, and adjust next week\u2019s calendar to protect deep work better.',
    category: 'review',
    step: 'scope',
    order: 1,
    durationMinutes: 20,
    status: 'todo',
    source: 'seed',
    createdAt: 1_700_000_000_000,
    completedAt: null,
  },
];

export function createSeedSnapshot(): Snapshot {
  return {
    version: SCHEMA_VERSION,
    goals: structuredClone(goals),
    tasks: structuredClone(tasks),
    sessions: [],
    promptLogs: [],
  };
}

export const SEED_TASK_COUNT = tasks.length;
export const SEED_GOAL_COUNT = goals.length;
export { SCHEMA_VERSION };
