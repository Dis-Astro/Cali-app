export type WorkoutTimerMode = "countdown" | "stopwatch" | "emom" | "tabata" | "amrap" | "mix";

export interface AmrapSet { durationSeconds: number; restSeconds: number }
export interface MixBlock {
  id: string;
  label: string;
  kind: "work" | "rest" | "amrap" | "stopwatch" | "emom" | "tabata";
  durationSeconds: number;
  intervalSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  repeats: number;
}

export type WorkoutTimerStatus = "idle" | "running" | "paused" | "finished";

export interface WorkoutTimerConfig {
  mode: WorkoutTimerMode;
  durationSeconds: number;
  intervalSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  amrapReps: number;
  showAmrapReps?: boolean;
  emomOpenEnded: boolean;
  silent: boolean;
  amrapSets?: AmrapSet[];
  sets?: number;
  setRestSeconds?: number;
  emomDurationSeconds?: number;
  forTimeCapSeconds?: number;
  signalSeconds?: number;
  mixBlocks?: MixBlock[];
}

export interface WorkoutTimerSnapshot {
  elapsedMs: number;
  totalMs: number | null;
  mainRemainingMs: number;
  overallRemainingMs: number | null;
  round: number;
  totalRounds: number | null;
  isLastRound: boolean;
  phase: "ready" | "work" | "rest" | "finished";
  finished: boolean;
  set?: number;
  totalSets?: number;
  segmentIndex?: number;
  segmentElapsedMs?: number;
  segmentDurationMs?: number | null;
  activeMode?: WorkoutTimerMode;
  label?: string;
}

export const DEFAULT_TIMER_CONFIG: WorkoutTimerConfig = {
  mode: "countdown",
  durationSeconds: 90,
  intervalSeconds: 60,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
  amrapReps: 10,
  emomOpenEnded: false,
  silent: false,
  sets: 1,
  setRestSeconds: 120,
  forTimeCapSeconds: 0,
  signalSeconds: 0,
};

export const TIMER_MODE_LABELS: Record<WorkoutTimerMode, { title: string; description: string }> = {
  countdown: { title: "Countdown", description: "Recupero o conto alla rovescia" },
  stopwatch: { title: "FOR TIME", description: "Cronometro: termina quando hai finito il lavoro" },
  emom: { title: "EMOM", description: "Un intervallo per ogni round" },
  tabata: { title: "Tabata", description: "Alterna lavoro e recupero" },
  amrap: { title: "AMRAP", description: "Più round possibili nel tempo" },
  mix: { title: "MIX", description: "Combina timer, lavoro e recupero" },
};
