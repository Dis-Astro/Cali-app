import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Dumbbell, CheckCircle2, Clock, ChevronRight, Pause, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isPast } from "date-fns";
import { it } from "date-fns/locale";

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
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [dayExercises, setDayExercises] = useState<DayExercise[]>([]);

  useEffect(() => {
    if (profile?.user_id) fetchWorkoutPlan();
  }, [profile?.user_id]);

  const fetchWorkoutPlan = async () => {
    setLoading(true);
    const userId = profile?.user_id;

    // Le schede restano SEMPRE accessibili: prendi la più recente non eliminata
    // (anche se scaduta o conclusa). Priorità: prima quella attiva nel range, poi qualunque ultima.
    const today = new Date().toISOString().split("T")[0];

    // 1) prova scheda attiva nel range (include sia "workout_plan" sia "test")
    let { data: plans } = await supabase
      .from("workout_plans")
      .select("*")
      .eq("client_id", userId)
      .is("deleted_at" as any, null)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    // 2) fallback: la più recente in assoluto (anche scaduta)
    if (!plans || plans.length === 0) {
      const { data: recent } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("client_id", userId)
        .is("deleted_at" as any, null)
        .order("end_date", { ascending: false })
        .limit(1);
      plans = recent;
    }

    if (plans && plans.length > 0) {
      setActivePlan(plans[0] as any);

      const { data: exercises } = await supabase
        .from("workout_plan_exercises")
        .select("id, day_of_week, order_index")
        .eq("workout_plan_id", plans[0].id)
        .order("order_index");

      if (exercises) {
        const exerciseIds = exercises.map((e) => e.id);
        const { data: completions } = await supabase
          .from("workout_completions")
          .select("workout_plan_exercise_id")
          .eq("client_id", userId!)
          .in("workout_plan_exercise_id", exerciseIds);

        const completedSet = new Set(
          (completions || []).map((c) => c.workout_plan_exercise_id)
        );

        const dayMap = new Map<number, { total: number; done: number }>();
        exercises.forEach((ex) => {
          const day = ex.day_of_week ?? 1;
          if (!dayMap.has(day)) dayMap.set(day, { total: 0, done: 0 });
          const d = dayMap.get(day)!;
          d.total += 1;
          if (completedSet.has(ex.id)) d.done += 1;
        });

        setDayExercises(
          Array.from(dayMap.entries())
            .map(([day, data]) => ({
              day_of_week: day,
              exercise_count: data.total,
              completed_count: data.done,
            }))
            .sort((a, b) => a.day_of_week - b.day_of_week)
        );
      }
    }

    setLoading(false);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  if (!activePlan) {
    return (
      <div className="text-center py-20">
        <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
        <h2 className="font-display text-2xl mb-2">Nessuna Scheda</h2>
        <p className="text-muted-foreground">Attendi la tua scheda personalizzata dal coach</p>
      </div>
    );
  }

  const status = (activePlan as any).status || "attiva";
  const isExpired = isPast(new Date(activePlan.end_date));

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-card via-card to-primary/5 rounded-lg p-6 border border-border">
        <div className="flex items-center gap-2 text-primary mb-2 flex-wrap">
          <Dumbbell className="w-5 h-5" />
          <span className="text-sm font-medium tracking-wider uppercase">
            {(activePlan as any).plan_type === "test"
              ? "Test in corso"
              : isExpired
              ? "Ultima Scheda"
              : "Scheda Attiva"}
          </span>
          {(activePlan as any).plan_type === "test" && (
            <Badge variant="outline" className="ml-2 border-orange-500/40 text-orange-600 dark:text-orange-400">
              🧪 TEST
            </Badge>
          )}
          {status === "in_pausa" && (
            <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30 ml-2">
              <Pause className="w-3 h-3" /> In Pausa
            </Badge>
          )}
          {isExpired && (
            <Badge variant="outline" className="gap-1 ml-2 text-muted-foreground border-muted-foreground/30">
              <Calendar className="w-3 h-3" />
              Scaduta il {format(new Date(activePlan.end_date), "dd MMM yyyy", { locale: it })}
            </Badge>
          )}
        </div>
        <h2 className="font-display text-3xl tracking-wider mb-2">{activePlan.name}</h2>
        {activePlan.description && <p className="text-muted-foreground">{activePlan.description}</p>}
        {activePlan.coach_notes && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg border-l-2 border-primary">
            <p className="text-sm font-medium mb-1">Note del Coach:</p>
            <p className="text-sm text-muted-foreground">{activePlan.coach_notes}</p>
          </div>
        )}
        {isExpired && (
          <p className="mt-3 text-xs text-muted-foreground italic">
            La scheda è scaduta ma resta consultabile. Puoi continuare a vedere gli esercizi e i tuoi commenti.
          </p>
        )}
      </div>

      {status === "in_pausa" && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center">
          <Pause className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
          <p className="font-medium text-yellow-700">La tua scheda è in pausa</p>
          <p className="text-sm text-muted-foreground">Contatta il tuo coach per riprenderla</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dayExercises.map((day) => {
          const isComplete = day.completed_count >= day.exercise_count && day.exercise_count > 0;
          const progress = day.exercise_count > 0 ? Math.round((day.completed_count / day.exercise_count) * 100) : 0;

          return (
            <Link key={day.day_of_week} to={`/coaching/scheda/${day.day_of_week}`}>
              <Card className={`relative overflow-hidden transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 ${isComplete ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-display text-4xl">{day.day_of_week}</span>
                    {isComplete ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-display tracking-wider text-muted-foreground mb-3">DAY {day.day_of_week}</p>

                  <div className="mt-auto">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {day.completed_count}/{day.exercise_count} esercizi
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {dayExercises.length === 0 && (
        <div className="text-center py-10">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nessun esercizio programmato in questa scheda</p>
        </div>
      )}
    </div>
  );
};

export default WorkoutPlanDays;
