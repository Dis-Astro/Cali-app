export type WorkoutTimerMode = "countdown" | "stopwatch" | "emom" | "tabata" | "amrap";

export type WorkoutTimerStatus = "idle" | "running" | "paused" | "finished";

export interface WorkoutTimerConfig {
  mode: WorkoutTimerMode;
  durationSeconds: number;
  intervalSeconds: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  silent: boolean;
}

export interface WorkoutTimerSnapshot {
  elapsedMs: number;
  totalMs: number | null;
  mainRemainingMs: number;
  overallRemainingMs: number | null;
  round: number;
  totalRounds: number | null;
  phase: "ready" | "work" | "rest" | "finished";
  finished: boolean;
}

export const DEFAULT_TIMER_CONFIG: WorkoutTimerConfig = {
  mode: "countdown",
  durationSeconds: 90,
  intervalSeconds: 60,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
  silent: false,
};

export const TIMER_MODE_LABELS: Record<WorkoutTimerMode, { title: string; description: string }> = {
  countdown: { title: "Countdown", description: "Recupero o conto alla rovescia" },
  stopwatch: { title: "Cronometro", description: "Tempo crescente / For Time" },
  emom: { title: "EMOM", description: "Un intervallo per ogni round" },
  tabata: { title: "Tabata", description: "Alterna lavoro e recupero" },
  amrap: { title: "AMRAP", description: "Più round possibili nel tempo" },
};
