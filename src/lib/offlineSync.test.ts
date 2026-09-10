import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const storage = new Map<string, string>();
const insert = vi.fn(async () => ({ error: null }));
const writeCompletion = vi.fn<() => Promise<{ data: { id: string } | null; error: { message: string; code?: string } | null }>>();
const upsert = vi.fn(() => queryBuilder);
const getUser = vi.fn<() => Promise<{ data: { user: { id: string } | null }; error: Error | null }>>();
const authCallbacks: Array<(event: AuthChangeEvent, session: Session | null) => void> = [];
const onAuthStateChange = vi.fn((callback: (event: AuthChangeEvent, session: Session | null) => void) => {
  authCallbacks.push(callback);
  return { data: { subscription: { unsubscribe: vi.fn() } } };
});

const queryBuilder: any = {
  select: vi.fn(() => queryBuilder),
  eq: vi.fn(() => queryBuilder),
  upsert,
  insert,
  single: writeCompletion,
};

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      storage.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => queryBuilder), auth: { getUser, onAuthStateChange } },
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

const queueKey = "spg:offline:v2:queue";
const metaKey = "spg:offline:v2:meta";

async function loadSync(accountId = "client-1") {
  const sync = await import("./offlineSync");
  await sync.setOfflineSyncAccount(accountId);
  return sync;
}

