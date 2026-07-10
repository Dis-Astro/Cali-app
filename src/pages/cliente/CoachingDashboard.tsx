import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  Dumbbell,
  FileText,
  Loader2,
  MessageSquare,
  Play,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import ClientLayout from "@/components/coaching/ClientLayout";

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  coach_id: string;
}

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
}

interface Coach {
  first_name: string;
  last_name: string;
}

interface Subscription {
  id: string;
  status: string;
  end_date: string;
  plan_name: string;
}

const CoachingDashboard = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [myCoach, setMyCoach] = useState<Coach | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [weekProgress, setWeekProgress] = useState(0);
  const [completedWorkouts, setCompletedWorkouts] = useState(0);

  useEffect(() => {
    if (profile?.user_id) fetchData();
  }, [profile?.user_id]);

  const fetchData = async () => {
    setLoading(true);
    const userId = profile?.user_id;
    const today = new Date().toISOString();

    const { data: plans } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("client_id", userId)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    if (plans?.length) {
      setActivePlan(plans[0]);
      const { data: coachData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", plans[0].coach_id)
        .single();
      if (coachData) setMyCoach(coachData);
    } else {
      setActivePlan(null);
    }

    const { data: appointments } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", userId)
      .gte("start_time", today)
      .order("start_time")
      .limit(3);
    setUpcomingAppointments(appointments || []);

    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, status, end_date, plan:membership_plans(name)")
      .eq("user_id", userId)
      .eq("status", "attivo")
      .order("end_date", { ascending: false })
      .limit(1);

    if (subs?.length) {
      setSubscription({
        id: subs[0].id,
        status: subs[0].status,
        end_date: subs[0].end_date,
        plan_name: (subs[0].plan as any)?.name || "Piano",
      });
    } else {
      setSubscription(null);
    }

    if (plans?.length) {
      const { data: planExercises } = await supabase
        .from("workout_plan_exercises")
        .select("id, sets")
        .eq("workout_plan_id", plans[0].id);

      if (planExercises?.length) {
        const totalExpectedSets = planExercises.reduce((sum, exercise) => sum + (exercise.sets || 3), 0);
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const { data: completions } = await supabase
          .from("workout_completions")
          .select("id")
          .eq("client_id", userId!)
          .in("workout_plan_exercise_id", planExercises.map((exercise) => exercise.id))
          .gte("completed_at", weekStart.toISOString());

        const completedSets = completions?.length || 0;
        setCompletedWorkouts(completedSets);
        setWeekProgress(Math.min(totalExpectedSets ? Math.round((completedSets / totalExpectedSets) * 100) : 0, 100));
      } else {
        setCompletedWorkouts(0);
        setWeekProgress(0);
      }
    } else {
      setCompletedWorkouts(0);
      setWeekProgress(0);
    }

    setLoading(false);
  };

  const planDays = activePlan ? differenceInDays(new Date(activePlan.end_date), new Date()) : 0;
  const subscriptionDays = subscription ? differenceInDays(new Date(subscription.end_date), new Date()) : 0;
  const nextAppointment = upcomingAppointments[0];

  return (
    <ClientLayout title="Oggi">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          <section className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Bentornato,</p>
              <h2 className="mt-1 font-display text-3xl tracking-wide">
                {profile?.first_name || "Atleta"}
              </h2>
            </div>
            {myCoach && (
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex">
                <User className="h-4 w-4 text-primary" />
                Coach {myCoach.first_name}
              </div>
            )}
          </section>

          <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-gradient-to-br from-primary/25 via-card to-card p-5 shadow-xl shadow-primary/5">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-primary">
                  <Sparkles className="h-4 w-4" />
                  Allenamento di oggi
                </span>
                {activePlan && (
                  <Badge className="rounded-full bg-background/70 text-foreground hover:bg-background/70">
                    {planDays > 0 ? `${planDays} giorni` : "In scadenza"}
                  </Badge>
                )}
              </div>

              <h3 className="max-w-lg font-display text-3xl leading-tight tracking-wide">
                {activePlan?.name || "La tua scheda sta arrivando"}
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {activePlan?.description || "Il coach sta preparando il tuo prossimo programma personalizzato."}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {activePlan ? (
                  <Button asChild className="h-12 rounded-2xl px-5 font-semibold">
                    <Link to="/coaching/scheda">
                      <Play className="mr-2 h-5 w-5 fill-current" />
                      Inizia allenamento
                    </Link>
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    In attesa della scheda
                  </div>
                )}
                <Button asChild variant="secondary" className="h-12 rounded-2xl px-5">
                  <Link to="/coaching/progressi">
                    Vedi progressi
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Link to="/coaching/progressi" className="rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="font-display text-2xl">{weekProgress}%</span>
              </div>
              <p className="mt-4 text-xs font-medium text-muted-foreground">Progresso settimanale</p>
              <Progress value={weekProgress} className="mt-3 h-1.5" />
            </Link>

            <Link to="/coaching/appuntamenti" className="rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]">
              <Calendar className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold leading-tight">{nextAppointment?.title || "Nessun appuntamento"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextAppointment
                  ? format(parseISO(nextAppointment.start_time), "d MMM · HH:mm", { locale: it })
                  : "Agenda libera"}
              </p>
            </Link>

            <div className="rounded-2xl border border-border bg-card p-4">
              <Dumbbell className="h-5 w-5 text-primary" />
              <p className="mt-4 font-display text-2xl">{completedWorkouts}</p>
              <p className="mt-1 text-xs text-muted-foreground">Serie completate</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <p className="mt-4 font-semibold leading-tight">{subscription?.plan_name || "Nessun piano"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {subscription ? (subscriptionDays > 0 ? `${subscriptionDays} giorni rimasti` : "Scaduto") : "Contatta la reception"}
              </p>
            </div>
          </div>

          <section className="rounded-[1.5rem] border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agenda</p>
                <h3 className="mt-1 font-display text-xl tracking-wide">Prossimi appuntamenti</h3>
              </div>
              <Link to="/coaching/appuntamenti" className="text-sm font-medium text-primary">Vedi tutti</Link>
            </div>

            {upcomingAppointments.length ? (
              <div className="space-y-2">
                {upcomingAppointments.map((appointment) => (
                  <Link
                    key={appointment.id}
                    to="/coaching/appuntamenti"
                    className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3.5"
                  >
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="text-[10px] font-semibold uppercase">
                        {format(parseISO(appointment.start_time), "MMM", { locale: it })}
                      </span>
                      <span className="font-display text-lg leading-none">
                        {format(parseISO(appointment.start_time), "d")}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{appointment.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(parseISO(appointment.start_time), "EEEE · HH:mm", { locale: it })}
                        {appointment.location ? ` · ${appointment.location}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-secondary/40 px-4 py-7 text-center text-sm text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-7 w-7 text-primary" />
                Nessun appuntamento in programma
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Link to="/coaching/documenti" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">Documenti</span>
                <span className="text-xs text-muted-foreground">File e comunicazioni del coach</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link to="/coaching/segnala" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">Serve aiuto?</span>
                <span className="text-xs text-muted-foreground">Invia una richiesta al coach</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </section>
        </div>
      )}
    </ClientLayout>
  );
};

export default CoachingDashboard;
