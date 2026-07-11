import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, isPast } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Clock, Dumbbell, Loader2, Pause } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineCache, setOfflineCache } from "@/lib/offlineSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WorkoutPlan {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  coach_notes: string | null;
  status?: string;
  plan_type?: string;
}

interface DayExercise {
  day_of_week: number;
  exercise_count: number;
  completed_count: number;
}

interface CachedPlanDays {
  activePlan: WorkoutPlan;
  dayExercises: DayExercise[];
}

const WorkoutPlanDays = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get("planId");
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (profile?.user_id) void fetchWorkoutPlan();
  }, [profile?.user_id, requestedPlanId]);

  const fetchWorkoutPlan = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    setDetailsOpen(false);
    const userId = profile.user_id;
    const cacheKey = `workout-plan-days:${userId}:${requestedPlanId || "active"}`;
    const cached = await getOfflineCache<CachedPlanDays>(cacheKey);

    if (cached) {
      setActivePlan(cached.value.activePlan);
      setDayExercises(cached.value.dayExercises);
      setFromCache(true);
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      let plans: WorkoutPlan[] | null = null;

      if (requestedPlanId) {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("client_id", userId)
          .eq("id", requestedPlanId)
          .is("deleted_at" as any, null)
          .limit(1);
        if (error) throw error;
        plans = data as WorkoutPlan[] | null;
      } else {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("client_id", userId)
          .is("deleted_at" as any, null)
          .lte("start_date", today)
          .gte("end_date", today)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        plans = data as WorkoutPlan[] | null;

        if (!plans?.length) {
          const { data: recent, error: recentError } = await supabase
            .from("workout_plans")
            .select("*")
            .eq("client_id", userId)
            .is("deleted_at" as any, null)
            .order("end_date", { ascending: false })
            .limit(1);
          if (recentError) throw recentError;
          plans = recent as WorkoutPlan[] | null;
        }
      }

      const selectedPlan = plans?.[0] || null;
      if (!selectedPlan) {
        if (!cached) {
          setActivePlan(null);
          setDayExercises([]);
        }
        return;
      }

      const { data: exercises, error: exerciseError } = await supabase
        .from("workout_plan_exercises")
        .select("id, day_of_week, order_index")
        .eq("workout_plan_id", selectedPlan.id)
        .order("order_index");
      if (exerciseError) throw exerciseError;

      const { data: completions, error: completionError } = exercises?.length
        ? await supabase
            .from("workout_completions")
            .select("workout_plan_exercise_id")
            .eq("client_id", userId)
            .in("workout_plan_exercise_id", exercises.map((exercise) => exercise.id))
        : { data: [], error: null };
      if (completionError) throw completionError;

      const completedSet = new Set((completions || []).map((completion) => completion.workout_plan_exercise_id));
      const dayMap = new Map<number, { total: number; done: number }>();
      (exercises || []).forEach((exercise) => {
        const day = exercise.day_of_week ?? 1;
        if (!dayMap.has(day)) dayMap.set(day, { total: 0, done: 0 });
        const item = dayMap.get(day)!;
        item.total += 1;
        if (completedSet.has(exercise.id)) item.done += 1;
      });

      const normalized = Array.from(dayMap.entries())
        .map(([day, values]) => ({ day_of_week: day, exercise_count: values.total, completed_count: values.done }))
        .sort((a, b) => a.day_of_week - b.day_of_week);

      setActivePlan(selectedPlan);
      setDayExercises(normalized);
      setFromCache(false);
      await setOfflineCache(cacheKey, { activePlan: selectedPlan, dayExercises: normalized });
    } catch {
      if (!cached) {
        setActivePlan(null);
        setDayExercises([]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !activePlan) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!activePlan) {
    return (
      <div className="py-20 text-center">
        <Dumbbell className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="font-display text-2xl">Nessuna scheda disponibile</h2>
        <p className="mt-2 text-sm text-muted-foreground">Collegati almeno una volta per scaricare la scheda sul dispositivo.</p>
      </div>
    );
  }

  const status = activePlan.status || "attiva";
  const expired = isPast(new Date(activePlan.end_date));
  const query = requestedPlanId ? `?planId=${requestedPlanId}` : "";
  const hasDetails = Boolean(activePlan.description || activePlan.coach_notes);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-primary">
          <Dumbbell className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            {activePlan.plan_type === "test" ? "Test in corso" : expired ? "Scheda archiviata" : "Scheda attiva"}
          </span>
          {fromCache && <Badge variant="outline">Disponibile offline</Badge>}
          {status === "in_pausa" && <Badge variant="secondary" className="gap-1 rounded-full"><Pause className="h-3 w-3" />In pausa</Badge>}
          {expired && <Badge variant="outline" className="gap-1 rounded-full text-muted-foreground"><Calendar className="h-3 w-3" />{format(new Date(activePlan.end_date), "d MMM yyyy", { locale: it })}</Badge>}
        </div>

        <h2 className="break-words font-display text-3xl tracking-wide">{activePlan.name}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{format(new Date(activePlan.start_date), "d MMM yyyy", { locale: it })} – {format(new Date(activePlan.end_date), "d MMM yyyy", { locale: it })}</p>

        {hasDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-3">
            {!detailsOpen && activePlan.description && <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{activePlan.description}</p>}
            <CollapsibleContent className="space-y-3 pt-1">
              {activePlan.description && <div className="rounded-2xl bg-secondary/35 p-4"><p className="mb-1 text-sm font-semibold">Indicazioni della scheda</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{activePlan.description}</p></div>}
              {activePlan.coach_notes && <div className="rounded-2xl border-l-2 border-primary bg-secondary/45 p-4"><p className="mb-1 text-sm font-semibold">Note del coach</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{activePlan.coach_notes}</p></div>}
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" data-testid="plan-details-toggle" className="mt-2 h-10 w-full justify-between rounded-xl px-3 text-sm text-primary">
                <span>{detailsOpen ? "Nascondi indicazioni" : "Mostra indicazioni complete"}</span>
                {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </section>

      {status === "in_pausa" && <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center"><Pause className="mx-auto mb-2 h-6 w-6 text-yellow-600" /><p className="font-medium text-yellow-700">La scheda è in pausa</p><p className="text-sm text-muted-foreground">Contatta il coach per riprenderla.</p></div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {dayExercises.map((day) => {
          const complete = day.completed_count >= day.exercise_count && day.exercise_count > 0;
          const progress = day.exercise_count > 0 ? Math.round((day.completed_count / day.exercise_count) * 100) : 0;
          return (
            <Link key={day.day_of_week} data-testid="workout-day-link" to={`/coaching/scheda/${day.day_of_week}${query}`} className="block">
              <Card className={`h-full rounded-2xl transition active:scale-[0.99] ${complete ? "border-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between"><span className="font-display text-4xl">{day.day_of_week}</span>{complete ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}</div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Giorno {day.day_of_week}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                  <p className="mt-2 text-xs text-muted-foreground">{day.completed_count}/{day.exercise_count} esercizi</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {!dayExercises.length && <div className="py-10 text-center"><Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">Nessun esercizio disponibile.</p></div>}
    </div>
  );
};

export default WorkoutPlanDays;
