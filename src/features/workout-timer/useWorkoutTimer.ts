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

export function useWorkoutTimer(config: WorkoutTimerConfig) {
  const [status, setStatus] = useState<WorkoutTimerStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
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
    void requestWakeLock();
  }, [requestWakeLock]);

  const pause = useCallback(() => {
    if (startedAtRef.current === null) return;
    accumulatedRef.current = calculateElapsed();
    startedAtRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setStatus("paused");
    void releaseWakeLock();
  }, [calculateElapsed, releaseWakeLock]);

  const resume = useCallback(() => {
    if (startedAtRef.current !== null) return;
    startedAtRef.current = Date.now();
    setStatus("running");
    void requestWakeLock();
  }, [requestWakeLock]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setStatus("idle");
    void releaseWakeLock();
  }, [releaseWakeLock]);

  const finish = useCallback(() => {
    accumulatedRef.current = calculateElapsed();
    startedAtRef.current = null;
    setElapsedMs(accumulatedRef.current);
    setStatus("finished");
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
    void releaseWakeLock();
  }, [releaseWakeLock, snapshot.elapsedMs, snapshot.finished, status]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && status === "running") {
        setElapsedMs(calculateElapsed());
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [calculateElapsed, requestWakeLock, status]);

  useEffect(() => () => { void releaseWakeLock(); }, [releaseWakeLock]);

  return { status, snapshot, start, pause, resume, finish, reset };
}
