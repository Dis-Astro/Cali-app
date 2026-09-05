import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(async () => ({ display: "granted" })),
  pending: vi.fn(async () => ({ notifications: [{ id: 1, extra: { kind: "course-confirmation" } }, { id: 2, extra: { kind: "other" } }] })),
  cancel: vi.fn(async () => undefined), schedule: vi.fn(async () => undefined),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: {
  checkPermissions: mocks.permission, requestPermissions: mocks.permission,
  getPending: mocks.pending, cancel: mocks.cancel, schedule: mocks.schedule,
} }));

describe("account-scoped course reminders", () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.resetModules(); });
  it("does not inherit another user's opt-in or the old global preference", async () => {
    const reminders = await import("./courseReminders");
    localStorage.setItem("course-confirmation-reminders", "enabled");
    expect(reminders.courseRemindersEnabled("b")).toBe(false);
    await reminders.enableCourseReminders("a");
    expect(reminders.courseRemindersEnabled("a")).toBe(true);
    expect(reminders.courseRemindersEnabled("b")).toBe(false);
  });
  it("clears course reminders on logout without cancelling unrelated notifications", async () => {
    const reminders = await import("./courseReminders");
    await reminders.clearCourseReminders();
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
  });
  it("clears obsolete reminders even when there are no remaining sessions", async () => {
    const reminders = await import("./courseReminders");
    await reminders.syncCourseReminders([], [], [], "a");
    expect(mocks.cancel).toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
