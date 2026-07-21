import { useCallback, useEffect, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, CreditCard, Dumbbell, MapPin, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  coach_id: string;
  location: string | null;
  color: string | null;
}

interface CourseSession {
  id: string;
  start_time: string;
  end_time: string;
  course?: { name: string; color: string | null } | null;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface Deadline {
  id: string;
  client_id: string;
  end_date: string;
  name: string;
}

interface SubscriptionDeadline {
  id: string;
  user_id: string;
  end_date: string;
  membership_plans?: { name: string } | null;
}

const MobileAdminCalendar = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDeadline[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [coaches, setCoaches] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agendaFilter, setAgendaFilter] = useState<"all" | "appointments" | "courses" | "deadlines">("all");
  const [form, setForm] = useState({ title: "", start: "09:00", end: "10:00", clientId: "", coachId: "", location: "" });

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekStartKey = weekStart.getTime();
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const load = useCallback(async () => {
    setLoading(true);
    const currentWeekStart = new Date(weekStartKey);
    const start = format(currentWeekStart, "yyyy-MM-dd");
    const end = format(addDays(currentWeekStart, 8), "yyyy-MM-dd");
    const [appointmentsRes, sessionsRes, deadlinesRes, subscriptionsRes, clientsRes, coachesRes] = await Promise.all([
      supabase.from("appointments").select("id,title,start_time,end_time,client_id,coach_id,location,color").gte("start_time", start).lt("start_time", end).order("start_time"),
      supabase.from("course_sessions").select("id,start_time,end_time,course:courses(name,color)").gte("start_time", start).lt("start_time", end).order("start_time"),
      supabase.from("workout_plans").select("id,client_id,end_date,name").gte("end_date", start).lt("end_date", end).is("deleted_at" as never, null),
      supabase.from("subscriptions").select("id,user_id,end_date,membership_plans(name)").gte("end_date", start).lt("end_date", end),
      supabase.from("profiles").select("user_id,first_name,last_name").in("role", ["cliente_palestra", "cliente_coaching", "cliente_corso"]).order("last_name"),
      supabase.from("profiles").select("user_id,first_name,last_name").in("role", ["admin", "coach"]).order("last_name"),
    ]);
    setAppointments((appointmentsRes.data || []) as Appointment[]);
    setSessions((sessionsRes.data || []) as unknown as CourseSession[]);
    setDeadlines((deadlinesRes.data || []) as Deadline[]);
    setSubscriptions((subscriptionsRes.data || []) as unknown as SubscriptionDeadline[]);
    setClients((clientsRes.data || []) as Profile[]);
    setCoaches((coachesRes.data || []) as Profile[]);
    setForm((current) => ({ ...current, coachId: current.coachId || profile?.user_id || "" }));
    setLoading(false);
  }, [profile?.user_id, weekStartKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientName = (id: string | null) => {
    if (!id) return null;
    const client = clients.find((item) => item.user_id === id);
    return client ? `${client.first_name} ${client.last_name}` : null;
  };

  const dayAppointments = appointments.filter((item) => isSameDay(parseISO(item.start_time), selectedDate));
  const daySessions = sessions.filter((item) => isSameDay(parseISO(item.start_time), selectedDate));
  const dayDeadlines = deadlines.filter((item) => isSameDay(parseISO(item.end_date), selectedDate));
  const daySubscriptions = subscriptions.filter((item) => isSameDay(parseISO(item.end_date), selectedDate));
  const total = dayAppointments.length + daySessions.length + dayDeadlines.length + daySubscriptions.length;
  const visibleTotal = agendaFilter === "all"
    ? total
    : agendaFilter === "appointments"
      ? dayAppointments.length
      : agendaFilter === "courses"
        ? daySessions.length
        : dayDeadlines.length + daySubscriptions.length;

  const openCreate = () => {
    setForm({ title: "", start: "09:00", end: "10:00", clientId: "", coachId: profile?.user_id || coaches[0]?.user_id || "", location: "" });
    setDialogOpen(true);
  };

  const createAppointment = async () => {
    if (!form.title.trim() || !form.coachId) {
      toast({ title: "Dati mancanti", description: "Inserisci titolo e coach.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const date = format(selectedDate, "yyyy-MM-dd");
    const { error } = await supabase.from("appointments").insert({
      title: form.title.trim(),
      start_time: new Date(`${date}T${form.start}:00`).toISOString(),
      end_time: new Date(`${date}T${form.end}:00`).toISOString(),
      coach_id: form.coachId,
      client_id: form.clientId || null,
      location: form.location.trim() || null,
      color: "#F59E0B",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Errore", description: "Appuntamento non creato.", variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    toast({ title: "Appuntamento creato" });
    await load();
  };

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, -7))} aria-label="Settimana precedente">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <button type="button" onClick={() => setSelectedDate(new Date())} className="min-w-0 flex-1 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Agenda</p>
          <p className="truncate font-display text-xl tracking-wide">{format(selectedDate, "MMMM yyyy", { locale: it })}</p>
        </button>
        <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 7))} aria-label="Settimana successiva">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const active = isSameDay(day, selectedDate);
          const count = appointments.filter((item) => isSameDay(parseISO(item.start_time), day)).length
            + sessions.filter((item) => isSameDay(parseISO(item.start_time), day)).length
            + deadlines.filter((item) => isSameDay(parseISO(item.end_date), day)).length
            + subscriptions.filter((item) => isSameDay(parseISO(item.end_date), day)).length;
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`relative flex min-h-[64px] flex-col items-center justify-center rounded-2xl border transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              <span className="text-[10px] uppercase">{format(day, "EEE", { locale: it })}</span>
              <span className="font-display text-2xl">{format(day, "d")}</span>
              {count > 0 && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${active ? "bg-primary-foreground" : "bg-primary"}`} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <p className="font-display text-2xl tracking-wide">{format(selectedDate, "EEEE d MMMM", { locale: it })}</p>
          <p className="text-sm text-muted-foreground">{total === 0 ? "Nessuna attività" : `${total} attività da gestire`}</p>
        </div>
        <Button size="icon" className="h-12 w-12 shrink-0 rounded-2xl" onClick={openCreate} aria-label="Nuovo appuntamento">
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri agenda">
        {[
          { value: "all", label: "Tutti" },
          { value: "appointments", label: "Appuntamenti" },
          { value: "courses", label: "Corsi" },
          { value: "deadlines", label: "Scadenze" },
        ].map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setAgendaFilter(filter.value as typeof agendaFilter)}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${agendaFilter === filter.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-44 place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : visibleTotal === 0 ? (
        <Card className="rounded-3xl border-dashed"><CardContent className="py-12 text-center"><CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" /><p className="font-medium">Giornata libera</p><p className="mt-1 text-sm text-muted-foreground">Tocca + per aggiungere un appuntamento.</p></CardContent></Card>
      ) : (
        <div className="relative space-y-3 pl-3 before:absolute before:bottom-4 before:left-0 before:top-4 before:w-px before:bg-border">
          {(agendaFilter === "all" || agendaFilter === "appointments") && dayAppointments.map((item) => (
            <Card key={item.id} className="overflow-hidden rounded-2xl"><CardContent className="flex gap-3 p-0"><div className="w-1.5 shrink-0" style={{ backgroundColor: item.color || "#F59E0B" }} /><div className="min-w-0 flex-1 py-4 pr-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{item.title}</p>{clientName(item.client_id) && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><User className="h-3.5 w-3.5" />{clientName(item.client_id)}</p>}</div><span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{format(parseISO(item.start_time), "HH:mm")}</span></div>{item.location && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{item.location}</p>}</div></CardContent></Card>
          ))}
          {(agendaFilter === "all" || agendaFilter === "courses") && daySessions.map((item) => (
            <Card key={item.id} className="rounded-2xl border-emerald-500/30 bg-emerald-500/5"><CardContent className="flex items-center gap-3 p-4"><Clock className="h-5 w-5 text-emerald-500" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.course?.name || "Sessione corso"}</p><p className="text-xs text-muted-foreground">{format(parseISO(item.start_time), "HH:mm")}–{format(parseISO(item.end_time), "HH:mm")}</p></div></CardContent></Card>
          ))}
          {(agendaFilter === "all" || agendaFilter === "deadlines") && dayDeadlines.map((item) => (
            <Card key={item.id} className="rounded-2xl border-destructive/30 bg-destructive/5"><CardContent className="flex items-center gap-3 p-4"><Dumbbell className="h-5 w-5 text-destructive" /><div><p className="font-semibold">Scheda in scadenza</p><p className="text-xs text-muted-foreground">{clientName(item.client_id) || item.name}</p></div></CardContent></Card>
          ))}
          {(agendaFilter === "all" || agendaFilter === "deadlines") && daySubscriptions.map((item) => (
            <Card key={item.id} className="rounded-2xl border-orange-500/30 bg-orange-500/5"><CardContent className="flex items-center gap-3 p-4"><CreditCard className="h-5 w-5 text-orange-500" /><div><p className="font-semibold">Abbonamento in scadenza</p><p className="text-xs text-muted-foreground">{clientName(item.user_id) || item.membership_plans?.name || "Cliente"}</p></div></CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="font-display text-2xl tracking-wide">NUOVO APPUNTAMENTO</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Titolo</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Sessione PT, prova, controllo…" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Inizio</Label><Input type="time" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></div><div className="space-y-2"><Label>Fine</Label><Input type="time" value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></div></div>
            <div className="space-y-2"><Label>Cliente</Label><Select value={form.clientId} onValueChange={(value) => setForm({ ...form, clientId: value })}><SelectTrigger><SelectValue placeholder="Facoltativo" /></SelectTrigger><SelectContent>{clients.map((item) => <SelectItem key={item.user_id} value={item.user_id}>{item.first_name} {item.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Coach</Label><Select value={form.coachId} onValueChange={(value) => setForm({ ...form, coachId: value })}><SelectTrigger><SelectValue placeholder="Seleziona coach" /></SelectTrigger><SelectContent>{coaches.map((item) => <SelectItem key={item.user_id} value={item.user_id}>{item.first_name} {item.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Luogo</Label><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Sala, area pesi…" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button><Button onClick={() => void createAppointment()} disabled={saving}>{saving ? "Salvataggio…" : "Crea"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileAdminCalendar;
