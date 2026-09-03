import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTimerSnapshot } from "./timerModel";
import type { WorkoutTimerConfig, WorkoutTimerStatus } from "./types";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const TIMER_STATE_KEY = "spg:active-workout-timer:v1";

interface StoredTimerState {
  mode: WorkoutTimerConfig["mode"];
  status: "running" | "paused";
  startedAt: number | null;
  accumulatedMs: number;
}

function readTimerState(config: WorkoutTimerConfig): StoredTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredTimerState;
    return stored.mode === config.mode ? stored : null;
  } catch {
    return null;
  }
}

function writeTimerState(state: StoredTimerState | null) {
  try {
    if (state) localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(TIMER_STATE_KEY);
  } catch {
    // La persistenza è un'ulteriore protezione: il timer resta operativo anche senza storage.
  }
}

export function useWorkoutTimer(config: WorkoutTimerConfig) {
  const restoredStateRef = useRef(readTimerState(config));
  const [status, setStatus] = useState<WorkoutTimerStatus>(restoredStateRef.current?.status ?? "idle");
  const [elapsedMs, setElapsedMs] = useState(() => {
    const restored = restoredStateRef.current;
    if (!restored) return 0;
    return restored.accumulatedMs + (restored.status === "running" && restored.startedAt ? Math.max(0, Date.now() - restored.startedAt) : 0);
  });
  const startedAtRef = useRef<number | null>(restoredStateRef.current?.startedAt ?? null);
  const accumulatedRef = useRef(restoredStateRef.current?.accumulatedMs ?? 0);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const calculateElapsed = useCallback(() => {
    if (startedAtRef.current === null) return accumulatedRef.current;
    return accumulatedRef.current + Math.max(0, Date.now() - startedAtRef.current);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) await lock.release().catch(() => undefined);
  }, []);

  const requestWakeLock = useCallback(async () => {
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    if (!navigatorWithWakeLock.wakeLock || document.visibilityState !== "visible") return;
    await releaseWakeLock();
    try {
      const lock = await navigatorWithWakeLock.wakeLock.request("screen");
      wakeLockRef.current = lock;
      lock.addEventListener("release", () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
      });
    } catch {
      // Il timer continua normalmente se il dispositivo non consente il wake lock.
    }
  }, [releaseWakeLock]);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setStatus("running");
    writeTimerState({ mode: config.mode, status: "running", startedAt: startedAtRef.current, accumulatedMs: 0 });
    void requestWakeLock();
  }, [config.mode, requestWakeLock]);

  const pause = useCallback(() => {
    if (startedAtRef.current === null) return;
    accumulatedRef.current = calculateElapsed();
    startedAtRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setStatus("paused");
    writeTimerState({ mode: config.mode, status: "paused", startedAt: null, accumulatedMs: accumulatedRef.current });
    void releaseWakeLock();
  }, [calculateElapsed, config.mode, releaseWakeLock]);

  const resume = useCallback(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = Date.now();
    setStatus("running");
    writeTimerState({ mode: config.mode, status: "running", startedAt: startedAtRef.current, accumulatedMs: accumulatedRef.current });
    void requestWakeLock();
  }, [config.mode, requestWakeLock]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setStatus("idle");
    writeTimerState(null);
    void releaseWakeLock();
  }, [releaseWakeLock]);

  const finish = useCallback(() => {
    accumulatedRef.current = calculateElapsed();
    startedAtRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setStatus("finished");
    writeTimerState(null);
    void releaseWakeLock();
  }, [calculateElapsed, releaseWakeLock]);

  const snapshot = useMemo(() => getTimerSnapshot(config, elapsedMs), [config, elapsedMs]);

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => setElapsedMs(calculateElapsed());
    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [calculateElapsed, status]);

  useEffect(() => {
    if (!snapshot.finished || status !== "running") return;
    accumulatedRef.current = snapshot.elapsedMs;
    startedAtRef.current = null;
    setStatus("finished");
    writeTimerState(null);
    void releaseWakeLock();
  }, [releaseWakeLock, snapshot.elapsedMs, snapshot.finished, status]);

  useEffect(() => {
    const refreshFromClock = () => {
      if (status === "running") {
        setElapsedMs(calculateElapsed());
        if (document.visibilityState === "visible") void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", refreshFromClock);
    document.addEventListener("resume", refreshFromClock);
    window.addEventListener("focus", refreshFromClock);
    window.addEventListener("pageshow", refreshFromClock);
    return () => {
      document.removeEventListener("visibilitychange", refreshFromClock);
      document.removeEventListener("resume", refreshFromClock);
      window.removeEventListener("focus", refreshFromClock);
      window.removeEventListener("pageshow", refreshFromClock);
    };
  }, [calculateElapsed, requestWakeLock, status]);

  useEffect(() => () => { void releaseWakeLock(); }, [releaseWakeLock]);

  return { status, snapshot, start, pause, resume, finish, reset };
}
