import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMER_CONFIG } from "./types";
import { timerConfigKey, useWorkoutTimer } from "./useWorkoutTimer";

const storageKey = "spg:active-workout-timer:v1";

describe("useWorkoutTimer persistence", () => {
  it("uses a stable configuration key regardless of property insertion order", () => {
    const c = { ...DEFAULT_TIMER_CONFIG, amrapSets: [{ durationSeconds: 10, restSeconds: 0 }] };
    const reordered = Object.fromEntries(Object.entries(c).reverse()) as typeof c;
    expect(timerConfigKey(c)).toBe(timerConfigKey(reordered));
  });
  it("releases a wake lock that resolves after the timer is paused", async () => {
    let resolveLock!: (lock: { release: () => Promise<void>; addEventListener: () => void }) => void;
    const release = vi.fn(async () => {});
    const previous = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: vi.fn(() => new Promise(resolve => { resolveLock = resolve; })) } });
    const view = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    try {
      act(() => view.result.current.start());
      act(() => view.result.current.pause());
      await act(async () => { resolveLock({ release, addEventListener: () => {} }); });
      expect(release).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      if (previous) Object.defineProperty(navigator, "wakeLock", previous);
      else Reflect.deleteProperty(navigator, "wakeLock");
    }
  });
  it("restores a manually completed FOR TIME set and its paused recovery", () => {
    const config = { ...DEFAULT_TIMER_CONFIG, mode: "stopwatch" as const, sets: 2, setRestSeconds: 10 };
    const first = renderHook(() => useWorkoutTimer(config, "a:exercise"));
    act(() => first.result.current.start());
    act(() => vi.advanceTimersByTime(5_000));
    act(() => first.result.current.completeSet());
    expect(first.result.current.snapshot.phase).toBe("rest");
    act(() => vi.advanceTimersByTime(3_000));
    act(() => first.result.current.pause());
    first.unmount();
    act(() => vi.advanceTimersByTime(20_000));
    const restored = renderHook(() => useWorkoutTimer(config, "a:exercise"));
    expect(restored.result.current.snapshot).toMatchObject({ phase: "rest", mainRemainingMs: 7_000 });
    act(() => restored.result.current.resume());
    act(() => vi.advanceTimersByTime(7_000));
    expect(restored.result.current.snapshot).toMatchObject({ set: 2, phase: "work", mainRemainingMs: 0 });
    act(() => vi.advanceTimersByTime(2_000));
    act(() => restored.result.current.completeSet());
    expect(restored.result.current.status).toBe("finished");
    expect(localStorage.getItem(storageKey)).toBeNull();
    restored.unmount();
  });
  it("restores AMRAP rounds after restart without adding paused time", () => {
    const config = { ...DEFAULT_TIMER_CONFIG, mode: "amrap" as const };
    const first = renderHook(() => useWorkoutTimer(config, "user-a:exercise-a"));
    act(() => first.result.current.start());
    act(() => { first.result.current.adjustRounds(1); first.result.current.adjustRounds(1); });
    act(() => vi.advanceTimersByTime(5_000));
    act(() => first.result.current.pause());
    first.unmount();
    act(() => vi.advanceTimersByTime(30_000));
    const restored = renderHook(() => useWorkoutTimer(config, "user-a:exercise-a"));
    expect(restored.result.current.completedRounds).toBe(2);
    expect(restored.result.current.snapshot.elapsedMs).toBe(5_000);
    expect(restored.result.current.status).toBe("paused");
    act(() => restored.result.current.reset());
    expect(restored.result.current.completedRounds).toBe(0);
    expect(localStorage.getItem(storageKey)).toBeNull();
    restored.unmount();
  });

  it.each(["user-b:exercise-a", "user-a:exercise-b", "standalone"])("does not restore another timer scope: %s", (scope) => {
    const first = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG, "user-a:exercise-a"));
    act(() => first.result.current.start());
    first.unmount();
    const other = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG, scope));
    expect(other.result.current.status).toBe("idle");
    expect(other.result.current.snapshot.elapsedMs).toBe(0);
    other.unmount();
  });

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

  it("does not resume an AMRAP configured with a different rep target", () => {
    const config = { ...DEFAULT_TIMER_CONFIG, mode: "amrap" as const, amrapReps: 15 };
    localStorage.setItem(storageKey, JSON.stringify({
      mode: "amrap", configKey: timerConfigKey({ ...config, amrapReps: 10 }),
      status: "running", startedAt: Date.now() - 12_000, accumulatedMs: 0,
    }));
    const { result } = renderHook(() => useWorkoutTimer(config));
    expect(result.current.status).toBe("idle");
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
