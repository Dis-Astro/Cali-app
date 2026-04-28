import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  Loader2,
  Plus
} from "lucide-react";
import CoachLayout from "@/components/coach/CoachLayout";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  location: string | null;
  description: string | null;
  color: string | null;
  client_name?: string;
}

const CoachCalendarPage = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  useEffect(() => {
    if (profile?.user_id) {
      fetchAppointments();
    }
  }, [profile?.user_id, currentMonth]);

  const fetchAppointments = async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();

    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select("*")
      .eq("coach_id", profile?.user_id)
      .gte("start_time", start)
      .lte("start_time", end)
      .order("start_time");

    if (appointmentsData && appointmentsData.length > 0) {
      const clientIds = appointmentsData
        .filter(a => a.client_id)
        .map(a => a.client_id);
      
      if (clientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name")
          .in("user_id", clientIds);

        const clientMap = new Map(profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []);

        setAppointments(appointmentsData.map(a => ({
          ...a,
          client_name: a.client_id ? clientMap.get(a.client_id) : undefined
        })));
      } else {
        setAppointments(appointmentsData);
      }
    } else {
      setAppointments([]);
    }

    setLoading(false);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const getAppointmentsForDay = (date: Date) => 
    appointments.filter(a => isSameDay(parseISO(a.start_time), date));

  const selectedDayAppointments = selectedDate 
    ? getAppointmentsForDay(selectedDate) 
    : [];

  const weekDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  return (
    <CoachLayout title="CALENDARIO" icon={<CalendarIcon className="w-6 h-6" />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-display tracking-wider">
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                Oggi
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[320px]">
                {/* Week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {weekDays.map(day => (
                    <div key={day} className="text-center text-[10px] md:text-xs font-medium text-muted-foreground py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-px md:gap-1">
                  {/* Empty cells for days before first of month */}
                  {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-10 md:h-24" />
                  ))}
                  
                  {days.map(day => {
                    const dayAppointments = getAppointmentsForDay(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`h-10 md:h-24 p-0.5 md:p-1 border rounded transition-colors text-left ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        } ${isToday ? 'bg-muted/50' : ''}`}
                      >
                        <span className={`text-[10px] md:text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                          {format(day, "d")}
                        </span>
                        <div className="hidden md:block mt-1 space-y-1">
                          {dayAppointments.slice(0, 2).map(apt => (
                            <div 
                              key={apt.id} 
                              className="text-xs truncate px-1 rounded"
                              style={{ backgroundColor: apt.color || '#3B82F6', color: 'white' }}
                            >
                              {format(parseISO(apt.start_time), "HH:mm")} {apt.title}
                            </div>
                          ))}
                          {dayAppointments.length > 2 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayAppointments.length - 2} altri
                            </div>
                          )}
                        </div>
                        {dayAppointments.length > 0 && (
                          <div className="md:hidden flex gap-0.5 mt-0.5 justify-center">
                            {dayAppointments.slice(0, 3).map(apt => (
                              <div 
                                key={apt.id} 
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: apt.color || '#3B82F6' }}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day Details */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display tracking-wider text-lg">
              {selectedDate ? format(selectedDate, "EEEE d MMMM", { locale: it }) : "Seleziona un giorno"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nessun appuntamento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayAppointments.map(apt => (
                  <div 
                    key={apt.id} 
                    className="p-3 rounded-lg border-l-4"
                    style={{ borderLeftColor: apt.color || '#3B82F6' }}
                  >
                    <h4 className="font-medium">{apt.title}</h4>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(apt.start_time), "HH:mm")} - {format(parseISO(apt.end_time), "HH:mm")}
                      </div>
                      {apt.client_name && (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          {apt.client_name}
                        </div>
                      )}
                      {apt.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {apt.location}
                        </div>
                      )}
                    </div>
                    {apt.description && (
                      <p className="mt-2 text-sm">{apt.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CoachLayout>
  );
};

export default CoachCalendarPage;
