export const GYM_TIME_ZONE = "Europe/Rome";

export function formatGymDate(value: string | Date, options: Intl.DateTimeFormatOptions = { weekday: "long", hour: "2-digit", minute: "2-digit" }) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone: GYM_TIME_ZONE, hourCycle: "h23" }).format(new Date(value));
}

export function gymDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Convert gym-local midnight without depending on the phone timezone, including DST.
function gymMidnight(calendarDate: Date) {
  const wallTime = calendarDate.getTime();
  let candidate = wallTime;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const instant = new Date(candidate);
    const slot = gymSlot(instant.toISOString());
    const shownWallTime = Date.parse(`${gymDateKey(instant)}T${slot.time}Z`);
    candidate += wallTime - shownWallTime;
  }
  return new Date(candidate);
}

export function gymDayStart(dateKey: string) {
  return gymMidnight(new Date(`${dateKey}T00:00:00Z`));
}

export function gymWeekRange(now: Date) {
  const monday = new Date(`${gymDateKey(now)}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - gymSlot(now.toISOString()).day + 1);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return { start: gymMidnight(monday), end: new Date(gymMidnight(nextMonday).getTime() - 1) };
}

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
