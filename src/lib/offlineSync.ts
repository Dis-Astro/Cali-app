import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_VERSION = "v1";
const QUEUE_KEY = `spg:offline:${STORAGE_VERSION}:queue`;
const META_KEY = `spg:offline:${STORAGE_VERSION}:meta`;
const CACHE_PREFIX = `spg:offline:${STORAGE_VERSION}:cache:`;

export interface OfflineSnapshot {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface WorkoutCompletionPayload {
  id?: string;
  clientId: string;
  workoutPlanExerciseId: string;
  weekNumber: number;
  clientNotes: string;
  difficultyRating: number;
}

interface PendingWorkoutCompletion {
  id: string;
  type: "workout_completion";
  dedupeKey: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  payload: WorkoutCompletionPayload;
}

type PendingOperation = PendingWorkoutCompletion;

type Listener = (snapshot: OfflineSnapshot) => void;

const listeners = new Set<Listener>();
let initialized = false;
let flushPromise: Promise<void> | null = null;
let snapshot: OfflineSnapshot = {
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
};

function emit() {
  const current = { ...snapshot };
  listeners.forEach((listener) => listener(current));
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readQueue(): Promise<PendingOperation[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  return safeParse<PendingOperation[]>(value, []);
}

async function writeQueue(queue: PendingOperation[]) {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
  snapshot.pendingCount = queue.length;
  emit();
}

async function readMeta() {
  const { value } = await Preferences.get({ key: META_KEY });
  const meta = safeParse<{ lastSyncAt: string | null }>(value, { lastSyncAt: null });
  snapshot.lastSyncAt = meta.lastSyncAt;
}

async function writeMeta() {
  await Preferences.set({
    key: META_KEY,
    value: JSON.stringify({ lastSyncAt: snapshot.lastSyncAt }),
  });
}

function getDedupeKey(payload: WorkoutCompletionPayload) {
  return `workout_completion:${payload.clientId}:${payload.workoutPlanExerciseId}:${payload.weekNumber}`;
}

async function syncWorkoutCompletion(operation: PendingWorkoutCompletion) {
  const payload = operation.payload;
  let completionId = payload.id;

  if (!completionId) {
    const { data: existing, error: lookupError } = await supabase
      .from("workout_completions")
      .select("id")
      .eq("client_id", payload.clientId)
      .eq("workout_plan_exercise_id", payload.workoutPlanExerciseId)
      .eq("set_number", payload.weekNumber)
      .maybeSingle();

    if (lookupError) throw lookupError;
    completionId = existing?.id;
  }

  if (completionId) {
    const { error } = await supabase
      .from("workout_completions")
      .update({
        client_notes: payload.clientNotes,
        difficulty_rating: payload.difficultyRating,
      })
      .eq("id", completionId)
      .eq("client_id", payload.clientId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("workout_completions").insert({
    workout_plan_exercise_id: payload.workoutPlanExerciseId,
    client_id: payload.clientId,
    set_number: payload.weekNumber,
    client_notes: payload.clientNotes,
    difficulty_rating: payload.difficultyRating,
  });

  if (error) throw error;
}

async function refreshOnlineState() {
  snapshot.isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  emit();
}

export async function initializeOfflineSync() {
  if (initialized) return;
  initialized = true;

  const queue = await readQueue();
  snapshot.pendingCount = queue.length;
  await readMeta();
  await refreshOnlineState();

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      snapshot.isOnline = true;
      snapshot.lastError = null;
      emit();
      void flushPendingOperations();
    });

    window.addEventListener("offline", () => {
      snapshot.isOnline = false;
      snapshot.isSyncing = false;
      emit();
    });

    window.setInterval(() => {
      if (navigator.onLine && snapshot.pendingCount > 0) void flushPendingOperations();
    }, 30000);
  }

  if (snapshot.isOnline && queue.length > 0) void flushPendingOperations();
}

export function subscribeOfflineSync(listener: Listener) {
  listeners.add(listener);
  listener({ ...snapshot });
  return () => listeners.delete(listener);
}

export function getOfflineSnapshot() {
  return { ...snapshot };
}

export async function setOfflineCache<T>(key: string, value: T) {
  await Preferences.set({
    key: `${CACHE_PREFIX}${key}`,
    value: JSON.stringify({ value, cachedAt: new Date().toISOString() }),
  });
}

export async function getOfflineCache<T>(key: string): Promise<{ value: T; cachedAt: string } | null> {
  const { value } = await Preferences.get({ key: `${CACHE_PREFIX}${key}` });
  return safeParse<{ value: T; cachedAt: string } | null>(value, null);
}

export async function removeOfflineCache(key: string) {
  await Preferences.remove({ key: `${CACHE_PREFIX}${key}` });
}

export async function getPendingWorkoutCompletions(clientId: string) {
  const queue = await readQueue();
  return queue
    .filter((operation): operation is PendingWorkoutCompletion => operation.type === "workout_completion")
    .filter((operation) => operation.payload.clientId === clientId);
}

export async function queueWorkoutCompletion(payload: WorkoutCompletionPayload) {
  const queue = await readQueue();
  const now = new Date().toISOString();
  const dedupeKey = getDedupeKey(payload);
  const existingIndex = queue.findIndex((operation) => operation.dedupeKey === dedupeKey);

  const operation: PendingWorkoutCompletion = {
    id: existingIndex >= 0 ? queue[existingIndex].id : `${dedupeKey}:${Date.now()}`,
    type: "workout_completion",
    dedupeKey,
    createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : now,
    updatedAt: now,
    attempts: existingIndex >= 0 ? queue[existingIndex].attempts : 0,
    payload,
  };

  if (existingIndex >= 0) queue[existingIndex] = operation;
  else queue.push(operation);

  await writeQueue(queue);

  if (typeof navigator === "undefined" || navigator.onLine) {
    await flushPendingOperations();
  }

  const remaining = await readQueue();
  return {
    synced: !remaining.some((item) => item.dedupeKey === dedupeKey),
    pendingCount: remaining.length,
  };
}

export async function flushPendingOperations() {
  if (flushPromise) return flushPromise;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    snapshot.isOnline = false;
    emit();
    return;
  }

  flushPromise = (async () => {
    snapshot.isOnline = true;
    snapshot.isSyncing = true;
    snapshot.lastError = null;
    emit();

    let queue = await readQueue();

    for (const operation of [...queue]) {
      try {
        if (operation.type === "workout_completion") {
          await syncWorkoutCompletion(operation);
        }

        queue = queue.filter((item) => item.id !== operation.id);
        await writeQueue(queue);
      } catch (error) {
        operation.attempts += 1;
        operation.updatedAt = new Date().toISOString();
        queue = queue.map((item) => (item.id === operation.id ? operation : item));
        await writeQueue(queue);
        snapshot.lastError = error instanceof Error ? error.message : "Sincronizzazione non riuscita";
        break;
      }
    }

    if (queue.length === 0) {
      snapshot.lastSyncAt = new Date().toISOString();
      snapshot.lastError = null;
      await writeMeta();
    }

    snapshot.isSyncing = false;
    snapshot.pendingCount = queue.length;
    emit();
  })().finally(() => {
    flushPromise = null;
  });

  return flushPromise;
}
