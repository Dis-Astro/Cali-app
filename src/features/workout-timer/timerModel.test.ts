import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_CONFIG, type WorkoutTimerConfig } from "./types";
import { buildTimerSegments, formatTimerTime, getTimerSnapshot, getTimerTotalMs, snapshotFromSegments } from "./timerModel";

const config = (overrides: Partial<WorkoutTimerConfig>): WorkoutTimerConfig => ({ ...DEFAULT_TIMER_CONFIG, ...overrides });

describe("workout timer model", () => {
  it("repeats nested MIX groups in order, without inserting implicit recoveries", () => {
    const leaf = { id: "leaf", label: "Squat", kind: "work" as const, durationSeconds: 2, intervalSeconds: 60, workSeconds: 20, restSeconds: 10, rounds: 8, repeats: 1 };
    const inner = { ...leaf, id: "inner", kind: "group" as const, label: "Interno", repeats: 2, children: [leaf, { ...leaf, id: "rest", kind: "rest" as const, durationSeconds: 1 }] };
    const c = config({ mode: "mix", sets: 2, mixBlocks: [{ ...inner, id: "outer", label: "Esterno", repeats: 3, children: [inner] }] });
    expect(getTimerTotalMs(c)).toBe(36_000);
    expect(getTimerSnapshot(c, 2_000)).toMatchObject({ phase: "rest", label: "Esterno 1/3 · Interno 1/2 · Squat" });
    expect(getTimerSnapshot(c, 3_000)).toMatchObject({ phase: "work", label: "Esterno 1/3 · Interno 2/2 · Squat" });
    expect(getTimerSnapshot(c, 6_000).label).toBe("Esterno 2/3 · Interno 1/2 · Squat");
    expect(getTimerSnapshot(c, 18_000)).toMatchObject({ set: 2, phase: "work" });
    expect(getTimerSnapshot(c, 36_000).finished).toBe(true);
  });
  it("does not count an elapsed second before it has actually passed", () => {
    expect(formatTimerTime(100, "elapsed")).toBe("00:00");
    expect(formatTimerTime(999, "elapsed")).toBe("00:00");
    expect(formatTimerTime(1000, "elapsed")).toBe("00:01");
    expect(formatTimerTime(100)).toBe("00:01");
  });
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
    expect(snapshot.isLastRound).toBe(false);
  });

  it("supporta un EMOM a cedimento senza limite di round", () => {
    const openEmom = config({ mode: "emom", intervalSeconds: 50, rounds: 4, emomOpenEnded: true });
    const snapshot = getTimerSnapshot(openEmom, 265_000);
    expect(getTimerTotalMs(openEmom)).toBeNull();
    expect(snapshot.round).toBe(6);
    expect(snapshot.totalRounds).toBeNull();
    expect(snapshot.mainRemainingMs).toBe(35_000);
    expect(snapshot.finished).toBe(false);
  });

  it("segnala l'ultima serie nei timer finiti", () => {
    const emom = config({ mode: "emom", intervalSeconds: 60, rounds: 3 });
    const tabata = config({ mode: "tabata", workSeconds: 20, restSeconds: 10, rounds: 3 });
    expect(getTimerSnapshot(emom, 120_000).isLastRound).toBe(true);
    expect(getTimerSnapshot(tabata, 60_000).isLastRound).toBe(true);
  });

  it("alterna lavoro e recupero nel Tabata", () => {
    const tabata = config({ mode: "tabata", workSeconds: 20, restSeconds: 10, rounds: 8 });
    expect(getTimerSnapshot(tabata, 5_000).phase).toBe("work");
    expect(getTimerSnapshot(tabata, 22_000).phase).toBe("rest");
    expect(getTimerSnapshot(tabata, 31_000).round).toBe(2);
    // Verified directly in SmartWOD 1.46.4: no recovery after the final round.
    expect(getTimerTotalMs(tabata)).toBe(230_000);
    expect(getTimerSnapshot(tabata, 229_999)).toMatchObject({ round: 8, phase: "work", finished: false });
    expect(getTimerSnapshot(tabata, 230_000).finished).toBe(true);
    expect(getTimerTotalMs({ ...tabata, sets: 3, setRestSeconds: 120 })).toBe(930_000);
  });

  it("usa un cronometro senza limite", () => {
    const snapshot = getTimerSnapshot(config({ mode: "stopwatch" }), 3_661_000);
    expect(snapshot.totalMs).toBeNull();
    expect(snapshot.mainRemainingMs).toBe(3_661_000);
    expect(formatTimerTime(snapshot.mainRemainingMs)).toBe("01:01:01");
  });

  it("sequences independently timed AMRAP sets and only intermediate rests", () => {
    const c = config({ mode: "amrap", amrapSets: [{ durationSeconds: 20, restSeconds: 10 }, { durationSeconds: 30, restSeconds: 120 }] });
    expect(getTimerTotalMs(c)).toBe(60_000);
    expect(getTimerSnapshot(c, 19_999)).toMatchObject({ set: 1, phase: "work", mainRemainingMs: 1 });
    expect(getTimerSnapshot(c, 20_000)).toMatchObject({ set: 1, phase: "rest", mainRemainingMs: 10_000 });
    expect(getTimerSnapshot(c, 30_000)).toMatchObject({ set: 2, phase: "work", mainRemainingMs: 30_000 });
    expect(getTimerSnapshot(c, 60_000).finished).toBe(true);
    expect(getTimerSnapshot({ ...c, amrapSets: c.amrapSets!.map(s => ({ ...s, restSeconds: 0 })) }, 20_000)).toMatchObject({ set: 2, phase: "work" });
  });

  it("uses EMOM total duration, including a partial last interval and repeated sets", () => {
    const c = config({ mode: "emom", intervalSeconds: 60, emomDurationSeconds: 150, sets: 2, setRestSeconds: 10 });
    expect(getTimerTotalMs(c)).toBe(310_000);
    expect(getTimerSnapshot(c, 120_000)).toMatchObject({ round: 3, mainRemainingMs: 30_000 });
    expect(getTimerSnapshot(c, 150_000).phase).toBe("rest");
    expect(getTimerSnapshot(c, 160_000)).toMatchObject({ set: 2, round: 1, mainRemainingMs: 60_000 });
  });

  it("shortens only the FOR TIME work set when swiped, preserving rest and following sets", () => {
    const c = config({ mode: "stopwatch", forTimeCapSeconds: 60, sets: 2, setRestSeconds: 10 });
    const segments = buildTimerSegments(c);
    expect(snapshotFromSegments(c, segments, 20_000, { 0: 20_000 })).toMatchObject({ phase: "rest", mainRemainingMs: 10_000, totalMs: 90_000 });
    expect(snapshotFromSegments(c, segments, 30_000, { 0: 20_000 })).toMatchObject({ set: 2, phase: "work", mainRemainingMs: 0 });
    expect(snapshotFromSegments(c, segments, 45_000, { 0: 20_000, 2: 15_000 })).toMatchObject({ finished: true, totalMs: 45_000 });
    expect(getTimerSnapshot(c, 60_000)).toMatchObject({ phase: "rest" });
  });

  it("executes and repeats MIX blocks without accidental inherited sets or rests", () => {
    const base = { id: "a", label: "Squat", durationSeconds: 10, intervalSeconds: 5, workSeconds: 2, restSeconds: 1, rounds: 2, repeats: 1 };
    const c = config({ mode: "mix", sets: 2, mixBlocks: [{ ...base, kind: "amrap", repeats: 2 }, { ...base, id: "b", kind: "rest", durationSeconds: 3 }, { ...base, id: "c", kind: "tabata" }] });
    expect(getTimerTotalMs(c)).toBe(56_000);
    expect(getTimerSnapshot(c, 20_000)).toMatchObject({ phase: "rest", label: "Squat" });
    expect(getTimerSnapshot(c, 23_000)).toMatchObject({ activeMode: "tabata", round: 1 });
    expect(getTimerSnapshot(c, 28_000)).toMatchObject({ set: 2, activeMode: "amrap" });
    expect(getTimerSnapshot(c, 56_000).finished).toBe(true);
  });

  it("rejects unbounded or malformed timelines before allocating intervals", () => {
    expect(() => getTimerTotalMs(config({ mode: "emom", intervalSeconds: 0 }))).toThrow();
    expect(() => getTimerTotalMs(config({ mode: "emom", intervalSeconds: 1, emomDurationSeconds: 10859, sets: 20 }))).toThrow();
    expect(() => getTimerTotalMs(config({ sets: Infinity }))).toThrow();
  });
});
