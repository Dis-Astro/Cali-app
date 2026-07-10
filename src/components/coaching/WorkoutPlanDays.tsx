import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, isPast } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, CheckCircle2, ChevronRight, Clock, Dumbbell, Loader2, Pause } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

const WorkoutPlanDays = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get("planId");
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);

  useEffect(() => {
    if (profile?.user_id) fetchWorkoutPlan();
  }, [profile?.user_id, requestedPlanId]);

  const fetchWorkoutPlan = async () => {
    setLoading(true);
    const userId = profile?.user_id;
    const today = new Date().toISOString().split("T")[0];
    let plans: WorkoutPlan[] | null = null;

    if (requestedPlanId) {
      const { data } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("client_id", userId)
        .eq("id", requestedPlanId)
        .is("deleted_at" as any, null)
        .limit(1);
      plans = data as WorkoutPlan[] | null;
    } else {
      const { data } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("client_id", userId)
        .is("deleted_at" as any, null)
        .lte("start_date", today)
        .gte("end_date", today)
        .order("created_at", { ascending: false })
        .limit(1);
      plans = data as WorkoutPlan[] | null;

      if (!plans?.length) {
        const { data: recent } = await supabase
          .from("workout_plans")
          .select("*")
          .eq("client_id", userId)
          .is("deleted_at" as any, null)
          .order("end_date", { ascending: false })
          .limit(1);
        plans = recent as WorkoutPlan[] | null;
      }
    }

    const selectedPlan = plans?.[0] || null;
    setActivePlan(selectedPlan);

    if (selectedPlan) {
      const { data: exercises } = await supabase
        .from("workout_plan_exercises")
        .select("id, day_of_week, order_index")
        .eq("workout_plan_id", selectedPlan.id)
        .order("order_index");

      if (exercises?.length) {
        const { data: completions } = await supabase
          .from("workout_completions")
          .select("workout_plan_exercise_id")
          .eq("client_id", userId!)
          .in("workout_plan_exercise_id", exercises.map((exercise) => exercise.id));

        const completedSet = new Set((completions || []).map((completion) => completion.workout_plan_exercise_id));
        const dayMap = new Map<number, { total: number; done: number }>();

        exercises.forEach((exercise) => {
          const day = exercise.day_of_week ?? 1;
          if (!dayMap.has(day)) dayMap.set(day, { total: 0, done: 0 });
          const item = dayMap.get(day)!;
          item.total += 1;
          if (completedSet.has(exercise.id)) item.done += 1;
        });

        setDayExercises(
          Array.from(dayMap.entries())
            .map(([day, values]) => ({
              day_of_week: day,
              exercise_count: values.total,
              completed_count: values.done,
            }))
            .sort((a, b) => a.day_of_week - b.day_of_week),
        );
      } else {
        setDayExercises([]);
      }
    } else {
      setDayExercises([]);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="py-20 text-center">
        <Dumbbell className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="font-display text-2xl">Nessuna scheda</h2>
        <p className="mt-2 text-sm text-muted-foreground">Attendi la scheda personalizzata dal coach.</p>
      </div>
    );
  }

  const status = activePlan.status || "attiva";
  const isExpired = isPast(new Date(activePlan.end_date));
  const query = requestedPlanId ? `?planId=${requestedPlanId}` : "";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-primary">
          <Dumbbell className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            {activePlan.plan_type === "test" ? "Test in corso" : isExpired ? "Scheda archiviata" : "Scheda attiva"}
          </span>
          {status === "in_pausa" && (
            <Badge variant="secondary" className="gap-1 rounded-full">
              <Pause className="h-3 w-3" /> In pausa
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="gap-1 rounded-full text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {format(new Date(activePlan.end_date), "d MMM yyyy", { locale: it })}
            </Badge>
          )}
        </div>

        <h2 className="break-words font-display text-3xl tracking-wide">{activePlan.name}</h2>
        {activePlan.description && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {activePlan.description}
          </p>
        )}
        {activePlan.coach_notes && (
          <div className="mt-4 rounded-2xl border-l-2 border-primary bg-secondary/45 p-4">
            <p className="mb-1 text-sm font-semibold">Note del coach</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {activePlan.coach_notes}
            </p>
          </div>
        )}
      </section>

      {status === "in_pausa" && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
          <Pause className="mx-auto mb-2 h-6 w-6 text-yellow-600" />
          <p className="font-medium text-yellow-700">La scheda è in pausa</p>
          <p className="text-sm text-muted-foreground">Contatta il coach per riprenderla.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {dayExercises.map((day) => {
          const complete = day.completed_count >= day.exercise_count && day.exercise_count > 0;
          const progress = day.exercise_count > 0 ? Math.round((day.completed_count / day.exercise_count) * 100) : 0;

          return (
            <Link key={day.day_of_week} to={`/coaching/scheda/${day.day_of_week}${query}`} className="block">
              <Card className={`h-full rounded-2xl transition active:scale-[0.99] ${complete ? "border-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-4xl">{day.day_of_week}</span>
                    {complete ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Giorno {day.day_of_week}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{day.completed_count}/{day.exercise_count} esercizi</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {dayExercises.length === 0 && (
        <div className="py-10 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nessun esercizio programmato.</p>
        </div>
      )}
    </div>
  );
};

export default WorkoutPlanDays;
