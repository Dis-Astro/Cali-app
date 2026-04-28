import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  MapPin, 
  Dumbbell, 
  CreditCard,
  RefreshCw,
  Trash2,
  Edit2
} from "lucide-react";
import { format, addDays, subDays, isSameDay, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";

interface MobileCalendarDay {
  date: Date;
  appointments: any[];
  sessions: any[];
  deadlines: any[];
  subDeadlines: any[];
}

interface MobileWeeklyCalendarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  days: MobileCalendarDay[];
  onDayClick: (date: Date) => void;
  onAppointmentClick?: (appointment: any) => void;
  onSessionClick?: (session: any) => void;
  onDeadlineClick?: (deadline: any) => void;
}

export const MobileWeeklyCalendar = ({
  currentDate,
  onDateChange,
  days,
  onDayClick,
  onAppointmentClick,
  onSessionClick,
  onDeadlineClick
}: MobileWeeklyCalendarProps) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const handlePrevWeek = () => {
    onDateChange(subDays(currentDate, 7));
  };

  const handleNextWeek = () => {
    onDateChange(addDays(currentDate, 7));
  };

  const selectedDay = days[selectedDayIndex];

  return (
    <div className="space-y-4 lg:hidden">
      {/* Week Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrevWeek}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium">
                {format(startOfWeek(currentDate), "d MMM", { locale: it })} - {format(addDays(startOfWeek(currentDate), 6), "d MMM yyyy", { locale: it })}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNextWeek}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day, idx) => (
          <button
            key={day.date.toISOString()}
            onClick={() => setSelectedDayIndex(idx)}
            className={`flex-shrink-0 p-3 rounded-lg border-2 transition-all min-w-[70px] text-center ${
              selectedDayIndex === idx
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="text-xs font-medium text-muted-foreground uppercase">
              {format(day.date, "EEE", { locale: it })}
            </div>
            <div className="text-lg font-display mt-1">
              {format(day.date, "d")}
            </div>
            {(day.appointments.length > 0 || day.sessions.length > 0 || day.deadlines.length > 0 || day.subDeadlines.length > 0) && (
              <div className="w-2 h-2 bg-primary rounded-full mx-auto mt-2"></div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Day Details */}
      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {format(selectedDay.date, "EEEE d MMMM yyyy", { locale: it })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {selectedDay.appointments.length === 0 &&
                  selectedDay.sessions.length === 0 &&
                  selectedDay.deadlines.length === 0 &&
                  selectedDay.subDeadlines.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nessun evento per questa giornata
                    </p>
                  )}

                {/* Appointments */}
                {selectedDay.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
                    onClick={() => onAppointmentClick?.(apt)}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: apt.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{apt.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(apt.start_time), "HH:mm")} - {format(new Date(apt.end_time), "HH:mm")}
                        </div>
                        {apt.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3" />
                            {apt.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Course Sessions */}
                {selectedDay.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors"
                    onClick={() => onSessionClick?.(session)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0 bg-green-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{session.course?.name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(session.start_time), "HH:mm")} - {format(new Date(session.end_time), "HH:mm")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Workout Deadlines */}
                {selectedDay.deadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                    onClick={() => onDeadlineClick?.(deadline)}
                  >
                    <div className="flex items-start gap-2">
                      <Dumbbell className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Scadenza Scheda</p>
                        <p className="text-xs text-muted-foreground mt-1">{deadline.name}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Subscription Deadlines */}
                {selectedDay.subDeadlines.map((sub) => (
                  <div
                    key={`sub-${sub.id}`}
                    className="p-3 rounded-lg border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600 dark:text-orange-400" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">Scadenza Abbonamento</p>
                        <p className="text-xs text-muted-foreground mt-1">{sub.plan_name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const DeadlinesPanel = ({ 
  upcomingDeadlines, 
  onRenew 
}: { 
  upcomingDeadlines: any[]; 
  onRenew?: (deadline: any) => void;
}) => {
  if (upcomingDeadlines.length === 0) return null;

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          Scadenze Imminenti
        </CardTitle>
        <CardDescription>Prossimi 7 giorni</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {upcomingDeadlines.map((deadline, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-950/50">
              <div className="flex-1">
                <p className="text-sm font-medium">{deadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(deadline.date), "d MMM yyyy", { locale: it })}
                </p>
              </div>
              {deadline.type === "subscription" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onRenew?.(deadline)}
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const LastWorkoutPlanCard = ({ 
  workoutPlan, 
  daysRemaining 
}: { 
  workoutPlan: any; 
  daysRemaining: number;
}) => {
  if (!workoutPlan) return null;

  const isExpiringSoon = daysRemaining <= 7;
  const isExpired = daysRemaining <= 0;

  return (
    <Card className={isExpired ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : isExpiringSoon ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            <CardTitle className="text-base">Ultima Scheda</CardTitle>
          </div>
          <Badge variant={isExpired ? "destructive" : isExpiringSoon ? "secondary" : "default"}>
            {isExpired ? "Scaduta" : isExpiringSoon ? "In Scadenza" : "Attiva"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{workoutPlan.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Scade il {format(new Date(workoutPlan.end_date), "d MMMM yyyy", { locale: it })}
            </p>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-100 dark:bg-slate-900">
            <span className="text-sm font-medium">Giorni Rimanenti</span>
            <span className={`text-lg font-display ${isExpired ? "text-red-600" : isExpiringSoon ? "text-yellow-600" : "text-green-600"}`}>
              {Math.max(0, daysRemaining)}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isExpired ? "bg-red-500" : isExpiringSoon ? "bg-yellow-500" : "bg-green-500"}`}
              style={{ width: `${Math.max(0, Math.min(100, (Math.max(0, daysRemaining) / 30) * 100))}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

import { AlertTriangle } from "lucide-react";
