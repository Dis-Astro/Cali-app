import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Clock3, Loader2, RefreshCw, UserCheck, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmationDeadline, formatGymDate, gymDateKey, gymDayStart, gymSlot, matchesFixedSlot } from "@/features/course-booking/courseSchedule";
import { summarizeRoster } from "@/features/course-booking/courseRoster";
import { useCourseClock } from "@/features/course-booking/useCourseClock";

interface Session {
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
  user_id: string;
  booking_type: string;
  status: string;
}

interface Membership {
  course_id: string;
  user_id: string;
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

export default function CourseRosterManagement({ coachId }: { coachId?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sessionLimit, setSessionLimit] = useState(24);
  const [hasMore, setHasMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const mutationInFlight = useRef(false);
  const owner = coachId ?? "admin";
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const now = useCourseClock();
  const dayKey = gymDateKey(new Date(now));

  const range = useMemo(() => {
    const anchor = gymDayStart(dayKey).getTime();
    const day = 86_400_000;
    return showHistory ? { start: new Date(anchor - 30 * day), end: new Date(anchor) } : { start: new Date(anchor), end: new Date(anchor + 21 * day) };
  }, [showHistory, dayKey]);

  const load = useCallback(async () => {
    if (currentOwner.current !== owner) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current && currentOwner.current === owner;
    setLoading(true);
    setLoadError(false);
    try {
    let courseIds: string[] | null = null;
    if (coachId) {
      const { data, error } = await supabase.from("courses").select("id").eq("coach_id", coachId).eq("is_active", true);
      if (!current()) return;
      if (error) throw error;
      courseIds = (data ?? []).map((course) => course.id);
      if (!courseIds.length) {
        setSessions([]);
        setLoadedFor(owner);
        setHasMore(false);
        return;
      }
    }

    let sessionQuery = supabase
      .from("course_sessions")
      .select("id, course_id, start_time, end_time, max_participants, fixed_places, floating_places, confirmation_deadline_hours, course:courses(name, color, max_participants)")
      .eq("is_cancelled", false)
      .gte("start_time", range.start.toISOString())
      .lte("start_time", range.end.toISOString())
      .order("start_time", { ascending: !showHistory })
      .limit(sessionLimit + 1);
    if (courseIds) sessionQuery = sessionQuery.in("course_id", courseIds);
    const { data: sessionData, error } = await sessionQuery;
    if (!current()) return;
    if (error || !sessionData) throw error ?? new Error("Turni non disponibili");

    const normalized = sessionData.slice(0, sessionLimit) as Session[];
    const sessionIds = normalized.map((session) => session.id);
    const activeCourseIds = [...new Set(normalized.map((session) => session.course_id))];
    const [bookingResult, assignmentResult, membershipResult] = await Promise.all([
      sessionIds.length ? supabase.from("course_bookings").select("id, course_session_id, user_id, booking_type, status").in("course_session_id", sessionIds) : Promise.resolve({ data: [] }),
      activeCourseIds.length ? supabase.from("course_fixed_assignments").select("course_id, user_id, day_of_week, start_time").in("course_id", activeCourseIds).eq("is_active", true) : Promise.resolve({ data: [] }),
      activeCourseIds.length ? supabase.from("course_participants").select("course_id, user_id").in("course_id", activeCourseIds) : Promise.resolve({ data: [] }),
    ]);
    if (!current()) return;
    if ([bookingResult, assignmentResult, membershipResult].some((result) => "error" in result && result.error)) throw new Error("Presenze incomplete");
    const nextBookings = (bookingResult.data ?? []) as Booking[];
    const nextAssignments = (assignmentResult.data ?? []) as Assignment[];
    const nextMemberships = (membershipResult.data ?? []) as Membership[];
    const userIds = [...new Set([...nextBookings.map((booking) => booking.user_id), ...nextAssignments.map((assignment) => assignment.user_id), ...nextMemberships.map((membership) => membership.user_id)])];
    const profileResult = userIds.length
      ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
      : { data: [] };
    if (!current()) return;
    if ("error" in profileResult && profileResult.error) throw profileResult.error;

    setSessions(normalized);
    setBookings(nextBookings);
    setAssignments(nextAssignments);
    setMemberships(nextMemberships);
    setNames(new Map((profileResult.data ?? []).map((profile) => [profile.user_id, `${profile.first_name} ${profile.last_name}`])));
    setHasMore(sessionData.length > sessionLimit);
    setLoadedFor(owner);
    } catch {
      if (current()) {
        setLoadError(true);
        setLoadedFor(owner);
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [coachId, owner, range.end, range.start, showHistory, sessionLimit]);

  useEffect(() => {
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`course-roster-${coachId ?? "admin"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "course_bookings" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_fixed_assignments" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_sessions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "course_participants" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coachId, load]);

  const assignmentsForSession = (session: Session) => {
    if (new Date(session.start_time).getTime() < now) return [];
    return assignments.filter((assignment) => matchesFixedSlot(assignment, session));
  };

  const updateStatus = async (session: Session, userId: string, booking: Booking | undefined, status: string) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    const key = `${session.id}:${userId}`;
    setSaving(key);
    try {
    const fixedMember = assignmentsForSession(session).some((assignment) => assignment.user_id === userId);
    const result = booking
      ? await supabase.from("course_bookings").update({ status }).eq("id", booking.id)
      : await supabase.from("course_bookings").insert({ course_session_id: session.id, user_id: userId, booking_type: fixedMember ? "fixed" : "floating", status });
    if (result.error) toast.error("Impossibile aggiornare la presenza");
    else await load();
    } catch {
      toast.error("Esito non verificato: aggiorna le presenze prima di riprovare.");
      await load();
    } finally {
      mutationInFlight.current = false;
      setSaving(null);
    }
  };

  const setFixed = async (session: Session, userId: string, fixed: boolean) => {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    const slot = gymSlot(session.start_time);
    const key = `${session.id}:${userId}:fixed`;
    setSaving(key);
    try {
    const query = supabase.from("course_fixed_assignments");
    const result = fixed
      ? await query.insert({
          course_id: session.course_id,
          user_id: userId,
          day_of_week: slot.day,
          start_time: slot.time,
        })
      : await query
          .delete()
          .eq("course_id", session.course_id)
          .eq("user_id", userId)
          .eq("day_of_week", slot.day)
          .eq("start_time", slot.time);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(fixed ? "Posto fisso assegnato" : "Passato a occasionale");
      await load();
    }
    } catch {
      toast.error("Esito non verificato: aggiorna le assegnazioni prima di riprovare.");
      await load();
    } finally {
      mutationInFlight.current = false;
      setSaving(null);
    }
  };

  if (loading || loadedFor !== owner) return <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 font-display tracking-wider"><CalendarClock className="h-5 w-5 text-primary" />TURNI E PRESENZE</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{showHistory ? "Storico degli ultimi 30 giorni." : "Prossimi 21 giorni."} Orari della palestra (Italia).</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowHistory((value) => !value); setSessionLimit(24); }}>{showHistory ? "Prossimi" : "Storico"}</Button>
            <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Aggiorna"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError && <p role="alert" className="text-sm text-destructive">Presenze non disponibili: aggiorna prima di modificarle. Non vengono mostrati conteggi incompleti.</p>}
        {!loadError && <>
        {!sessions.length && <p className="py-8 text-center text-sm text-muted-foreground">Nessun turno programmato.</p>}
        {sessions.map((session) => {
          const sessionBookings = bookings.filter((booking) => booking.course_session_id === session.id);
          const fixed = assignmentsForSession(session);
          const courseMembers = memberships.filter((membership) => membership.course_id === session.course_id);
          const attendeeIds = [...new Set([...fixed.map((assignment) => assignment.user_id), ...sessionBookings.map((booking) => booking.user_id)])];
          const capacity = session.max_participants ?? session.course?.max_participants;
          const counts = summarizeRoster(sessionBookings, fixed.map((assignment) => assignment.user_id), capacity);
          const { awaiting, declined, placesLeft, floating: floatingActive } = counts;
          const historical = new Date(session.start_time).getTime() < now;
          const fixedCount = historical ? sessionBookings.filter((booking) => booking.booking_type === "fixed").length : fixed.length;
          return (
            <section key={session.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="h-1.5 w-full bg-muted">
                <div className="h-full rounded-r-full bg-primary transition-all" style={{ width: capacity ? `${Math.min(100, (counts.reserved / capacity) * 100)}%` : "0%" }} />
              </div>
              <div className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold capitalize">{formatGymDate(session.start_time, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-sm text-muted-foreground">{session.course?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{now >= confirmationDeadline(session).getTime() ? "Conferme clienti chiuse · modifiche gestite dal coach" : `Risposte clienti entro ${formatGymDate(confirmationDeadline(session))}`}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge><UserCheck className="mr-1 h-3 w-3" />Confermati / presenti {counts.confirmed}/{capacity ?? "∞"}</Badge>
                  <Badge variant={awaiting ? "outline" : "secondary"}><Clock3 className="mr-1 h-3 w-3" />Da confermare {awaiting}</Badge>
                  <Badge variant={declined ? "destructive" : "secondary"}><UserRoundX className="mr-1 h-3 w-3" />Assenti {declined}</Badge>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{fixedCount}/{session.fixed_places}</p><p className="text-[11px] text-muted-foreground">{historical ? "fissi registrati" : "posti fissi"}</p></div>
                <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{floatingActive}/{session.floating_places ?? (capacity == null ? "∞" : Math.max(0, capacity - session.fixed_places))}</p><p className="text-[11px] text-muted-foreground">occasionali</p></div>
                <div className="rounded-xl bg-primary/10 p-2"><p className="text-lg font-bold text-primary">{placesLeft ?? "∞"}</p><p className="text-[11px] text-muted-foreground">posti liberi</p></div>
              </div>
              <div className="mt-3 space-y-2">
                {!attendeeIds.length && <p className="text-xs text-muted-foreground">Nessuna assegnazione o prenotazione.</p>}
                {attendeeIds.map((userId) => {
                  const booking = sessionBookings.find((item) => item.user_id === userId);
                  const fixedMember = historical ? booking?.booking_type === "fixed" : fixed.some((assignment) => assignment.user_id === userId);
                  const value = booking?.status ?? "pending";
                  return (
                    <div key={userId} className="flex flex-col gap-2 rounded-xl bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{names.get(userId) ?? "Membro"}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={fixedMember ? "default" : "outline"} className="text-[10px]">{fixedMember ? "Fisso" : booking?.booking_type === "switch" ? "Cambio turno" : "Occasionale"}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{booking ? statusLabels[value] : "Da confermare"}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-9" disabled={historical || saving !== null} onClick={() => void setFixed(session, userId, !fixedMember)}>
                          {fixedMember ? "Rendi occasionale" : "Rendi fisso"}
                        </Button>
                        <Select value={value} onValueChange={(status) => void updateStatus(session, userId, booking, status)} disabled={saving !== null}>
                          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(statusLabels).map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
              {historical ? <p className="mt-3 text-xs text-muted-foreground">Lo storico mostra solo le risposte registrate. Le assegnazioni fisse attuali non ricostruiscono le presenze passate.</p> : <details className="mt-3 rounded-xl border border-border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">Gestisci posti fissi e occasionali ({courseMembers.length} iscritti)</summary>
                <div className="mt-3 space-y-2">
                  {courseMembers.map((member) => {
                    const fixedMember = fixed.some((assignment) => assignment.user_id === member.user_id);
                    return (
                      <div key={member.user_id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{names.get(member.user_id) ?? "Membro"}</p><p className="text-xs text-muted-foreground">{fixedMember ? "Posto riservato ogni settimana" : "Prenota solo quando partecipa"}</p></div>
                        <Button variant={fixedMember ? "secondary" : "outline"} size="sm" disabled={saving !== null} onClick={() => void setFixed(session, member.user_id, !fixedMember)}>{fixedMember ? "Rendi occasionale" : "Imposta fisso"}</Button>
                      </div>
                    );
                  })}
                </div>
              </details>}
              </div>
            </section>
          );
        })}
        {hasMore && <Button variant="outline" className="w-full" onClick={() => setSessionLimit((value) => value + 24)}>Mostra altri turni ({sessions.length} visualizzati)</Button>}
        </>}
      </CardContent>
    </Card>
  );
}
