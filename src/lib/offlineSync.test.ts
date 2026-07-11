import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
const insert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
const update = vi.fn(() => queryBuilder);

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
  supabase: { from: vi.fn(() => queryBuilder) },
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

  it("queues a report offline and sends it once after reconnect", async () => {
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
    expect(sync.getOfflineSnapshot().pendingCount).toBe(0);
  });
});
