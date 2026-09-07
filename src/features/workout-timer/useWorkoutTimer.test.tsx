import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMER_CONFIG } from "./types";
import { timerConfigKey, useWorkoutTimer } from "./useWorkoutTimer";

const storageKey = "spg:active-workout-timer:v1";

describe("useWorkoutTimer persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("salva l'orario reale di partenza", () => {
    const { result } = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    act(() => result.current.start());

    expect(JSON.parse(localStorage.getItem(storageKey) || "{}")).toMatchObject({
      mode: "countdown",
      status: "running",
      startedAt: Date.now(),
    });
  });

  it("ricalcola il tempo trascorso dopo una sospensione", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      mode: "countdown",
      configKey: timerConfigKey(DEFAULT_TIMER_CONFIG),
      status: "running",
      startedAt: Date.now() - 12_000,
      accumulatedMs: 0,
    }));

    const { result } = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    expect(result.current.status).toBe("running");
    expect(result.current.snapshot.elapsedMs).toBe(12_000);
    expect(result.current.snapshot.mainRemainingMs).toBe(78_000);
  });

  it("does not restore a timer with different duration but the same mode", () => {
    localStorage.setItem(storageKey, JSON.stringify({
      mode: "countdown", configKey: timerConfigKey({ ...DEFAULT_TIMER_CONFIG, durationSeconds: 30 }),
      status: "running", startedAt: Date.now() - 12_000, accumulatedMs: 0,
    }));
    const { result } = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    expect(result.current.status).toBe("idle");
    expect(result.current.snapshot.elapsedMs).toBe(0);
  });

  it("pause and resume exclude time spent paused", () => {
    const { result } = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5_000));
    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.snapshot.elapsedMs).toBe(5_000);
    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.snapshot.elapsedMs).toBe(8_000);
  });
});
