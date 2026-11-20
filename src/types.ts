export type TaskCategory = 'build' | 'debug' | 'design' | 'ship' | 'review';
export type TaskStep = 'scope' | 'execution' | 'polish' | null;
export type TaskStatus = 'todo' | 'active' | 'done';
export type TaskSource = 'seed' | 'user' | 'generated';

export type SessionStatus = 'running' | 'paused' | 'completed' | 'abandoned';
export type EngineSource = 'local-heuristic' | 'llm';

export interface Task {
  id: string;
  goalId: string | null;
  title: string;
  description: string;
  category: TaskCategory;
  step: TaskStep;
  order: number;
  durationMinutes: number;
  status: TaskStatus;
  source: TaskSource;
  createdAt: number;
  completedAt: number | null;
}

export interface Goal {
  id: string;
  title: string;
  rawInput: string;
  createdAt: number;
}

export interface FocusSession {
  id: string;
  taskId: string;
  plannedSeconds: number;
  accumulatedSeconds: number;
  startedAt: number | null;
  status: SessionStatus;
}

export interface AIPromptLog {
  id: string;
  goalId: string;
  input: string;
  engine: EngineSource;
  latencyMs: number;
  createdAt: number;
}

export interface Snapshot {
  version: number;
  goals: Goal[];
  tasks: Task[];
  sessions: FocusSession[];
  promptLogs: AIPromptLog[];
}
