import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, getISODay } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Session {
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
  user_id: string;
  booking_type: string;
  status: string;
}

interface Assignment {
  course_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
}

const statusLabels: Record<string, string> = {
  pending: "Da confermare",
  confirmed: "Confermato",
  present: "Presente",
  absent: "Assente",
  cancelled: "Annullato",
};

const activeStatuses = new Set(["pending", "confirmed", "present"]);

export default function CourseRosterManagement({ coachId }: { coachId?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    return showHistory ? { start: addDays(now, -30), end: now } : { start: now, end: addDays(now, 21) };
  }, [showHistory]);

  const load = useCallback(async () => {
    setLoading(true);
    let courseIds: string[] | null = null;
    if (coachId) {
      const { data } = await supabase.from("courses").select("id").eq("coach_id", coachId).eq("is_active", true);
      courseIds = (data ?? []).map((course) => course.id);
      if (!courseIds.length) {
        setSessions([]);
        setLoading(false);
        return;
      }
    }

    let sessionQuery = supabase
      .from("course_sessions")
      .select("id, course_id, start_time, end_time, max_participants, fixed_places, floating_places, course:courses(name, color, max_participants)")
      .eq("is_cancelled", false)
      .gte("start_time", range.start.toISOString())
      .lte("start_time", range.end.toISOString())
      .order("start_time", { ascending: !showHistory })
      .limit(24);
    if (courseIds) sessionQuery = sessionQuery.in("course_id", courseIds);
    const { data: sessionData, error } = await sessionQuery;
    if (error || !sessionData) {
      if (error) toast.error("Impossibile caricare i turni");
      setLoading(false);
      return;
    }

    const normalized = sessionData as Session[];
    const sessionIds = normalized.map((session) => session.id);
    const activeCourseIds = [...new Set(normalized.map((session) => session.course_id))];
    const [bookingResult, assignmentResult] = await Promise.all([
      sessionIds.length ? supabase.from("course_bookings").select("id, course_session_id, user_id, booking_type, status").in("course_session_id", sessionIds) : Promise.resolve({ data: [] }),
      activeCourseIds.length ? supabase.from("course_fixed_assignments").select("course_id, user_id, day_of_week, start_time").in("course_id", activeCourseIds).eq("is_active", true) : Promise.resolve({ data: [] }),
    ]);
    const nextBookings = (bookingResult.data ?? []) as Booking[];
    const nextAssignments = (assignmentResult.data ?? []) as Assignment[];
    const userIds = [...new Set([...nextBookings.map((booking) => booking.user_id), ...nextAssignments.map((assignment) => assignment.user_id)])];
    const profileResult = userIds.length
      ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
      : { data: [] };

    setSessions(normalized);
    setBookings(nextBookings);
    setAssignments(nextAssignments);
    setNames(new Map((profileResult.data ?? []).map((profile) => [profile.user_id, `${profile.first_name} ${profile.last_name}`])));
    setLoading(false);
  }, [coachId, range.end, range.start, showHistory]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`course-roster-${coachId ?? "admin"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_bookings" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_fixed_assignments" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coachId, load]);

  const assignmentsForSession = (session: Session) => {
    const start = new Date(session.start_time);
    const time = format(start, "HH:mm:ss");
    return assignments.filter((assignment) => assignment.course_id === session.course_id && assignment.day_of_week === getISODay(start) && assignment.start_time.slice(0, 8) === time);
  };

  const updateStatus = async (session: Session, userId: string, booking: Booking | undefined, status: string) => {
    const key = `${session.id}:${userId}`;
    setSaving(key);
    const result = booking
      ? await supabase.from("course_bookings").update({ status }).eq("id", booking.id)
      : await supabase.from("course_bookings").insert({ course_session_id: session.id, user_id: userId, booking_type: "fixed", status });
    if (result.error) toast.error("Impossibile aggiornare la presenza");
    else await load();
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarClock className="h-5 w-5 text-primary" />TURNI E PRESENZE</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{showHistory ? "Storico degli ultimi 30 giorni." : "Prossimi 21 giorni: situazione aggiornata in tempo reale."}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHistory((value) => !value)}>{showHistory ? "Prossimi" : "Storico"}</Button>
            <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Aggiorna"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sessions.length && <p className="py-8 text-center text-sm text-muted-foreground">Nessun turno programmato.</p>}
        {sessions.map((session) => {
          const sessionBookings = bookings.filter((booking) => booking.course_session_id === session.id);
          const fixed = assignmentsForSession(session);
          const attendeeIds = [...new Set([...fixed.map((assignment) => assignment.user_id), ...sessionBookings.map((booking) => booking.user_id)])];
          const active = sessionBookings.filter((booking) => activeStatuses.has(booking.status));
          const floatingActive = active.filter((booking) => booking.booking_type !== "fixed").length;
          const capacity = session.max_participants ?? session.course?.max_participants;
          return (
            <section key={session.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize">{format(new Date(session.start_time), "EEEE d MMMM · HH:mm", { locale: it })}</p>
                  <p className="text-sm text-muted-foreground">{session.course?.name}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge><Users className="mr-1 h-3 w-3" />Confermati {active.length}/{capacity ?? "∞"}</Badge>
                  <Badge variant="secondary">Fissi {fixed.length}/{session.fixed_places}</Badge>
                  <Badge variant="secondary">Vaganti {floatingActive}/{session.floating_places ?? 0}</Badge>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {!attendeeIds.length && <p className="text-xs text-muted-foreground">Nessuna assegnazione o prenotazione.</p>}
                {attendeeIds.map((userId) => {
                  const booking = sessionBookings.find((item) => item.user_id === userId);
                  const fixedMember = fixed.some((assignment) => assignment.user_id === userId);
                  const value = booking?.status ?? "pending";
                  const key = `${session.id}:${userId}`;
                  return (
                    <div key={userId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{names.get(userId) ?? "Membro"}</p>
                        <p className="text-xs text-muted-foreground">{fixedMember ? "Posto fisso" : booking?.booking_type === "switch" ? "Cambio turno" : "Posto vagante"}</p>
                      </div>
                      <Select value={value} onValueChange={(status) => void updateStatus(session, userId, booking, status)} disabled={saving === key}>
                        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(statusLabels).map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}</SelectContent>
                      </Select>
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
