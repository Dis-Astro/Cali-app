import { DEFAULT_TIMER_CONFIG, type WorkoutTimerConfig, type WorkoutTimerMode } from "./types";
import { z } from "zod";

const key = (mode: WorkoutTimerMode) => `spg:timer-settings:v1:${mode}`;

export function defaultTimerSettings(mode: WorkoutTimerMode): WorkoutTimerConfig {
  return { ...DEFAULT_TIMER_CONFIG, mode, durationSeconds: mode === "amrap" ? 600 : 90, rounds: mode === "emom" ? 10 : 8,
    ...(mode === "emom" ? { emomDurationSeconds: 600 } : {}) };
}

const seconds = z.number().int().min(1).max(10859);
const recovery = z.number().int().min(0).max(10859);
const shortSeconds = z.number().int().min(1).max(1859);
const mixBlock = z.object({
  id: z.string().min(1).max(100), label: z.string().max(80),
  kind: z.enum(["work", "rest", "amrap", "stopwatch", "emom", "tabata"]),
  durationSeconds: seconds, intervalSeconds: shortSeconds, workSeconds: shortSeconds,
  restSeconds: z.number().int().min(0).max(1859), rounds: z.number().int().min(1).max(50), repeats: z.number().int().min(1).max(10),
});
const configSchema = z.object({
  mode: z.enum(["countdown", "stopwatch", "emom", "tabata", "amrap", "mix"]),
  durationSeconds: seconds, intervalSeconds: shortSeconds, workSeconds: shortSeconds,
  restSeconds: z.number().int().min(0).max(1859), rounds: z.number().int().min(1).max(100),
  amrapReps: z.number().int().min(1).max(200).catch(10),
  showAmrapReps: z.boolean().optional(),
  silent: z.boolean(), emomOpenEnded: z.boolean(),
  sets: z.number().int().min(1).max(20).optional(), setRestSeconds: recovery.optional(),
  emomDurationSeconds: seconds.optional(), forTimeCapSeconds: recovery.optional(), signalSeconds: recovery.optional(),
  amrapSets: z.array(z.object({ durationSeconds: seconds, restSeconds: recovery })).min(1).max(20).optional(),
  mixBlocks: z.array(mixBlock).max(20).optional(),
});

export const MAX_TIMER_SEGMENTS = 5000;
export function parseTimerSettings(value: unknown): WorkoutTimerConfig | null {
  const parsed = configSchema.safeParse(value);
  if (!parsed.success) return null;
  const c = parsed.data as WorkoutTimerConfig;
  const sets = c.sets ?? 1;
  const intervals = c.mode === "mix" ? sets * (c.mixBlocks ?? []).reduce((sum, b) => sum + b.repeats *
    (b.kind === "emom" ? Math.ceil(b.durationSeconds / b.intervalSeconds) : b.kind === "tabata" ? 2 * b.rounds - 1 : 1), 0)
    : c.mode === "emom" ? c.emomOpenEnded ? 1 : sets * Math.ceil((c.emomDurationSeconds ?? c.rounds * c.intervalSeconds) / c.intervalSeconds) + sets - 1
    : c.mode === "tabata" ? sets * (2 * c.rounds - 1) + sets - 1 : c.mode === "amrap" ? 2 * (c.amrapSets?.length ?? 1) - 1 : 2 * sets - 1;
  return intervals <= MAX_TIMER_SEGMENTS ? c : null;
}

export function loadTimerSettings(mode: WorkoutTimerMode): WorkoutTimerConfig {
  const fallback = defaultTimerSettings(mode);
  try {
    const value = JSON.parse(localStorage.getItem(key(mode)) ?? "null");
    if (!value || value.mode !== mode) return fallback;
    return parseTimerSettings(value) ?? fallback;
  } catch { return fallback; }
}

export function saveTimerSettings(config: WorkoutTimerConfig) {
  const validated = parseTimerSettings(config);
  if (!validated) return;
  try { localStorage.setItem(key(config.mode), JSON.stringify(validated)); }
  catch { /* A blocked storage must never stop a workout. */ }
}
