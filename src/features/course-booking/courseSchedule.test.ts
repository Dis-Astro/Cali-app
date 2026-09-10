import { describe, expect, it } from "vitest";
import { confirmationDeadline, formatGymDate, gymDateKey, gymDayStart, gymSlot, gymWeekRange, matchesFixedSlot, reminderTimes } from "./courseSchedule";

describe("course schedule (Europe/Rome)", () => {
  it("rolls into Monday in gym time before UTC midnight", () => {
    const now = new Date("2026-09-06T22:30:00Z");
    expect(gymDateKey(now)).toBe("2026-09-07");
    expect(gymDayStart("2026-09-07").toISOString()).toBe("2026-09-06T22:00:00.000Z");
    const week = gymWeekRange(now);
    expect(week.start.toISOString()).toBe("2026-09-06T22:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-09-13T21:59:59.999Z");
    expect(formatGymDate(now)).toMatch(/lunedì.*00:30/);
  });
  it.each([
    ["2026-03-25T12:00:00Z", "2026-03-22T23:00:00.000Z", "2026-03-29T21:59:59.999Z", 167],
    ["2026-10-21T12:00:00Z", "2026-10-18T22:00:00.000Z", "2026-10-25T22:59:59.999Z", 169],
  ])("uses calendar weeks across daylight saving changes (%s)", (date, start, end, hours) => {
    const week = gymWeekRange(new Date(date));
    expect(week.start.toISOString()).toBe(start);
    expect(week.end.toISOString()).toBe(end);
    expect((week.end.getTime() + 1 - week.start.getTime()) / 3_600_000).toBe(hours);
  });
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
