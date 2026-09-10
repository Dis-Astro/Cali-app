import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_VERSION = "v2";
const QUEUE_KEY = `spg:offline:${STORAGE_VERSION}:queue`;
const META_KEY = `spg:offline:${STORAGE_VERSION}:meta`;
const CACHE_PREFIX = `spg:offline:${STORAGE_VERSION}:cache:`;
const FLUSH_LOCK_KEY = `${QUEUE_KEY}:flush`;

export interface OfflineSnapshot {
  accountId: string | null;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  storageError: boolean;
}

export interface WorkoutCompletionPayload {
  id?: string;
  clientId: string;
  workoutPlanExerciseId: string;
  weekNumber: number;
  clientNotes: string;
  difficultyRating: number;
}

export interface ErrorReportPayload {
  clientId: string;
  coachId: string;
  title: string;
  description: string;
  localId: string;
}

interface PendingBase {
  id: string;
  dedupeKey: string;
  createdAt: string;
  updatedAt: string;
  attempts: number;
}

export interface PendingWorkoutCompletion extends PendingBase {
  type: "workout_completion";
  payload: WorkoutCompletionPayload;
}

export interface PendingErrorReport extends PendingBase {
  type: "error_report";
  payload: ErrorReportPayload;
}

type PendingOperation = PendingWorkoutCompletion | PendingErrorReport;
type Listener = (snapshot: OfflineSnapshot) => void;

const listeners = new Set<Listener>();
let initialized = false;
let flushPromise: Promise<void> | null = null;
let retryTimer: number | null = null;
let queueMutation: Promise<unknown> = Promise.resolve();
let accountVersion = 0;
let queueVersion = 0;

// Separate locks let users keep editing while one tab sends the queue.
function mutateQueue(transform: (queue: PendingOperation[]) => PendingOperation[]) {
  const transaction = async () => {
    const queue = transform(await readQueue());
    await writeQueue(queue);
    return queue;
  };
  const next = queueMutation.then(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request(QUEUE_KEY, transaction);
    }
    return await transaction();
  });
  queueMutation = next.catch(() => undefined);
  return next;
}
const snapshot: OfflineSnapshot = {
  accountId: null,
  isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  storageError: false,
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
  if (value === null) {
    snapshot.storageError = false;
    return [];
  }
  try {
    const queue: unknown = JSON.parse(value);
    if (!Array.isArray(queue) || !queue.every(isPendingOperation)) throw new Error("Invalid queue");
    snapshot.storageError = false;
    return queue;
  } catch {
    // Never replace unreadable data with an empty queue: that would discard
    // notes at the next save. Leave the original bytes available for recovery.
    snapshot.storageError = true;
    snapshot.lastError = "Dati offline non leggibili: conservati sul dispositivo. Non disinstallare l'app; richiedi assistenza.";
    emit();
    throw new Error(snapshot.lastError);
  }
}

function isPendingOperation(value: unknown): value is PendingOperation {
  if (!value || typeof value !== "object") return false;
  const operation = value as Partial<PendingOperation>;
  if (typeof operation.id !== "string" || !operation.id || typeof operation.dedupeKey !== "string"
    || typeof operation.createdAt !== "string" || typeof operation.updatedAt !== "string"
    || !Number.isFinite(operation.attempts) || !operation.payload
    || typeof operation.payload.clientId !== "string" || !operation.payload.clientId) return false;
  if (operation.type === "workout_completion") {
    const payload = operation.payload;
    return typeof payload.workoutPlanExerciseId === "string" && Number.isFinite(payload.weekNumber)
      && typeof payload.clientNotes === "string" && Number.isFinite(payload.difficultyRating)
      && (payload.id === undefined || typeof payload.id === "string");
  }
  if (operation.type === "error_report") {
    const payload = operation.payload;
    return typeof payload.coachId === "string" && typeof payload.title === "string"
      && typeof payload.description === "string" && typeof payload.localId === "string";
  }
  return false;
}

function pendingFor(queue: PendingOperation[], accountId: string | null) {
  return accountId ? queue.filter((operation) => operation.payload.clientId === accountId).length : 0;
}

async function writeQueue(queue: PendingOperation[]) {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
  queueVersion++;
  snapshot.pendingCount = pendingFor(queue, snapshot.accountId);
  emit();
}

