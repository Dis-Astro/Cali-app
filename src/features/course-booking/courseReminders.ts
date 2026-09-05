import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { confirmationDeadline, GYM_TIME_ZONE, matchesFixedSlot, reminderTimes } from "./courseSchedule";

type Session = { id: string; course_id: string; start_time: string; confirmation_deadline_hours?: number; course: { name: string } | null };
type Assignment = { course_id: string; day_of_week: number; start_time: string };
type Booking = { course_session_id: string; status: string };

const REMINDER_KEY = "course-confirmation-reminders";
let reminderVersion = 0;
let reminderWork: Promise<unknown> = Promise.resolve();

function serializeReminders(work: (version: number) => Promise<void>) {
  const version = ++reminderVersion;
  const next = reminderWork.then(() => work(version));
  reminderWork = next.catch(() => undefined);
  return next;
}

async function cancelPendingCourseReminders() {
  if (!courseRemindersAvailable()) return;
  const pending = await LocalNotifications.getPending();
  const courseNotifications = pending.notifications.filter((item) => item.extra?.kind === "course-confirmation");
  if (courseNotifications.length) {
    await LocalNotifications.cancel({ notifications: courseNotifications.map(({ id }) => ({ id })) });
  }
}

export function clearCourseReminders() {
  return serializeReminders(async () => { await cancelPendingCourseReminders(); });
}

const idFor = (sessionId: string, suffix: number) => {
  let hash = 0;
  for (const char of sessionId) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash % 1_000_000_000) * 2 + suffix;
};

export const courseRemindersAvailable = () => Capacitor.isNativePlatform();

export async function enableCourseReminders(userId: string) {
  if (!courseRemindersAvailable()) return false;
  const current = await LocalNotifications.checkPermissions();
  const permission = current.display === "granted" ? current : await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;
  localStorage.setItem(`${REMINDER_KEY}:${userId}`, "enabled");
  return true;
}

export const courseRemindersEnabled = (userId: string) => localStorage.getItem(`${REMINDER_KEY}:${userId}`) === "enabled";

export function syncCourseReminders(sessions: Session[], assignments: Assignment[], bookings: Booking[], userId: string) {
  return serializeReminders(async (version) => {
  if (!courseRemindersAvailable()) return;
  await cancelPendingCourseReminders();
  if (!courseRemindersEnabled(userId)) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;

  const now = Date.now();
  const notifications = sessions.flatMap((session) => {
    const fixed = assignments.some((assignment) => matchesFixedSlot(assignment, session));
    const answered = bookings.some((booking) => booking.course_session_id === session.id && ["confirmed", "cancelled", "present", "absent"].includes(booking.status));
    if (!fixed || answered) return [];

    const deadline = confirmationDeadline(session);
    const reminders = reminderTimes(session, now);
    return reminders.map((at, index) => ({
      id: idFor(session.id, index),
      title: "Conferma il corso",
      body: `${session.course?.name ?? "Corso"}: conferma o rinuncia entro ${deadline.toLocaleString("it-IT", { timeZone: GYM_TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} (ora italiana).`,
      schedule: { at },
      extra: { kind: "course-confirmation", sessionId: session.id, userId },
    }));
  });

  if (notifications.length && version === reminderVersion) await LocalNotifications.schedule({ notifications });
  });
}
