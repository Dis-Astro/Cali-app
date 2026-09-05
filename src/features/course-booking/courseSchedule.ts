export const GYM_TIME_ZONE = "Europe/Rome";

export function gymSlot(startTime: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(startTime));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return {
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(part("weekday")) + 1,
    time: `${part("hour")}:${part("minute")}:${part("second")}`,
  };
}

export function matchesFixedSlot(
  assignment: { course_id: string; day_of_week: number; start_time: string },
  session: { course_id: string; start_time: string },
) {
  const slot = gymSlot(session.start_time);
  return assignment.course_id === session.course_id && assignment.day_of_week === slot.day
    && assignment.start_time.slice(0, 5) === slot.time.slice(0, 5);
}

export function confirmationDeadline(session: { start_time: string; confirmation_deadline_hours?: number | null }) {
  return new Date(new Date(session.start_time).getTime() - (session.confirmation_deadline_hours ?? 6) * 3_600_000);
}

export function reminderTimes(session: { start_time: string; confirmation_deadline_hours?: number | null }, now: number) {
  const deadline = confirmationDeadline(session).getTime();
  // The last reminder remains two hours before the configured deadline.
  const offsets = [Math.max(24, (session.confirmation_deadline_hours ?? 6) + 4), (session.confirmation_deadline_hours ?? 6) + 2];
  return offsets.map((hours) => new Date(new Date(session.start_time).getTime() - hours * 3_600_000))
    .filter((at) => at.getTime() > now && at.getTime() < deadline);
}
