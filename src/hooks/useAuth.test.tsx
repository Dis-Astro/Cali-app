import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./useAuth";

const mocks = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  getSession: vi.fn(),
  profile: vi.fn(),
  listener: null as null | ((event: string, session: unknown) => void),
}));
vi.mock("@capacitor/preferences", () => ({ Preferences: {
  get: async ({ key }: { key: string }) => ({ value: mocks.storage.get(key) ?? null }),
  set: async ({ key, value }: { key: string; value: string }) => { mocks.storage.set(key, value); },
  remove: async ({ key }: { key: string }) => { mocks.storage.delete(key); },
} }));
vi.mock("@/lib/offlineWorkout", () => ({ downloadWorkoutPlanForOffline: vi.fn(async () => null) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    signOut: vi.fn(async () => ({ error: null })),
    onAuthStateChange: (callback: typeof mocks.listener) => {
      mocks.listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
} }));

let current: ReturnType<typeof useAuth>;
function Consumer() { current = useAuth(); return <span>{current.profile?.first_name ?? "No profile"}</span>; }
function mount() { render(<AuthProvider><Consumer /></AuthProvider>); }
const session = (id: string) => ({ user: { id } });
const profile = (id: string) => ({ user_id: id, first_name: id, role: "cliente_palestra" });

describe("authentication identity races", () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getSession.mockReset();
    mocks.profile.mockReset();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.getSession.mockResolvedValue({ data: { session: session("a") } });
    mocks.profile.mockResolvedValue({ data: profile("a"), error: null });
  });
  afterEach(cleanup);

  it("does not restore a profile response that arrives after logout", async () => {
    let release!: (value: unknown) => void;
    mocks.profile.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    mount();
    await waitFor(() => expect(mocks.profile).toHaveBeenCalled());
    await act(async () => { await current.signOut(); });
    await act(async () => { release({ data: profile("a"), error: null }); });
    expect(current.profile).toBeNull();
    expect(current.isAuthenticated).toBe(false);
    expect(mocks.storage.has("spg:auth:last-user")).toBe(false);
  });

  it("does not restore a delayed startup session after logout", async () => {
    let release!: (value: unknown) => void;
    mocks.getSession.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    mount();
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    await act(async () => { await current.signOut(); });
    await act(async () => { release({ data: { session: session("a") } }); });
    expect(current.isAuthenticated).toBe(false);
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("keeps the new account when the previous account's profile arrives late", async () => {
    let release!: (value: unknown) => void;
    mocks.profile.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    mocks.profile.mockResolvedValue({ data: profile("b"), error: null });
    mount();
    await waitFor(() => expect(mocks.profile).toHaveBeenCalledTimes(1));
    act(() => { mocks.listener?.("SIGNED_IN", session("b")); });
    await waitFor(() => expect(current.profile?.user_id).toBe("b"));
    await act(async () => { release({ data: profile("a"), error: null }); });
    expect(current.user?.id).toBe("b");
    expect(current.profile?.user_id).toBe("b");
  });

  it("restores the cached owner while offline without requesting their profile", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    mocks.storage.set("spg:auth:last-user", "a");
    mocks.storage.set("spg:auth:profile:a", JSON.stringify(profile("a")));
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mount();
    await waitFor(() => expect(current.loading).toBe(false));
    expect(current.profile?.user_id).toBe("a");
    expect(current.offlineMode).toBe(true);
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
