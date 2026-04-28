import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock,
  MapPin,
  User,
  Loader2
} from "lucide-react";
import ClientLayout from "@/components/coaching/ClientLayout";
import { format, parseISO, isPast, isFuture, isToday } from "date-fns";
import { it } from "date-fns/locale";

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

  useEffect(() => {
    if (profile?.user_id) {
      fetchAppointments();
    }
  }, [profile?.user_id]);

  const fetchAppointments = async () => {
    setLoading(true);
    
    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", profile?.user_id)
      .order("start_time");

    if (appointmentsData && appointmentsData.length > 0) {
      const coachIds = [...new Set(appointmentsData.map(a => a.coach_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", coachIds);

      const coachMap = new Map(profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []);

      setAppointments(appointmentsData.map(a => ({
        ...a,
        coach_name: coachMap.get(a.coach_id)
      })));
    } else {
      setAppointments([]);
    }

    setLoading(false);
  };

  const upcomingAppointments = appointments.filter(a => 
    isFuture(parseISO(a.start_time)) || isToday(parseISO(a.start_time))
  );
  const pastAppointments = appointments.filter(a => 
    isPast(parseISO(a.start_time)) && !isToday(parseISO(a.start_time))
  );

  const AppointmentCard = ({ appointment, isPast: past }: { appointment: Appointment; isPast?: boolean }) => (
    <div 
      className={`p-4 rounded-lg border ${
        past ? 'opacity-60 bg-muted/20' : 'bg-card hover:border-primary/50'
      } transition-colors`}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-medium">{appointment.title}</h4>
        {isToday(parseISO(appointment.start_time)) && (
          <Badge variant="default">Oggi</Badge>
        )}
      </div>
      
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {format(parseISO(appointment.start_time), "EEEE d MMMM yyyy", { locale: it })}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {format(parseISO(appointment.start_time), "HH:mm")} - {format(parseISO(appointment.end_time), "HH:mm")}
        </div>
        {appointment.coach_name && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Coach {appointment.coach_name}
          </div>
        )}
        {appointment.location && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {appointment.location}
          </div>
        )}
      </div>
      
      {appointment.description && (
        <p className="mt-3 text-sm">{appointment.description}</p>
      )}
    </div>
  );

  return (
    <ClientLayout title="APPUNTAMENTI">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display tracking-wider flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Prossimi Appuntamenti
              </CardTitle>
              <CardDescription>{upcomingAppointments.length} appuntamenti in programma</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun appuntamento in programma</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingAppointments.map(apt => (
                    <AppointmentCard key={apt.id} appointment={apt} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past */}
          {pastAppointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display tracking-wider text-muted-foreground">
                  Appuntamenti Passati
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastAppointments.slice(0, 6).map(apt => (
                    <AppointmentCard key={apt.id} appointment={apt} isPast />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ClientLayout>
  );
};

export default AppointmentsPage;
