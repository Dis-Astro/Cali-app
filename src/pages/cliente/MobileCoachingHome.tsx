import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, Clock, CreditCard, Dumbbell, Play, TrendingUp, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import ClientLayout from "@/components/coaching/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Plan = { id: string; name: string; description: string | null; end_date: string; coach_id: string };
type Appointment = { id: string; title: string; start_time: string; location: string | null };
type Subscription = { end_date: string; plan_name: string };
type HomeSnapshot = {
  plan: Plan | null;
  appointment: Appointment | null;
  subscription: Subscription | null;
  coachName: string;
  progress: number;
};

const EMPTY_HOME: HomeSnapshot = {
  plan: null,
  appointment: null,
  subscription: null,
  coachName: "Non assegnato",
  progress: 0,
};

const MobileCoachingHome = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<HomeSnapshot>(EMPTY_HOME);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile?.user_id) return;
      setLoading(true);
      const cacheKey = `coaching-home:${profile.user_id}`;
      const cached = await getOfflineCache<HomeSnapshot>(cacheKey);

      if (cached) {
        setSnapshot(cached.value);
        setFromCache(true);
      }

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      try {
        const now = new Date().toISOString();
        const next: HomeSnapshot = { ...EMPTY_HOME };

        const { data: plans, error: planError } = await supabase
          .from("workout_plans")
          .select("id, name, description, end_date, coach_id")
          .eq("client_id", profile.user_id)
          .is("deleted_at" as any, null)
          .lte("start_date", now)
          .gte("end_date", now)
          .order("created_at", { ascending: false })
          .limit(1);
        if (planError) throw planError;

        next.plan = (plans?.[0] || null) as Plan | null;

        if (next.plan) {
          const { data: coach, error: coachError } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", next.plan.coach_id)
            .maybeSingle();
          if (coachError) throw coachError;
          if (coach) next.coachName = `${coach.first_name} ${coach.last_name}`;

          const { data: exercises, error: exerciseError } = await supabase
            .from("workout_plan_exercises")
            .select("id")
            .eq("workout_plan_id", next.plan.id);
          if (exerciseError) throw exerciseError;

          if (exercises?.length) {
            const { data: done, error: doneError } = await supabase
              .from("workout_completions")
              .select("workout_plan_exercise_id")
              .eq("client_id", profile.user_id)
              .in("workout_plan_exercise_id", exercises.map((exercise) => exercise.id));
            if (doneError) throw doneError;
            const completed = new Set((done || []).map((item) => item.workout_plan_exercise_id)).size;
            next.progress = Math.min(100, Math.round((completed / exercises.length) * 100));
          }
        }

        const { data: appointments, error: appointmentError } = await supabase
          .from("appointments")
          .select("id, title, start_time, location")
          .eq("client_id", profile.user_id)
          .gte("start_time", now)
          .order("start_time")
          .limit(1);
        if (appointmentError) throw appointmentError;
        next.appointment = (appointments?.[0] || null) as Appointment | null;

        const { data: subscriptions, error: subscriptionError } = await supabase
          .from("subscriptions")
          .select("end_date, plan:membership_plans(name)")
          .eq("user_id", profile.user_id)
          .eq("status", "attivo")
          .order("end_date", { ascending: false })
          .limit(1);
        if (subscriptionError) throw subscriptionError;

        if (subscriptions?.[0]) {
          next.subscription = {
            end_date: subscriptions[0].end_date,
            plan_name: (subscriptions[0].plan as any)?.name || "Abbonamento",
          };
        }

        setSnapshot(next);
        setFromCache(false);
        await setOfflineCache(cacheKey, next);
      } catch {
        if (!cached) setSnapshot(EMPTY_HOME);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [profile?.user_id]);

  const { plan, appointment, subscription, coachName, progress } = snapshot;
  const planDays = plan ? differenceInDays(new Date(plan.end_date), new Date()) : null;
  const subscriptionDays = subscription ? differenceInDays(new Date(subscription.end_date), new Date()) : null;

  return (
    <ClientLayout title="HOME">
      {loading && !fromCache ? (
        <div className="grid min-h-[60vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">Ciao {profile?.first_name || "atleta"}</p>
              {fromCache && <Badge variant="outline">Dati offline</Badge>}
            </div>
            <h2 className="mt-1 font-display text-3xl tracking-wide">IL TUO PERCORSO</h2>
          </section>

          <Card className="rounded-3xl border-primary/25 bg-gradient-to-br from-primary/15 via-card to-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Scheda attiva</p>
                  <h3 className="mt-2 break-words font-display text-3xl tracking-wide">{plan?.name || "In preparazione"}</h3>
                  {plan?.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>}
                </div>
                {planDays !== null && <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs">{planDays > 0 ? `${planDays} gg` : "Scaduta"}</span>}
              </div>
              <Link to="/coaching/scheda" className="mt-5 block"><Button className="h-12 w-full gap-2 rounded-2xl font-semibold"><Play className="h-5 w-5 fill-current" />Vedi scheda</Button></Link>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="rounded-2xl"><CardContent className="p-4"><div className="flex items-center justify-between"><TrendingUp className="h-5 w-5 text-primary" /><span className="font-display text-2xl">{progress}%</span></div><p className="mt-3 text-xs text-muted-foreground">Progresso scheda</p><Progress value={progress} className="mt-2 h-1.5" /></CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><User className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Il tuo coach</p><p className="mt-1 break-words text-sm font-medium">{coachName}</p></CardContent></Card>
          </div>

          <Card className="rounded-3xl"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><h3 className="font-display text-xl tracking-wide">PROSSIMO APPUNTAMENTO</h3></div><Link to="/coaching/appuntamenti" className="text-xs font-semibold text-primary">TUTTI</Link></div>{appointment ? <div className="rounded-2xl bg-secondary/55 p-4"><p className="break-words font-semibold">{appointment.title}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /><span>{format(parseISO(appointment.start_time), "d MMMM, HH:mm", { locale: it })}</span>{appointment.location && <span>· {appointment.location}</span>}</div></div> : <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nessun appuntamento</p>}</CardContent></Card>

          <Card className="rounded-3xl"><CardContent className="flex items-center gap-4 p-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Abbonamento</p><p className="break-words font-medium">{subscription?.plan_name || "Non disponibile"}</p></div>{subscriptionDays !== null && <span className="shrink-0 text-xs text-muted-foreground">{subscriptionDays > 0 ? `${subscriptionDays} gg` : "Scaduto"}</span>}</CardContent></Card>

          <Link to="/coaching/scheda" className="block"><Button variant="secondary" className="h-12 w-full gap-2 rounded-2xl"><Dumbbell className="h-4 w-4" />Apri allenamento</Button></Link>
        </div>
      )}
    </ClientLayout>
  );
};

export default MobileCoachingHome;
