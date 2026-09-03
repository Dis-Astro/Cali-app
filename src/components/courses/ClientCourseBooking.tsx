import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfWeek, format, getISODay, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarCheck2, CheckCircle2, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CourseSession {
  id: string;
  course_id: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  fixed_places: number;
  floating_places: number | null;
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
const localTime = (date: Date) => format(date, "HH:mm:ss");
const activeStatuses = new Set(["pending", "confirmed", "present"]);

export default function ClientCourseBooking({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fixedAssignments, setFixedAssignments] = useState<FixedAssignment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [enrolled, setEnrolled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const week = useMemo(() => ({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  }), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: memberships, error: membershipError } = await supabase
      .from("course_participants")
      .select("course_id")
      .eq("user_id", userId);

    if (membershipError || !memberships?.length) {
      setEnrolled(false);
      setSessions([]);
      setLoading(false);
      return;
    }

    const courseIds = memberships.map((membership) => membership.course_id);
    setEnrolled(true);
    const [sessionsResult, bookingsResult, assignmentsResult, availabilityResult] = await Promise.all([
      supabase
        .from("course_sessions")
        .select("id, course_id, start_time, end_time, max_participants, fixed_places, floating_places, course:courses(name, color, max_participants)")
        .in("course_id", courseIds)
        .eq("is_cancelled", false)
        .gte("start_time", week.start.toISOString())
        .lte("start_time", week.end.toISOString())
        .order("start_time"),
      supabase.from("course_bookings").select("id, course_session_id, booking_type, status").eq("user_id", userId),
      supabase.from("course_fixed_assignments").select("course_id, day_of_week, start_time").eq("user_id", userId).eq("is_active", true),
      supabase.rpc("get_course_session_availability", { p_from: week.start.toISOString(), p_to: week.end.toISOString() }),
    ]);

    if (sessionsResult.error) toast.error("Impossibile caricare i turni del corso");
    setSessions((sessionsResult.data ?? []) as CourseSession[]);
    setBookings((bookingsResult.data ?? []) as Booking[]);
    setFixedAssignments((assignmentsResult.data ?? []) as FixedAssignment[]);
    setAvailability((availabilityResult.data ?? []) as Availability[]);
    setLoading(false);
  }, [userId, week.end, week.start]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`course-bookings-client-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_bookings" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_sessions" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const bookingFor = (sessionId: string) => bookings.find((booking) => booking.course_session_id === sessionId && activeStatuses.has(booking.status));
  const isFixed = (session: CourseSession) => {
    const start = new Date(session.start_time);
    return fixedAssignments.some((assignment) =>
      assignment.course_id === session.course_id
      && assignment.day_of_week === getISODay(start)
      && assignment.start_time.slice(0, 8) === localTime(start),
    );
  };
  const placesLeft = (session: CourseSession) => {
    const counts = availability.find((item) => item.session_id === session.id);
    const maximum = session.max_participants ?? session.course?.max_participants;
    return maximum === null || maximum === undefined ? null : Math.max(0, maximum - Number(counts?.booked ?? 0));
  };

  const action = async (session: CourseSession, nextAction: "confirm" | "cancel") => {
    setSavingId(session.id);
    const { error } = await supabase.rpc("manage_course_booking", { p_session_id: session.id, p_action: nextAction });
    if (error) toast.error(error.message.replace(/^.*?: /, ""));
    else toast.success(nextAction === "confirm" ? "Presenza confermata" : "Presenza annullata");
    await load();
    setSavingId(null);
  };

  if (loading) return <Card className="mb-6"><CardContent className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></CardContent></Card>;
  if (!enrolled) return null;
  if (!sessions.length) return (
    <Card className="mb-6">
      <CardHeader><CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarCheck2 className="h-5 w-5 text-primary" />CORSO BASE</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Non ci sono turni disponibili questa settimana.</CardContent>
    </Card>
  );

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarCheck2 className="h-5 w-5 text-primary" />QUESTA SETTIMANA</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Conferma un turno tra lun–mar e uno tra mer–gio.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Aggiorna disponibilità"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {[1, 2].map((group) => {
          const groupSessions = sessions.filter((session) => groupForDay(getISODay(new Date(session.start_time))) === group);
          if (!groupSessions.length) return null;
          const selected = groupSessions.find((session) => bookingFor(session.id));
          return (
            <section key={group}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Giorno {group}</h3>
                {selected && <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Confermato</Badge>}
              </div>
              <div className="space-y-2">
                {groupSessions.map((session) => {
                  const start = new Date(session.start_time);
                  const booking = bookingFor(session.id);
                  const habitual = isFixed(session);
                  const remaining = placesLeft(session);
                  const unavailable = !booking && (Boolean(selected) || remaining === 0);
                  return (
                    <div key={session.id} className={`rounded-xl border p-3 ${booking ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold capitalize">{format(start, "EEEE HH:mm", { locale: it })}</p>
                          <p className="text-xs text-muted-foreground">{session.course?.name}{habitual ? " · turno abituale" : ""}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <Users className="mr-1 inline h-3.5 w-3.5" />
                          {remaining === null ? "Disponibile" : `${remaining} posti`}
                        </div>
                      </div>
                      <Button
                        className="mt-3 w-full"
                        variant={booking ? "outline" : habitual ? "default" : "secondary"}
                        disabled={savingId === session.id || unavailable}
                        onClick={() => void action(session, booking ? "cancel" : "confirm")}
                      >
                        {savingId === session.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {booking ? "Annulla presenza" : unavailable ? (remaining === 0 ? "Turno completo" : "Hai già scelto il turno") : habitual ? "Conferma presenza" : "Prenota questo turno"}
                      </Button>
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