async function readMeta(accountId: string) {
  const { value } = await Preferences.get({ key: `${META_KEY}:${accountId}` });
  const meta = safeParse<{ lastSyncAt: string | null }>(value, { lastSyncAt: null });
  return typeof meta?.lastSyncAt === "string" ? meta.lastSyncAt : null;
}

async function writeMeta(accountId: string, lastSyncAt: string) {
  await Preferences.set({
    key: `${META_KEY}:${accountId}`,
    value: JSON.stringify({ lastSyncAt }),
  });
  if (snapshot.accountId === accountId) snapshot.lastSyncAt = lastSyncAt;
}

async function refreshAccountSnapshot() {
  const version = accountVersion;
  const accountId = snapshot.accountId;
  const lastSyncAt = accountId ? await readMeta(accountId) : null;
  await queueMutation;
  const currentQueueVersion = queueVersion;
  const queue = await readQueue();
  if (version !== accountVersion || currentQueueVersion !== queueVersion) return;
  snapshot.pendingCount = pendingFor(queue, accountId);
  snapshot.lastSyncAt = lastSyncAt;
  emit();
}

export async function setOfflineSyncAccount(accountId: string | null) {
  if (snapshot.accountId !== accountId) {
    accountVersion++;
    snapshot.accountId = accountId;
    snapshot.pendingCount = 0;
    snapshot.lastSyncAt = null;
    snapshot.lastError = null;
    snapshot.isSyncing = false;
    emit();
  }
  await refreshAccountSnapshot().catch(handleSyncError);
}

function workoutDedupeKey(payload: WorkoutCompletionPayload) {
  return `workout_completion:${payload.clientId}:${payload.workoutPlanExerciseId}:${payload.weekNumber}`;
}

function reportDedupeKey(payload: ErrorReportPayload) {
  return `error_report:${payload.clientId}:${payload.localId}`;
}

async function syncWorkoutCompletion(operation: PendingWorkoutCompletion) {
  const payload = operation.payload;
  // The tracked schema has unique_completion_per_set. A single atomic write
  // avoids the lookup/insert race, including a retry after a lost response.
  // Do not send id or coach fields: conflicts retain the existing row identity
  // and change only these client-owned values. If the live constraint is
  // missing, fail safely and retain the queue instead of inserting duplicates.
  const { data, error } = await supabase.from("workout_completions").upsert({
    workout_plan_exercise_id: payload.workoutPlanExerciseId,
    client_id: payload.clientId,
    set_number: payload.weekNumber,
    client_notes: payload.clientNotes,
    difficulty_rating: payload.difficultyRating,
  }, { onConflict: "workout_plan_exercise_id,client_id,set_number" }).select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("Salvataggio non confermato. La valutazione resta sul dispositivo.");
}

async function syncErrorReport(operation: PendingErrorReport) {
  const payload = operation.payload;
  const { error } = await supabase.from("error_reports").insert({
    id: payload.localId,
    client_id: payload.clientId,
    coach_id: payload.coachId,
    title: payload.title,
    description: payload.description,
    status: "aperta",
  });
  if (error && error.code !== "23505") throw error;
}

function updateOnlineState() {
  snapshot.isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  emit();
}

function scheduleRetry() {
  if (typeof window === "undefined" || retryTimer !== null || snapshot.storageError) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    if (navigator.onLine && snapshot.pendingCount > 0) void flushPendingOperations();
  }, 30000);
}

function handleSyncError(error: unknown) {
  snapshot.lastError = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "Sincronizzazione non riuscita";
  emit();
}

export async function initializeOfflineSync() {
  if (initialized) return;
  initialized = true;

  // Auth callbacks must not await another Supabase auth operation (lock cycle).
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") void setOfflineSyncAccount(null);
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      window.setTimeout(() => {
        // A sign-in can arrive during a failed replay. Retry after it settles.
        void (flushPromise ?? Promise.resolve()).then(() => flushPendingOperations());
      }, 0);
    }
  });
  await refreshAccountSnapshot().catch(handleSyncError);
  updateOnlineState();

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      snapshot.isOnline = true;
      if (!snapshot.storageError) snapshot.lastError = null;
      emit();
      void flushPendingOperations();
    });

    window.addEventListener("offline", () => {
      snapshot.isOnline = false;
      snapshot.isSyncing = false;
      emit();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void refreshAccountSnapshot().then(() => {
          if (navigator.onLine && snapshot.pendingCount > 0) void flushPendingOperations();
        }).catch(handleSyncError);
      }
    });
    window.addEventListener("storage", () => {
      void refreshAccountSnapshot().catch(handleSyncError);
    });
  }

  if (snapshot.isOnline && snapshot.pendingCount > 0) void flushPendingOperations();
}

