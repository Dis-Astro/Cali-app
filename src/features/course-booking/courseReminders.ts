import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

type Session = { id: string; course_id: string; start_time: string; course: { name: string } | null };
type Assignment = { course_id: string; day_of_week: number; start_time: string };
type Booking = { course_session_id: string; status: string };

const REMINDER_KEY = "course-confirmation-reminders";

const idFor = (sessionId: string, suffix: number) => {
  let hash = 0;
  for (const char of sessionId) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash % 1_000_000_000) * 2 + suffix;
};

const isAssignmentForSession = (assignment: Assignment, session: Session) => {
  const start = new Date(session.start_time);
  const isoDay = start.getDay() === 0 ? 7 : start.getDay();
  const localTime = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  return assignment.course_id === session.course_id
    && assignment.day_of_week === isoDay
    && assignment.start_time.slice(0, 5) === localTime;
};

export const courseRemindersAvailable = () => Capacitor.isNativePlatform();

export async function enableCourseReminders() {
  if (!courseRemindersAvailable()) return false;
  const current = await LocalNotifications.checkPermissions();
  const permission = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;
  localStorage.setItem(REMINDER_KEY, "enabled");
  return true;
}

export const courseRemindersEnabled = () => localStorage.getItem(REMINDER_KEY) === "enabled";

export async function syncCourseReminders(sessions: Session[], assignments: Assignment[], bookings: Booking[]) {
  if (!courseRemindersAvailable() || !courseRemindersEnabled()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const pending = await LocalNotifications.getPending();
  const courseNotifications = pending.notifications.filter((item) => item.extra?.kind === "course-confirmation");
  if (courseNotifications.length) {
    await LocalNotifications.cancel({ notifications: courseNotifications.map(({ id }) => ({ id })) });
  }

  const now = Date.now();
  const notifications = sessions.flatMap((session) => {
    const fixed = assignments.some((assignment) => isAssignmentForSession(assignment, session));
    const answered = bookings.some((booking) => booking.course_session_id === session.id && ["confirmed", "cancelled", "present", "absent"].includes(booking.status));
    if (!fixed || answered) return [];

    const start = new Date(session.start_time);
    const deadline = new Date(start.getTime() - 6 * 60 * 60 * 1000);
    const reminders = [24, 8]
      .map((hours) => new Date(start.getTime() - hours * 60 * 60 * 1000))
      .filter((at) => at.getTime() > now && at.getTime() < deadline.getTime());
    return reminders.map((at, index) => ({
      id: idFor(session.id, index),
      title: "Conferma il corso",
      body: `${session.course?.name ?? "Corso"}: conferma o rinuncia entro le ${deadline.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`,
      schedule: { at },
      extra: { kind: "course-confirmation", sessionId: session.id },
    }));
  });

  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
