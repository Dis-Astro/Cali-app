import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_CONFIG, type WorkoutTimerConfig } from "./types";
import { formatTimerTime, getTimerSnapshot, getTimerTotalMs } from "./timerModel";

const config = (overrides: Partial<WorkoutTimerConfig>): WorkoutTimerConfig => ({ ...DEFAULT_TIMER_CONFIG, ...overrides });

describe("workout timer model", () => {
  it("calcola il countdown sul tempo reale trascorso", () => {
    const snapshot = getTimerSnapshot(config({ mode: "countdown", durationSeconds: 90 }), 31_000);
    expect(snapshot.mainRemainingMs).toBe(59_000);
    expect(snapshot.finished).toBe(false);
  });

  it("termina e limita il tempo oltre la durata", () => {
    const snapshot = getTimerSnapshot(config({ mode: "amrap", durationSeconds: 60 }), 75_000);
    expect(snapshot.elapsedMs).toBe(60_000);
    expect(snapshot.mainRemainingMs).toBe(0);
    expect(snapshot.finished).toBe(true);
  });

  it("cambia round EMOM senza accumulare drift", () => {
    const snapshot = getTimerSnapshot(config({ mode: "emom", intervalSeconds: 60, rounds: 10 }), 125_000);
    expect(snapshot.round).toBe(3);
    expect(snapshot.mainRemainingMs).toBe(55_000);
    expect(snapshot.overallRemainingMs).toBe(475_000);
  });

  it("alterna lavoro e recupero nel Tabata", () => {
    const tabata = config({ mode: "tabata", workSeconds: 20, restSeconds: 10, rounds: 8 });
    expect(getTimerSnapshot(tabata, 5_000).phase).toBe("work");
    expect(getTimerSnapshot(tabata, 22_000).phase).toBe("rest");
    expect(getTimerSnapshot(tabata, 31_000).round).toBe(2);
    expect(getTimerTotalMs(tabata)).toBe(230_000);
  });

  it("usa un cronometro senza limite", () => {
    const snapshot = getTimerSnapshot(config({ mode: "stopwatch" }), 3_661_000);
    expect(snapshot.totalMs).toBeNull();
    expect(snapshot.mainRemainingMs).toBe(3_661_000);
    expect(formatTimerTime(snapshot.mainRemainingMs)).toBe("01:01:01");
  });
});
