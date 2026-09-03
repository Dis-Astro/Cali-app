import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TIMER_CONFIG } from "./types";
import { useWorkoutTimer } from "./useWorkoutTimer";

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
      status: "running",
      startedAt: Date.now() - 12_000,
      accumulatedMs: 0,
    }));

    const { result } = renderHook(() => useWorkoutTimer(DEFAULT_TIMER_CONFIG));
    expect(result.current.status).toBe("running");
    expect(result.current.snapshot.elapsedMs).toBe(12_000);
    expect(result.current.snapshot.mainRemainingMs).toBe(78_000);
  });
});

