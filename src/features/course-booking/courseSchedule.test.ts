import { describe, expect, it } from "vitest";
import { confirmationDeadline, gymSlot, matchesFixedSlot, reminderTimes } from "./courseSchedule";

describe("course schedule (Europe/Rome)", () => {
  it("uses gym time in winter and summer, including a UTC day boundary", () => {
    expect(gymSlot("2026-01-04T23:30:00Z")).toEqual({ day: 1, time: "00:30:00" });
    expect(gymSlot("2026-07-06T16:00:00Z")).toEqual({ day: 1, time: "18:00:00" });
  });
  it("matches fixed assignments using the gym timezone", () => {
    expect(matchesFixedSlot({ course_id: "a", day_of_week: 1, start_time: "18:00:00" },
      { course_id: "a", start_time: "2026-07-06T16:00:00Z" })).toBe(true);
    expect(matchesFixedSlot({ course_id: "b", day_of_week: 1, start_time: "18:00:00" },
      { course_id: "a", start_time: "2026-07-06T16:00:00Z" })).toBe(false);
  });
  it.each([1, 6, 24, 72])("schedules reminders before the configured %s-hour deadline", (hours) => {
    const session = { start_time: "2026-09-14T16:00:00Z", confirmation_deadline_hours: hours };
    const now = Date.parse("2026-09-01T00:00:00Z");
    const deadline = confirmationDeadline(session).getTime();
    const times = reminderTimes(session, now);
    expect(times).toHaveLength(2);
    expect(times.every((at) => at.getTime() > now && at.getTime() < deadline)).toBe(true);
    expect(times[1].getTime()).toBe(deadline - 2 * 3_600_000);
    expect(reminderTimes(session, deadline)).toEqual([]);
  });
});
