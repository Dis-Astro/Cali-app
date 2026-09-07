import { DEFAULT_TIMER_CONFIG, type WorkoutTimerConfig, type WorkoutTimerMode } from "./types";

const key = (mode: WorkoutTimerMode) => `spg:timer-settings:v1:${mode}`;

export function defaultTimerSettings(mode: WorkoutTimerMode): WorkoutTimerConfig {
  return { ...DEFAULT_TIMER_CONFIG, mode, durationSeconds: mode === "amrap" ? 600 : 90, rounds: mode === "emom" ? 10 : 8 };
}

export function loadTimerSettings(mode: WorkoutTimerMode): WorkoutTimerConfig {
  const fallback = defaultTimerSettings(mode);
  try {
    const value = JSON.parse(localStorage.getItem(key(mode)) ?? "null");
    if (!value || value.mode !== mode || typeof value.silent !== "boolean" || typeof value.emomOpenEnded !== "boolean") return fallback;
    const limits = { durationSeconds: 10859, intervalSeconds: 1859, workSeconds: 1859, restSeconds: 1859, rounds: 100 };
    for (const [field, max] of Object.entries(limits)) {
      if (!Number.isInteger(value[field]) || value[field] < 1 || value[field] > max) return fallback;
    }
    return { ...fallback, ...value };
  } catch { return fallback; }
}

export function saveTimerSettings(config: WorkoutTimerConfig) {
  try { localStorage.setItem(key(config.mode), JSON.stringify(config)); }
  catch { /* A blocked storage must never stop a workout. */ }
}
