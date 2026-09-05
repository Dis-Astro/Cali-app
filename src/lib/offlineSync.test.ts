import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
const insert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
const update = vi.fn(() => queryBuilder);
const getUser = vi.fn(async () => ({ data: { user: { id: "client-1" } }, error: null }));

const queryBuilder: any = {
  select: vi.fn(() => queryBuilder),
  eq: vi.fn(() => queryBuilder),
  update,
  insert,
  maybeSingle,
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
  supabase: { from: vi.fn(() => queryBuilder), auth: { getUser } },
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("offline synchronization queue", () => {
  beforeEach(() => {
    storage.clear();
    insert.mockClear();
    maybeSingle.mockClear();
    update.mockClear();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "client-1" } }, error: null });
    setOnline(false);
    vi.resetModules();
  });

  it("keeps a workout note locally while offline and flushes it after reconnect", async () => {
    const sync = await import("./offlineSync");

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

    expect(insert).toHaveBeenCalledTimes(1);
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
    expect(sync.getOfflineSnapshot().lastSyncAt).not.toBeNull();
  });

  it("deduplicates repeated changes to the same exercise and week", async () => {
    const sync = await import("./offlineSync");
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
    const sync = await import("./offlineSync");

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
    const sync = await import("./offlineSync");
    await Promise.all(Array.from({ length: 12 }, (_, i) => sync.queueWorkoutCompletion(note(`exercise-${i}`))));
    vi.resetModules();
    const restarted = await import("./offlineSync");
    expect(await restarted.getPendingWorkoutCompletions("client-1")).toHaveLength(12);
  });

  it("retains a newer edit and a new operation arriving during an upload", async () => {
    const sync = await import("./offlineSync");
    await sync.queueWorkoutCompletion(note("exercise-1", "Prima"));
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let started!: () => void;
    const uploading = new Promise<void>((resolve) => { started = resolve; });
    insert.mockImplementationOnce(async () => {
      started();
      await blocked;
      return { error: null };
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
    const sync = await import("./offlineSync");
    await sync.queueWorkoutCompletion(note("exercise-1"));
    await sync.queueWorkoutCompletion({ ...note("exercise-2"), clientId: "client-2" });
    getUser.mockResolvedValue({ data: { user: { id: "client-2" } }, error: null });
    setOnline(true);
    await sync.flushPendingOperations();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: "client-2" }));
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
  });

  it("stops replaying the old account after an account change during upload", async () => {
    const sync = await import("./offlineSync");
    await sync.queueWorkoutCompletion(note("exercise-1"));
    await sync.queueWorkoutCompletion(note("exercise-2"));
    insert.mockImplementationOnce(async () => {
      getUser.mockResolvedValue({ data: { user: { id: "client-2" } }, error: null });
      return { error: null };
    });
    setOnline(true);
    await sync.flushPendingOperations();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(await sync.getPendingWorkoutCompletions("client-1")).toHaveLength(1);
  });
});