export function subscribeOfflineSync(listener: Listener) {
  listeners.add(listener);
  listener({ ...snapshot });
  return () => {
    listeners.delete(listener);
  };
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

async function enqueue(operation: PendingOperation) {
  await mutateQueue((queue) => {
    const existingIndex = queue.findIndex((item) => item.dedupeKey === operation.dedupeKey);
    if (existingIndex >= 0) {
      operation.createdAt = queue[existingIndex].createdAt;
      queue[existingIndex] = operation;
    } else {
      queue.push(operation);
    }
    return queue;
  });

  if (typeof navigator === "undefined" || navigator.onLine) await flushPendingOperations();
  const remaining = await readQueue();
  return {
    synced: !remaining.some((item) => item.dedupeKey === operation.dedupeKey),
    pendingCount: pendingFor(remaining, operation.payload.clientId),
  };
}

export async function queueWorkoutCompletion(payload: WorkoutCompletionPayload) {
  const now = new Date().toISOString();
  const dedupeKey = workoutDedupeKey(payload);
  return enqueue({
    id: crypto.randomUUID(),
    type: "workout_completion",
    dedupeKey,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    payload,
  });
}

export async function queueErrorReport(payload: ErrorReportPayload) {
  const now = new Date().toISOString();
  const dedupeKey = reportDedupeKey(payload);
  return enqueue({
    id: crypto.randomUUID(),
    type: "error_report",
    dedupeKey,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    payload,
  });
}

export async function flushPendingOperations() {
  if (flushPromise) return flushPromise;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    snapshot.isOnline = false;
    emit();
    return;
  }

  const replay = async () => {
    snapshot.isOnline = true;
    snapshot.isSyncing = Boolean(snapshot.accountId);
    snapshot.lastError = null;
    emit();

    while (typeof navigator === "undefined" || navigator.onLine) {
      // Never replay a previous account's operations under another session.
      const version = accountVersion;
      const { data, error: authError } = await supabase.auth.getUser();
      if (version !== accountVersion) continue;
      if (authError || !data.user) {
        if (snapshot.pendingCount > 0) {
          snapshot.lastError = "Sessione non verificabile. I dati restano salvati; riproveremo dopo l'accesso o il ritorno della rete.";
          scheduleRetry();
        }
        break;
      }
      // A verified token must also belong to the account currently displayed.
      // In particular, stop immediately when the UI has signed out but the
      // underlying auth request is still settling.
      if (data.user.id !== snapshot.accountId) break;
      await queueMutation;
      const operation = (await readQueue()).find((item) => item.payload.clientId === data.user.id);
      if (version !== accountVersion) continue;
      if (!operation) break;
      try {
        if (operation.type === "workout_completion") await syncWorkoutCompletion(operation);
        if (operation.type === "error_report") await syncErrorReport(operation);

        // A newer edit has a different revision id and must survive this ack.
        await mutateQueue((queue) => queue.filter((item) => item.id !== operation.id));
        if (pendingFor(await readQueue(), data.user.id) === 0) {
          await writeMeta(data.user.id, new Date().toISOString());
        }
      } catch (error) {
        operation.attempts += 1;
        operation.updatedAt = new Date().toISOString();
        await mutateQueue((queue) => queue.map((item) => (item.id === operation.id ? operation : item)));
        if (snapshot.accountId === operation.payload.clientId) handleSyncError(error);
        scheduleRetry();
        break;
      }
    }

    const queue = await readQueue();
    if (pendingFor(queue, snapshot.accountId) === 0) {
      snapshot.lastError = null;
    }

    snapshot.isSyncing = false;
    snapshot.pendingCount = pendingFor(queue, snapshot.accountId);
    emit();
  };
  // Hold the replay lock across HTTP requests, separate from storage mutations:
  // two tabs must not both insert the same pending completion.
  flushPromise = (async () => {
    if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request(FLUSH_LOCK_KEY, replay);
    else await replay();
  })().catch((error) => {
    handleSyncError(error);
    scheduleRetry();
  }).finally(() => {
    snapshot.isSyncing = false;
    emit();
    flushPromise = null;
  });

  return flushPromise;
}