describe("offline synchronization queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "addEventListener");
    vi.spyOn(document, "addEventListener");
    storage.clear();
    authCallbacks.length = 0;
    insert.mockClear();
    upsert.mockClear();
    writeCompletion.mockReset();
    writeCompletion.mockResolvedValue({ data: { id: "completion-1" }, error: null });
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
    setOnline(false);
    vi.resetModules();
  });

  afterEach(() => {
    for (const [type, listener] of vi.mocked(window.addEventListener).mock.calls) window.removeEventListener(type, listener);
    for (const [type, listener] of vi.mocked(document.addEventListener).mock.calls) document.removeEventListener(type, listener);
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  });

  it("keeps a workout note locally while offline and flushes it after reconnect", async () => {
    const sync = await loadSync();

    const queued = await sync.queueWorkoutCompletion({
      clientId: "client-1",
      workoutPlanExerciseId: "exercise-1",
      weekNumber: 2,
      clientNotes: "Nota offline",
      difficultyRating: 7,
    });

    expect(queued.synced).toBe(false);
    expect(queued.pendingCount).toBe(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(1);

    setOnline(true);
    await sync.flushPendingOperations();

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
    expect(sync.getOfflineSnapshot().lastSyncAt).not.toBeNull();
  });

  it("deduplicates repeated changes to the same exercise and week", async () => {
    const sync = await loadSync();
    const base = {
      clientId: "client-1",
      workoutPlanExerciseId: "exercise-1",
      weekNumber: 1,
      difficultyRating: 5,
    };

    await sync.queueWorkoutCompletion({ ...base, clientNotes: "Prima nota" });
    const second = await sync.queueWorkoutCompletion({ ...base, clientNotes: "Nota aggiornata" });

    expect(second.pendingCount).toBe(1);
    const pending = await sync.getPendingWorkoutCompletions("client-1");
    expect(pending).toHaveLength(1);
    expect(pending[0].payload.clientNotes).toBe("Nota aggiornata");
  });

  it("uses a stable database id for offline reports and sends them once", async () => {
    const sync = await loadSync();

    const queued = await sync.queueErrorReport({
      clientId: "client-1",
      coachId: "coach-1",
      title: "Problema esercizio",
      description: "Descrizione salvata offline",
      localId: "report-local-1",
    });

    expect(queued.pendingCount).toBe(1);
    setOnline(true);
    await sync.flushPendingOperations();

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: "report-local-1" }));
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
  });

  const note = (exercise: string, clientNotes = "Nota") => ({
    clientId: "client-1", workoutPlanExerciseId: exercise, weekNumber: 1,
    difficultyRating: 5, clientNotes,
  });

  it("preserves concurrent offline writes and restores them after module restart", async () => {
    const sync = await loadSync();
    await Promise.all(Array.from({ length: 12 }, (_, i) => sync.queueWorkoutCompletion(note(`exercise-${i}`))));
    vi.resetModules();
    const restarted = await import("./offlineSync");
    expect(await restarted.getPendingWorkoutCompletions("client-1")).toHaveLength(12);
  });

  it("retains a newer edit and a new operation arriving during an upload", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1", "Prima"));
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const uploading = new Promise<void>((resolve) => { started = resolve; });
    writeCompletion.mockImplementationOnce(async () => {
      started();
      await blocked;
      return { data: { id: "completion-1" }, error: null };
    });
    setOnline(true);
    const flushing = sync.flushPendingOperations();
    await uploading;
    setOnline(false);
    await sync.queueWorkoutCompletion(note("exercise-1", "Aggiornata"));
    await sync.queueWorkoutCompletion(note("exercise-2"));
    release();
    await flushing;
    const pending = await sync.getPendingWorkoutCompletions("client-1");
    expect(pending).toHaveLength(2);
    expect(pending[0].payload.clientNotes).toBe("Aggiornata");
    setOnline(true);
    await sync.flushPendingOperations();
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(0);
  });

  it("does not upload another account's saved notes", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    await sync.queueWorkoutCompletion({ ...note("exercise-2"), clientId: "client-2" });
    getUser.mockResolvedValue({ data: { user: { id: "client-2" } }, error: null });
    await sync.setOfflineSyncAccount("client-2");
    setOnline(true);
    await sync.flushPendingOperations();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ client_id: "client-2" }), expect.any(Object));
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
  });

  it("stops replaying the old account after an account change during upload", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    await sync.queueWorkoutCompletion(note("exercise-2"));
    writeCompletion.mockImplementationOnce(async () => {
      getUser.mockResolvedValue({ data: { user: { id: "client-2" } }, error: null });
      return { data: { id: "completion-1" }, error: null };
    });
    setOnline(true);
    await sync.flushPendingOperations();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
  });

  it("does not replay after local sign-out even while the old auth token is still present", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    const signingOut = sync.setOfflineSyncAccount(null);
    expect(sync.getOfflineSnapshot()).toMatchObject({ accountId: null, pendingCount: 0, lastSyncAt: null });
    await signingOut;
    setOnline(true);
    await sync.flushPendingOperations();
    expect(upsert).not.toHaveBeenCalled();
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
  });

  it("isolates counts and sync history on account switch, sign-out and restart", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    const other = await sync.queueWorkoutCompletion({ ...note("exercise-2"), clientId: "client-2" });
    expect(other.pendingCount).toBe(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(1);
    setOnline(true);
    await sync.flushPendingOperations();
    const firstSyncAt = sync.getOfflineSnapshot().lastSyncAt;
    expect(firstSyncAt).not.toBeNull();
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
    expect(storage.has(`${metaKey}:client-1`)).toBe(true);
    expect(storage.has(`${metaKey}:client-2`)).toBe(false);

    await sync.setOfflineSyncAccount("client-2");
    expect(sync.getOfflineSnapshot()).toMatchObject({ pendingCount: 1, lastSyncAt: null });
    await sync.setOfflineSyncAccount(null);
    expect(sync.getOfflineSnapshot()).toMatchObject({ pendingCount: 0, lastSyncAt: null, accountId: null });
    vi.resetModules();
    const restarted = await loadSync();
    expect(restarted.getOfflineSnapshot().lastSyncAt).toBe(firstSyncAt);
    expect(await restarted.getPendingWorkoutCompletions("client-2")).toHaveLength(1);
  });

  it.each(["{broken-json", "null", "{}", '[{"type":"unknown"}]'])("preserves unreadable queue bytes and refuses destructive saves: %s", async (raw) => {
    storage.set(queueKey, raw);
    const sync = await loadSync();
    await expect(sync.queueWorkoutCompletion(note("exercise-1"))).rejects.toThrow("Dati offline non leggibili");
    expect(storage.get(queueKey)).toBe(raw);
    setOnline(true);
    await sync.flushPendingOperations();
    expect(storage.get(queueKey)).toBe(raw);
    expect(upsert).not.toHaveBeenCalled();
    expect(sync.getOfflineSnapshot()).toMatchObject({ storageError: true, isSyncing: false });
  });

  it("retries saved notes when sign-in becomes available after failed initialization", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    setOnline(true);
    await sync.initializeOfflineSync();
    await sync.flushPendingOperations();
    expect(upsert).not.toHaveBeenCalled();
    expect(sync.getOfflineSnapshot().lastError).toContain("Sessione non verificabile");
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
    authCallbacks.forEach((callback) => callback("SIGNED_IN", null));
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
  });

  it("retries a transient auth outage without losing or falsely acknowledging notes", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("Network unavailable") });
    setOnline(true);
    await sync.flushPendingOperations();
    expect(sync.getOfflineSnapshot()).toMatchObject({ pendingCount: 1, lastSyncAt: null });
    await vi.advanceTimersByTimeAsync(30000);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
  });

  it("serializes replay across browser tabs while allowing storage edits", async () => {
    const locks = new Map<string, Promise<unknown>>();
    const request = vi.fn((key: string, callback: () => Promise<unknown>) => {
      const next = (locks.get(key) ?? Promise.resolve()).then(callback);
      locks.set(key, next.catch(() => undefined));
      return next;
    });
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
    const firstTab = await loadSync();
    await firstTab.queueWorkoutCompletion(note("exercise-1"));
    vi.resetModules();
    const secondTab = await loadSync();
    setOnline(true);
    await Promise.all([firstTab.flushPendingOperations(), secondTab.flushPendingOperations()]);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(request.mock.calls.filter(([key]) => key === `${queueKey}:flush`)).toHaveLength(2);
    expect(await secondTab.getPendingWorkoutCompletions("client-1")).toHaveLength(0);
  });

  it("atomically targets the natural key without overwriting an existing id or coach feedback", async () => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion({ ...note("exercise-1", "Aggiornata"), id: "existing-server-id" });
    setOnline(true);
    await sync.flushPendingOperations();
    expect(upsert).toHaveBeenCalledWith({
      workout_plan_exercise_id: "exercise-1", client_id: "client-1", set_number: 1,
      client_notes: "Aggiornata", difficulty_rating: 5,
    }, { onConflict: "workout_plan_exercise_id,client_id,set_number" });
    expect(insert).not.toHaveBeenCalled();
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(0);
  });

  it.each([
    { data: null, error: { message: "no unique constraint matching ON CONFLICT", code: "42P10" } },
    { data: null, error: null },
  ])("retains the note when the server cannot confirm the atomic write: %j", async (response) => {
    const sync = await loadSync();
    await sync.queueWorkoutCompletion(note("exercise-1"));
    writeCompletion.mockResolvedValue(response);
    setOnline(true);
    await sync.flushPendingOperations();
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
    expect(sync.getOfflineSnapshot()).toMatchObject({ pendingCount: 1, lastSyncAt: null });
    expect(sync.getOfflineSnapshot().lastError).not.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });
});
