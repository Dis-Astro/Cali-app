import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarCheck2, CheckCircle2, Loader2, RefreshCw, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { courseRemindersAvailable, courseRemindersEnabled, enableCourseReminders, syncCourseReminders } from "@/features/course-booking/courseReminders";
import { confirmationDeadline, formatGymDate, gymDateKey, gymSlot, gymWeekRange, matchesFixedSlot } from "@/features/course-booking/courseSchedule";
import { activeBookingStatuses, bookingStatusLabels, placesForClient } from "@/features/course-booking/courseAvailability";
import { useCourseClock } from "@/features/course-booking/useCourseClock";

interface CourseSession {
  id: string;
  course_id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  fixed_places: number;
  floating_places: number | null;
  confirmation_deadline_hours?: number;
  course: { name: string; color: string | null; max_participants: number | null } | null;
}

interface Booking {
  id: string;
  course_session_id: string;
  booking_type: string;
  status: string;
}

interface FixedAssignment {
  course_id: string;
  day_of_week: number;
  start_time: string;
}

interface Availability {
  session_id: string;
  booked: number;
  fixed_booked: number;
  floating_booked: number;
}

const groupForDay = (day: number) => day <= 2 ? 1 : day <= 4 ? 2 : day + 10;

export default function ClientCourseBooking({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fixedAssignments, setFixedAssignments] = useState<FixedAssignment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [enrolled, setEnrolled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState(courseRemindersEnabled(userId));
  const loadVersion = useRef(0);
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const actionInFlight = useRef(false);
  const now = useCourseClock();
  const dayKey = gymDateKey(new Date(now));

  const load = useCallback(async () => {
    if (currentUser.current !== userId) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current && currentUser.current === userId;
    const week = gymWeekRange(new Date(`${dayKey}T12:00:00Z`));
    setLoading(true);
    setLoadError(false);
    try {
    const { data: memberships, error: membershipError } = await supabase
      .from("course_participants")
      .select("course_id")
      .eq("user_id", userId);

    if (!current()) return;
    if (membershipError) throw membershipError;
    if (!memberships?.length) {
      setEnrolled(false);
      setSessions([]);
      setBookings([]);
      setFixedAssignments([]);
      setAvailability([]);
      setLoadedFor(userId);
      return;
    }

    const courseIds = memberships.map((membership) => membership.course_id);
    setEnrolled(true);
    const [sessionsResult, bookingsResult, assignmentsResult, availabilityResult] = await Promise.all([
      supabase
        .from("course_sessions")
        .select("id, course_id, start_time, end_time, max_participants, fixed_places, floating_places, confirmation_deadline_hours, course:courses(name, color, max_participants)")
        .in("course_id", courseIds)
        .eq("is_cancelled", false)
        .gte("start_time", week.start.toISOString())
        .lte("start_time", week.end.toISOString())
        .order("start_time"),
      supabase.from("course_bookings").select("id, course_session_id, booking_type, status").eq("user_id", userId),
      supabase.from("course_fixed_assignments").select("course_id, day_of_week, start_time").eq("user_id", userId).eq("is_active", true),
      supabase.rpc("get_course_session_availability", { p_from: week.start.toISOString(), p_to: week.end.toISOString() }),
    ]);

    if (!current()) return;
    const failed = [sessionsResult, bookingsResult, assignmentsResult, availabilityResult].find((result) => result.error);
    if (failed) throw failed.error;
    setSessions((sessionsResult.data ?? []) as CourseSession[]);
    setBookings((bookingsResult.data ?? []) as Booking[]);
    setFixedAssignments((assignmentsResult.data ?? []) as FixedAssignment[]);
    setAvailability((availabilityResult.data ?? []) as Availability[]);
    setLoadedFor(userId);
    } catch {
      if (current()) {
        setLoadError(true);
        setLoadedFor(userId);
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [userId, dayKey]);

  useEffect(() => {
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    setRemindersOn(courseRemindersEnabled(userId));
    if (loadedFor !== userId || loadError || loading) return;
    void syncCourseReminders(sessions, fixedAssignments, bookings, userId).catch(() => {
      toast.error("Impossibile aggiornare i promemoria sul dispositivo");
    });
  }, [bookings, fixedAssignments, sessions, userId, loadedFor, loadError, loading]);

  useEffect(() => {
    const channel = supabase
      .channel(`course-bookings-client-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_bookings" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_sessions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_fixed_assignments", filter: `user_id=eq.${userId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_participants", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const bookingFor = (sessionId: string) => bookings.find((booking) => booking.course_session_id === sessionId);
  const isFixed = (session: CourseSession) => {
    return fixedAssignments.some((assignment) => matchesFixedSlot(assignment, session));
  };

  const action = async (session: CourseSession, nextAction: "confirm" | "cancel") => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setSavingId(session.id);
    try {
      const { error } = await supabase.rpc("manage_course_booking", { p_session_id: session.id, p_action: nextAction });
      if (error) toast.error(error.message.replace(/^.*?: /, ""));
      else toast.success(nextAction === "confirm" ? "Presenza confermata" : "Presenza annullata");
    } catch {
      toast.error("Risposta non verificata: aggiorna le presenze prima di riprovare.");
    } finally {
      await load();
      actionInFlight.current = false;
      setSavingId(null);
    }
  };

  const activateReminders = async () => {
    try {
    const enabled = await enableCourseReminders(userId);
    setRemindersOn(enabled);
    if (!enabled) {
      toast.error("Notifiche non abilitate", { description: "Puoi abilitarle dalle impostazioni dell’iPhone." });
      return;
    }
    await syncCourseReminders(sessions, fixedAssignments, bookings, userId);
    toast.success("Promemoria attivati");
    } catch {
      toast.error("Impossibile attivare i promemoria. Riprova dalle impostazioni del dispositivo.");
    }
  };

  if (loading || loadedFor !== userId) return <Card className="mb-6"><CardContent className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>;
  if (loadError) return <Card className="mb-6"><CardContent className="space-y-3 pt-6"><p role="alert" className="text-sm text-destructive">Turni e disponibilità non verificati. Controlla la connessione e aggiorna: nessuna presenza è stata modificata da questo caricamento.</p><Button variant="outline" onClick={() => void load()}>Riprova</Button></CardContent></Card>;
  if (!enrolled) return null;
  if (!sessions.length) return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarCheck2 className="h-5 w-5 text-primary" />I TUOI CORSI</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Non ci sono turni disponibili questa settimana.</CardContent>
    </Card>
  );

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarCheck2 className="h-5 w-5 text-primary" />QUESTA SETTIMANA</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Scegli un turno per gruppo e rispondi entro la scadenza indicata sulla lezione. Orari della palestra (Italia).</p>
          </div>
          <div className="flex gap-1">
            {courseRemindersAvailable() && <Button variant={remindersOn ? "secondary" : "outline"} size="sm" className="gap-1" onClick={() => void activateReminders()}><Bell className="h-4 w-4" />{remindersOn ? "Promemoria attivi" : "Avvisami"}</Button>}
            <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Aggiorna disponibilità"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {[1, 2, 15, 16, 17].map((group) => {
          const groupSessions = sessions.filter((session) => groupForDay(gymSlot(session.start_time).day) === group);
          if (!groupSessions.length) return null;
          const selected = groupSessions.find((session) => {
            const booking = bookingFor(session.id);
            return booking && activeBookingStatuses.has(booking.status);
          });
          return (
            <section key={group}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{({ 1: "Lunedì / Martedì", 2: "Mercoledì / Giovedì", 15: "Venerdì", 16: "Sabato", 17: "Domenica" } as Record<number, string>)[group]}</h3>
                {selected && <Badge variant={bookingFor(selected.id)?.status === "pending" ? "outline" : "default"} className="gap-1">{bookingStatusLabels[bookingFor(selected.id)!.status]}</Badge>}
              </div>
              <div className="space-y-2">
                {groupSessions.map((session) => {
                  const booking = bookingFor(session.id);
                  const activeBooking = booking && activeBookingStatuses.has(booking.status);
                  const pending = booking?.status === "pending";
                  const declined = booking?.status === "cancelled" || booking?.status === "absent";
                  const habitual = isFixed(session);
                  const remaining = placesForClient(session, availability.find((item) => item.session_id === session.id), habitual, booking);
                  const deadline = confirmationDeadline(session);
                  const closed = now >= deadline.getTime();
                  const otherSelected = Boolean(selected && selected.id !== session.id);
                  const unavailable = otherSelected || remaining === 0 || remaining === undefined;
                  return (
                    <div key={session.id} className={`rounded-xl border p-3 ${activeBooking ? "border-primary bg-primary/5" : declined ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold capitalize">{formatGymDate(session.start_time)}</p>
                          <p className="text-xs text-muted-foreground">{session.course?.name}{habitual ? " · posto fisso" : " · posto occasionale"}</p>
                          <p className={`mt-1 text-[11px] ${closed ? "text-destructive" : "text-muted-foreground"}`}>{closed ? "Conferme chiuse · per modifiche contatta il coach" : `Rispondi entro ${formatGymDate(deadline)}`}</p>
                          {booking && <p className="mt-1 text-xs font-medium">{bookingStatusLabels[booking.status] ?? "Stato da verificare"}</p>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <Users className="mr-1 inline h-3.5 w-3.5" />
                          {activeBooking ? "Posto prenotato" : remaining === undefined ? "Da verificare" : remaining === null ? "Disponibile" : `${remaining} posti ${habitual ? "fissi" : "occasionali"}`}
                        </div>
                      </div>
                      {(pending || (habitual && !booking)) && !closed ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button disabled={savingId !== null || unavailable} onClick={() => void action(session, "confirm")}><CheckCircle2 className="mr-1 h-4 w-4" />Partecipo</Button>
                          <Button variant="outline" disabled={savingId !== null} onClick={() => void action(session, "cancel")}><UserRoundX className="mr-1 h-4 w-4" />Non partecipo</Button>
                        </div>
                      ) : (
                        <Button
                          className="mt-3 w-full"
                          variant={activeBooking ? "outline" : declined ? "secondary" : habitual ? "default" : "secondary"}
                          disabled={savingId !== null || closed || (!activeBooking && unavailable)}
                          onClick={() => void action(session, activeBooking ? "cancel" : "confirm")}
                        >
                          {savingId === session.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {closed ? "Conferme chiuse" : activeBooking ? "Annulla presenza" : unavailable ? (otherSelected ? "Hai già scelto il turno" : remaining === undefined ? "Disponibilità da verificare" : "Posti disponibili esauriti") : declined ? "Cambio idea: partecipo" : habitual ? "Conferma presenza" : "Prenota posto occasionale"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
