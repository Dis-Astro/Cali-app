import type { WorkoutTimerConfig, WorkoutTimerMode, WorkoutTimerSnapshot } from "./types";
import { parseTimerSettings } from "./timerSettings";

export interface TimerSegment {
  durationMs: number | null;
  phase: "work" | "rest";
  mode: WorkoutTimerMode;
  set: number;
  totalSets: number;
  round: number;
  totalRounds: number | null;
  label?: string;
}
const positive = (n: number) => Math.max(1, n) * 1000;
const rest = (n: number) => Math.max(0, n) * 1000;

/** Ordered intervals observed in SmartWOD 1.46.4. No final rest after a set. */
export function buildTimerSegments(config: WorkoutTimerConfig): TimerSegment[] {
  if (!parseTimerSettings(config)) throw new Error("Configurazione non valida o troppo estesa: riduci durata, intervalli o ripetizioni.");
  const result: TimerSegment[] = [];
  const sets = Math.max(1, config.sets ?? 1);
  const add = (durationMs: number | null, phase: "work" | "rest", mode: WorkoutTimerMode, set: number, totalSets: number, round = 1, totalRounds: number | null = null, label?: string) => {
    if (durationMs === 0) return;
    result.push({ durationMs, phase, mode, set, totalSets, round, totalRounds, label });
  };
  if (config.mode === "mix") {
    for (let set = 1; set <= sets; set++) {
      for (const block of config.mixBlocks ?? []) {
        for (let repeat = 0; repeat < block.repeats; repeat++) {
          if (block.kind === "work" || block.kind === "rest") {
            add(positive(block.durationSeconds), block.kind, "countdown", set, sets, 1, null, block.label);
          } else {
            const child = buildTimerSegments({ ...config, ...block, mode: block.kind, sets: 1, amrapSets: undefined,
              emomOpenEnded: false, emomDurationSeconds: block.durationSeconds,
              forTimeCapSeconds: block.kind === "stopwatch" ? block.durationSeconds : 0 });
            result.push(...child.map((segment) => ({ ...segment, set, totalSets: sets, label: block.label })));
          }
        }
      }
    }
    return result;
  }
  if (config.mode === "amrap") {
    const blocks = config.amrapSets?.length ? config.amrapSets : [{ durationSeconds: config.durationSeconds, restSeconds: 0 }];
    blocks.forEach((block, index) => {
      add(positive(block.durationSeconds), "work", "amrap", index + 1, blocks.length);
      if (index < blocks.length - 1) add(rest(block.restSeconds), "rest", "amrap", index + 1, blocks.length);
    });
    return result;
  }
  for (let set = 1; set <= (config.emomOpenEnded && config.mode === "emom" ? 1 : sets); set++) {
    if (config.mode === "tabata") {
      for (let round = 1; round <= config.rounds; round++) {
        add(positive(config.workSeconds), "work", "tabata", set, sets, round, config.rounds);
        if (round < config.rounds) add(rest(config.restSeconds), "rest", "tabata", set, sets, round, config.rounds);
      }
    } else if (config.mode === "emom") {
      if (config.emomOpenEnded) {
        add(null, "work", "emom", 1, 1);
        return result;
      }
      const duration = config.emomDurationSeconds ?? config.intervalSeconds * config.rounds;
      const rounds = Math.ceil(duration / config.intervalSeconds);
      for (let round = 1; round <= rounds; round++) {
        add(positive(Math.min(config.intervalSeconds, duration - (round - 1) * config.intervalSeconds)), "work", "emom", set, sets, round, rounds);
      }
    } else if (config.mode === "stopwatch") {
      add(config.forTimeCapSeconds ? positive(config.forTimeCapSeconds) : null, "work", "stopwatch", set, sets);
    } else add(positive(config.durationSeconds), "work", "countdown", set, sets);
    if (set < sets) add(rest(config.setRestSeconds ?? 120), "rest", config.mode, set, sets);
  }
  return result;
}

export function getTimerTotalMs(config: WorkoutTimerConfig): number | null {
  const segments = buildTimerSegments(config);
  return segments.some((segment) => segment.durationMs === null) ? null : segments.reduce((sum, segment) => sum + segment.durationMs!, 0);
}

/** Early FOR TIME finishes shorten only their own work interval, never a recovery. */
export function snapshotFromSegments(config: WorkoutTimerConfig, segments: TimerSegment[], rawElapsedMs: number, finishes: Record<number, number> = {}): WorkoutTimerSnapshot {
  const elapsed = Math.max(0, rawElapsedMs);
  const duration = (segment: TimerSegment, index: number) => segment.mode === "stopwatch" && segment.phase === "work" && finishes[index] !== undefined
    ? Math.min(segment.durationMs ?? Infinity, Math.max(0, finishes[index])) : segment.durationMs;
  let total: number | null = 0;
  for (let i = 0; i < segments.length; i++) {
    const ms = duration(segments[i], i);
    if (ms === null) { total = null; break; }
    total += ms;
  }
  let offset = 0;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const ms = duration(segment, index);
    if (ms === null || elapsed < offset + ms) {
      const local = elapsed - offset;
      const openEmom = segment.mode === "emom" && ms === null;
      const intervalMs = positive(config.intervalSeconds);
      const round = openEmom ? Math.floor(local / intervalMs) + 1 : segment.round;
      return {
        elapsedMs: elapsed, totalMs: total,
        mainRemainingMs: openEmom ? intervalMs - local % intervalMs : segment.mode === "stopwatch" && segment.phase === "work" ? local : Math.max(0, (ms ?? 0) - local),
        overallRemainingMs: total === null ? null : total - elapsed,
        round, totalRounds: segment.totalRounds, isLastRound: segment.totalRounds !== null && round === segment.totalRounds,
        phase: segment.phase, finished: false, set: segment.set, totalSets: segment.totalSets,
        segmentIndex: index, segmentElapsedMs: local, segmentDurationMs: openEmom ? intervalMs : ms,
        activeMode: segment.mode, label: segment.label,
      };
    }
    offset += ms;
  }
  const last = segments[segments.length - 1];
  return { elapsedMs: offset, totalMs: offset, mainRemainingMs: last?.mode === "stopwatch" ? duration(last, segments.length - 1) ?? 0 : 0,
    overallRemainingMs: 0, round: last?.round ?? 1, totalRounds: last?.totalRounds ?? null,
    isLastRound: !!last?.totalRounds, phase: "finished", finished: true,
    set: last?.set ?? 1, totalSets: last?.totalSets ?? 1, segmentIndex: Math.max(0, segments.length - 1),
    segmentElapsedMs: last ? duration(last, segments.length - 1) ?? 0 : 0, segmentDurationMs: last?.durationMs ?? 0, activeMode: last?.mode ?? config.mode, label: last?.label };
}

export function getTimerSnapshot(config: WorkoutTimerConfig, elapsedMs: number): WorkoutTimerSnapshot {
  return snapshotFromSegments(config, buildTimerSegments(config), elapsedMs);
}

export function formatTimerTime(milliseconds: number, direction: "remaining" | "elapsed" = "remaining"): string {
  const totalSeconds = Math.max(0, direction === "elapsed" ? Math.floor(milliseconds / 1000) : Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return hours > 0 ? `${hours.toString().padStart(2, "0")}:${base}` : base;
}
