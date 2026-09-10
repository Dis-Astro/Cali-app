import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTimerSegments, snapshotFromSegments } from "./timerModel";
import { parseTimerSettings } from "./timerSettings";
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
  configKey: string;
  status: "running" | "paused";
  startedAt: number | null;
  accumulatedMs: number;
  sessionScope?: string;
  completedRounds?: number;
  earlyFinishes?: Record<number, number>;
}

export function timerConfigKey(config: WorkoutTimerConfig) {
  return `timeline-v2:${JSON.stringify({ ...parseTimerSettings(config), silent: undefined })}`;
}

function readTimerState(config: WorkoutTimerConfig, sessionScope: string): StoredTimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredTimerState;
    const valid = stored.configKey === timerConfigKey(config)
      && (stored.sessionScope ?? "standalone") === sessionScope
      && ["running", "paused"].includes(stored.status)
      && Number.isFinite(stored.accumulatedMs) && stored.accumulatedMs >= 0
      && (stored.earlyFinishes === undefined || (stored.earlyFinishes !== null && typeof stored.earlyFinishes === "object" && Object.entries(stored.earlyFinishes).every(([key, value]) => /^\d+$/.test(key) && Number(key) < 10000 && Number.isFinite(value) && value >= 0)))
      && (stored.status === "paused" ? stored.startedAt === null : Number.isFinite(stored.startedAt));
    return valid ? stored : null;
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

export function useWorkoutTimer(config: WorkoutTimerConfig, sessionScope = "standalone") {
  const [restoredState] = useState(() => readTimerState(config, sessionScope));
  const [status, setStatus] = useState<WorkoutTimerStatus>(restoredState?.status ?? "idle");
  const [elapsedMs, setElapsedMs] = useState(() => {
    const restored = restoredState;
    if (!restored) return 0;
    return restored.accumulatedMs + (restored.status === "running" && restored.startedAt ? Math.max(0, Date.now() - restored.startedAt) : 0);
  });
  const startedAtRef = useRef<number | null>(restoredState?.startedAt ?? null);
  const accumulatedRef = useRef(restoredState?.accumulatedMs ?? 0);
  const [completedRounds, setCompletedRounds] = useState(() => {
    const value = restoredState?.completedRounds;
    return Number.isSafeInteger(value) && value! >= 0 ? value! : 0;
  });
  const completedRoundsRef = useRef(completedRounds);
  const [earlyFinishes, setEarlyFinishes] = useState<Record<number, number>>(restoredState?.earlyFinishes ?? {});
  const finishesRef = useRef(earlyFinishes);
  const segments = useMemo(() => buildTimerSegments(config), [config]);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const wakeGeneration = useRef(0);

  const calculateElapsed = useCallback(() => {
    if (startedAtRef.current === null) return accumulatedRef.current;
    return accumulatedRef.current + Math.max(0, Date.now() - startedAtRef.current);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    wakeGeneration.current++;
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) await lock.release().catch(() => undefined);
  }, []);

  const requestWakeLock = useCallback(async () => {
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    if (!navigatorWithWakeLock.wakeLock || document.visibilityState !== "visible") return;
    const generation = ++wakeGeneration.current;
    const old = wakeLockRef.current;
    wakeLockRef.current = null;
    if (old) await old.release().catch(() => undefined);
    if (generation !== wakeGeneration.current) return;
    try {
      const lock = await navigatorWithWakeLock.wakeLock.request("screen");
      if (generation !== wakeGeneration.current || document.visibilityState !== "visible") {
        await lock.release().catch(() => undefined);
        return;
      }
      wakeLockRef.current = lock;
      lock.addEventListener("release", () => {
        if (wakeLockRef.current === lock) wakeLockRef.current = null;
      });
    } catch {
      // Il timer continua normalmente se il dispositivo non consente il wake lock.
    }
  }, []);

  const start = useCallback((startsAt = Date.now()) => {
    accumulatedRef.current = 0;
    completedRoundsRef.current = 0;
    setCompletedRounds(0);
    finishesRef.current = {};
    setEarlyFinishes({});
    startedAtRef.current = startsAt;
    setElapsedMs(Math.max(0, Date.now() - startsAt));
    setStatus("running");
    writeTimerState({ mode: config.mode, configKey: timerConfigKey(config), sessionScope, earlyFinishes: finishesRef.current, completedRounds: 0, status: "running", startedAt: startedAtRef.current, accumulatedMs: 0 });
  }, [config, sessionScope]);

  const pause = useCallback(() => {
    if (startedAtRef.current === null) return;
    accumulatedRef.current = calculateElapsed();
    startedAtRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setStatus("paused");
    writeTimerState({ mode: config.mode, configKey: timerConfigKey(config), sessionScope, earlyFinishes: finishesRef.current, completedRounds: completedRoundsRef.current, status: "paused", startedAt: null, accumulatedMs: accumulatedRef.current });
    void releaseWakeLock();
  }, [calculateElapsed, config, releaseWakeLock, sessionScope]);

  const resume = useCallback(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = Date.now();
    setStatus("running");
    writeTimerState({ mode: config.mode, configKey: timerConfigKey(config), sessionScope, earlyFinishes: finishesRef.current, completedRounds: completedRoundsRef.current, status: "running", startedAt: startedAtRef.current, accumulatedMs: accumulatedRef.current });
  }, [config, sessionScope]);

  const adjustRounds = useCallback((delta: number) => {
    if ((status !== "running" && status !== "paused") || !Number.isSafeInteger(delta)) return;
    const next = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, completedRoundsRef.current + delta));
    completedRoundsRef.current = next;
    setCompletedRounds(next);
    writeTimerState({ mode: config.mode, configKey: timerConfigKey(config), sessionScope, earlyFinishes: finishesRef.current, completedRounds: next,
      status, startedAt: startedAtRef.current, accumulatedMs: accumulatedRef.current });
  }, [config, sessionScope, status]);

  const reset = useCallback(() => {
    finishesRef.current = {};
    setEarlyFinishes({});
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    completedRoundsRef.current = 0;
    setCompletedRounds(0);
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

  const snapshot = useMemo(() => snapshotFromSegments(config, segments, elapsedMs, earlyFinishes), [config, segments, elapsedMs, earlyFinishes]);

  const completeSet = useCallback(() => {
    if (status !== "running" && status !== "paused") return;
    const elapsed = calculateElapsed();
    const current = snapshotFromSegments(config, segments, elapsed, finishesRef.current);
    if (current.activeMode !== "stopwatch" || current.phase !== "work" || current.finished) return;
    const next = { ...finishesRef.current, [current.segmentIndex!]: current.segmentElapsedMs! };
    finishesRef.current = next;
    setEarlyFinishes(next);
    setElapsedMs(elapsed);
    writeTimerState({ mode: config.mode, configKey: timerConfigKey(config), sessionScope, earlyFinishes: finishesRef.current, completedRounds: completedRoundsRef.current,
      status, startedAt: startedAtRef.current, accumulatedMs: accumulatedRef.current });
    if (snapshotFromSegments(config, segments, elapsed, next).finished) finish();
  }, [calculateElapsed, config, finish, segments, sessionScope, status]);

  useEffect(() => {
    if (status !== "running") return;
    void requestWakeLock();
    const tick = () => setElapsedMs(calculateElapsed());
    tick();
    const interval = window.setInterval(tick, 100);
    return () => { window.clearInterval(interval); void releaseWakeLock(); };
  }, [calculateElapsed, releaseWakeLock, requestWakeLock, status]);

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

  return { status, snapshot, segments, completedRounds, adjustRounds, completeSet, start, pause, resume, finish, reset };
}
