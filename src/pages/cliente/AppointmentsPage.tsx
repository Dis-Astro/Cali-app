import { useEffect, useState } from "react";
import { format, isFuture, isPast, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, Clock, Loader2, MapPin, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import ClientLayout from "@/components/coaching/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  coach_id: string;
  coach_name?: string;
}

const AppointmentsPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (profile?.user_id) void fetchAppointments();
  }, [profile?.user_id]);

  const fetchAppointments = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const cacheKey = `appointments:${profile.user_id}`;
    const cached = await getOfflineCache<Appointment[]>(cacheKey);

    if (cached) {
      setAppointments(cached.value);
      setFromCache(true);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const { data: appointmentsData, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", profile.user_id)
        .order("start_time");
      if (error) throw error;

      const coachIds = [...new Set((appointmentsData || []).map((appointment) => appointment.coach_id))];
      let coachMap = new Map<string, string>();

      if (coachIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", coachIds);
        if (profilesError) throw profilesError;
        coachMap = new Map((profiles || []).map((coach) => [coach.user_id, `${coach.first_name} ${coach.last_name}`]));
      }

      const normalized = (appointmentsData || []).map((appointment) => ({
        ...appointment,
        coach_name: coachMap.get(appointment.coach_id),
      }));
      setAppointments(normalized);
      setFromCache(false);
      await setOfflineCache(cacheKey, normalized);
    } catch {
      if (!cached) setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const upcomingAppointments = appointments.filter((appointment) =>
    isFuture(parseISO(appointment.start_time)) || isToday(parseISO(appointment.start_time)),
  );
  const pastAppointments = appointments.filter((appointment) =>
    isPast(parseISO(appointment.start_time)) && !isToday(parseISO(appointment.start_time)),
  );

  const AppointmentCard = ({ appointment, past }: { appointment: Appointment; past?: boolean }) => (
    <div className={`rounded-2xl border p-4 transition-colors ${past ? "bg-muted/20 opacity-60" : "bg-card hover:border-primary/50"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="break-words font-medium">{appointment.title}</h4>
        {isToday(parseISO(appointment.start_time)) && <Badge>Oggi</Badge>}
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{format(parseISO(appointment.start_time), "EEEE d MMMM yyyy", { locale: it })}</div>
        <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{format(parseISO(appointment.start_time), "HH:mm")} - {format(parseISO(appointment.end_time), "HH:mm")}</div>
        {appointment.coach_name && <div className="flex items-center gap-2"><User className="h-4 w-4" />Coach {appointment.coach_name}</div>}
        {appointment.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{appointment.location}</div>}
      </div>
      {appointment.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{appointment.description}</p>}
    </div>
  );

  return (
    <ClientLayout title="APPUNTAMENTI">
      {loading && !appointments.length ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {fromCache && <Badge variant="outline">Dati disponibili offline</Badge>}
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display tracking-wider"><Calendar className="h-5 w-5 text-primary" />Prossimi appuntamenti</CardTitle>
              <CardDescription>{upcomingAppointments.length} appuntamenti in programma</CardDescription>
            </CardHeader>
            <CardContent>
              {!upcomingAppointments.length ? (
                <div className="py-8 text-center text-muted-foreground"><Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" /><p>Nessun appuntamento in programma</p></div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{upcomingAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div>
              )}
            </CardContent>
          </Card>
          {pastAppointments.length > 0 && (
            <Card className="rounded-3xl">
              <CardHeader><CardTitle className="font-display tracking-wider text-muted-foreground">Appuntamenti passati</CardTitle></CardHeader>
              <CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{pastAppointments.slice(0, 6).map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} past />)}</div></CardContent>
            </Card>
          )}
        </div>
      )}
    </ClientLayout>
  );
};

export default AppointmentsPage;
