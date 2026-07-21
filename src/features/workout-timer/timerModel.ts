import type { WorkoutTimerConfig, WorkoutTimerSnapshot } from "./types";

const secondsToMs = (seconds: number) => Math.max(1, seconds) * 1000;

export function getTimerTotalMs(config: WorkoutTimerConfig): number | null {
  switch (config.mode) {
    case "stopwatch":
      return null;
    case "emom":
      if (config.emomOpenEnded) return null;
      return secondsToMs(config.intervalSeconds) * Math.max(1, config.rounds);
    case "tabata":
      return (
        secondsToMs(config.workSeconds) * Math.max(1, config.rounds)
        + secondsToMs(config.restSeconds) * Math.max(0, config.rounds - 1)
      );
    case "countdown":
    case "amrap":
      return secondsToMs(config.durationSeconds);
  }
}

export function getTimerSnapshot(config: WorkoutTimerConfig, rawElapsedMs: number): WorkoutTimerSnapshot {
  const totalMs = getTimerTotalMs(config);
  const elapsedMs = Math.max(0, totalMs === null ? rawElapsedMs : Math.min(rawElapsedMs, totalMs));
  const finished = totalMs !== null && elapsedMs >= totalMs;

  if (finished) {
    return {
      elapsedMs,
      totalMs,
      mainRemainingMs: 0,
      overallRemainingMs: 0,
      round: Math.max(1, config.rounds),
      totalRounds: config.mode === "emom" || config.mode === "tabata" ? Math.max(1, config.rounds) : null,
      isLastRound: config.mode === "emom" || config.mode === "tabata",
      phase: "finished",
      finished: true,
    };
  }

  if (config.mode === "stopwatch") {
    return {
      elapsedMs,
      totalMs: null,
      mainRemainingMs: elapsedMs,
      overallRemainingMs: null,
      round: 1,
      totalRounds: null,
      isLastRound: false,
      phase: "work",
      finished: false,
    };
  }

  if (config.mode === "emom") {
    const intervalMs = secondsToMs(config.intervalSeconds);
    const round = Math.floor(elapsedMs / intervalMs) + 1;
    const totalRounds = config.emomOpenEnded ? null : Math.max(1, config.rounds);
    return {
      elapsedMs,
      totalMs,
      mainRemainingMs: intervalMs - (elapsedMs % intervalMs),
      overallRemainingMs: totalMs === null ? null : Math.max(0, totalMs - elapsedMs),
      round,
      totalRounds,
      isLastRound: totalRounds !== null && round === totalRounds,
      phase: "work",
      finished: false,
    };
  }

  if (config.mode === "tabata") {
    const workMs = secondsToMs(config.workSeconds);
    const restMs = secondsToMs(config.restSeconds);
    const cycleMs = workMs + restMs;
    const completedCycles = Math.floor(elapsedMs / cycleMs);
    const positionInCycle = elapsedMs - completedCycles * cycleMs;
    const isWork = positionInCycle < workMs;

    return {
      elapsedMs,
      totalMs,
      mainRemainingMs: isWork ? workMs - positionInCycle : cycleMs - positionInCycle,
      overallRemainingMs: Math.max(0, totalMs! - elapsedMs),
      round: Math.min(completedCycles + 1, Math.max(1, config.rounds)),
      totalRounds: Math.max(1, config.rounds),
      isLastRound: completedCycles + 1 === Math.max(1, config.rounds),
      phase: isWork ? "work" : "rest",
      finished: false,
    };
  }

  return {
    elapsedMs,
    totalMs,
    mainRemainingMs: Math.max(0, totalMs! - elapsedMs),
    overallRemainingMs: Math.max(0, totalMs! - elapsedMs),
    round: 1,
    totalRounds: null,
    isLastRound: false,
    phase: "work",
    finished: false,
  };
}

export function formatTimerTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return hours > 0 ? `${hours.toString().padStart(2, "0")}:${base}` : base;
}
