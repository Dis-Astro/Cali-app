import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageSquare, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getOfflineCache,
  getPendingWorkoutCompletions,
  queueWorkoutCompletion,
  setOfflineCache,
} from "@/lib/offlineSync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import LightningRating from "./LightningRating";
import WorkoutTimerLauncher from "@/features/workout-timer/WorkoutTimerLauncher";

type Plan = { id: string; name: string; start_date: string; end_date: string };
type Video = { id: string; title: string; video_url: string };
type CoachNote = { id: string; note: string | null; rating: number | null; workout_plan_exercise_id: string };
type Week = { id?: string; week_number: number; client_notes: string; difficulty_rating: number; saved: boolean; pending?: boolean };
type Exercise = {
  id: string;
  notes: string | null;
  rest_seconds: number | null;
  order_index: number;
  exercise_name: string | null;
  video: Video | null;
  coachTestNote?: CoachNote;
  weekCompletions: Week[];
};
type CachedDay = { plan: Plan; exercises: Exercise[]; currentWeek: number; totalWeeks: number };

const calculateTotalWeeks = (startDate: string, endDate: string) =>
  Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 604800000));

const calculateCurrentWeek = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const reference = new Date() > end ? end : new Date();
  return Math.max(1, Math.floor((reference.getTime() - start.getTime()) / 604800000) + 1);
};

const OfflineWorkoutDayDetail = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get("planId");
  const { profile } = useAuth();
  const dayNumber = Number.parseInt(dayId || "1", 10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const cacheKey = useMemo(
    () => `workout-day:${profile?.user_id || "anon"}:${requestedPlanId || "active"}:${dayNumber}`,
    [profile?.user_id, requestedPlanId, dayNumber],
  );

  const backLink = requestedPlanId ? `/coaching/scheda?planId=${requestedPlanId}` : "/coaching/scheda";

  useEffect(() => {
    if (profile?.user_id) void loadDay();
  }, [profile?.user_id, requestedPlanId, dayNumber]);

  const mergePending = async (items: Exercise[]) => {
    if (!profile?.user_id) return items;
    const pending = await getPendingWorkoutCompletions(profile.user_id);
    return items.map((exercise) => ({
      ...exercise,
      weekCompletions: exercise.weekCompletions.map((week) => {
        const queued = pending.find(
          (operation) =>
            operation.payload.workoutPlanExerciseId === exercise.id &&
            operation.payload.weekNumber === week.week_number,
        );
        return queued
          ? {
              ...week,
              client_notes: queued.payload.clientNotes,
              difficulty_rating: queued.payload.difficultyRating,
              saved: true,
              pending: true,
            }
          : week;
      }),
    }));
  };

  const applySnapshot = async (snapshot: CachedDay, fromCache: boolean) => {
    setPlan(snapshot.plan);
    setCurrentWeek(snapshot.currentWeek);
    setTotalWeeks(snapshot.totalWeeks);
    setExercises(await mergePending(snapshot.exercises));
    setLoadedFromCache(fromCache);
  };

  const loadDay = async () => {
    setLoading(true);
    setOpenExercises(new Set());

    const cached = await getOfflineCache<CachedDay>(cacheKey);
    if (cached) await applySnapshot(cached.value, true);

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      const userId = profile!.user_id;
      const today = new Date().toISOString().split("T")[0];
      let selectedPlan: Plan | null = null;

      if (requestedPlanId) {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("id, name, start_date, end_date")
          .eq("client_id", userId)
          .eq("id", requestedPlanId)
          .is("deleted_at" as any, null)
          .maybeSingle();
        if (error) throw error;
        selectedPlan = data as Plan | null;
      } else {
        const { data, error } = await supabase
          .from("workout_plans")
          .select("id, name, start_date, end_date")
          .eq("client_id", userId)
          .is("deleted_at" as any, null)
          .lte("start_date", today)
          .gte("end_date", today)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        selectedPlan = (data?.[0] || null) as Plan | null;

        if (!selectedPlan) {
          const { data: recent, error: recentError } = await supabase
            .from("workout_plans")
            .select("id, name, start_date, end_date")
            .eq("client_id", userId)
            .is("deleted_at" as any, null)
            .order("end_date", { ascending: false })
            .limit(1);
          if (recentError) throw recentError;
          selectedPlan = (recent?.[0] || null) as Plan | null;
        }
      }

      if (!selectedPlan) throw new Error("Nessuna scheda disponibile");

      const weeks = calculateTotalWeeks(selectedPlan.start_date, selectedPlan.end_date);
      const current = Math.min(calculateCurrentWeek(selectedPlan.start_date, selectedPlan.end_date), weeks);
      const { data: planExercises, error: exerciseError } = await supabase
        .from("workout_plan_exercises")
        .select("id, notes, rest_seconds, order_index, exercise_name, video:exercise_videos(id, title, video_url)")
        .eq("workout_plan_id", selectedPlan.id)
        .eq("day_of_week", dayNumber)
        .order("order_index");
      if (exerciseError) throw exerciseError;

      const exerciseIds = (planExercises || []).map((exercise) => exercise.id);
      const [completionResult, coachResult] = exerciseIds.length
        ? await Promise.all([
            supabase.from("workout_completions").select("*").eq("client_id", userId).in("workout_plan_exercise_id", exerciseIds),
            supabase.from("coach_test_notes").select("*").in("workout_plan_exercise_id", exerciseIds),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];

      if (completionResult.error) throw completionResult.error;
      if (coachResult.error) throw coachResult.error;

      const completions = completionResult.data || [];
      const coachNotes = (coachResult.data || []) as CoachNote[];
      const normalized: Exercise[] = (planExercises || []).map((exercise) => {
        const weeksList: Week[] = [];
        for (let weekNumber = 1; weekNumber <= weeks; weekNumber += 1) {
          const existing = completions.find(
            (completion) =>
              completion.workout_plan_exercise_id === exercise.id &&
              completion.set_number === weekNumber,
          );
          weeksList.push({
            id: existing?.id,
            week_number: weekNumber,
            client_notes: existing?.client_notes || "",
            difficulty_rating: existing?.difficulty_rating || 0,
            saved: Boolean(existing),
          });
        }
        return {
          ...exercise,
          exercise_name: exercise.exercise_name || "Esercizio",
          video: exercise.video as unknown as Video | null,
          coachTestNote: coachNotes.find((note) => note.workout_plan_exercise_id === exercise.id),
          weekCompletions: weeksList,
        };
      });

      const snapshot: CachedDay = { plan: selectedPlan, exercises: normalized, currentWeek: current, totalWeeks: weeks };
      await setOfflineCache(cacheKey, snapshot);
      await applySnapshot(snapshot, false);
    } catch (error) {
      if (!cached) toast.error(error instanceof Error ? error.message : "Impossibile caricare la scheda");
    } finally {
      setLoading(false);
    }
  };

  const updateWeek = (exerciseId: string, weekNumber: number, field: "client_notes" | "difficulty_rating", value: string | number) => {
    setExercises((previous) => previous.map((exercise) =>
      exercise.id !== exerciseId
        ? exercise
        : {
            ...exercise,
            weekCompletions: exercise.weekCompletions.map((week) =>
              week.week_number === weekNumber ? { ...week, [field]: value, saved: false, pending: false } : week,
            ),
          },
    ));
  };

  const saveWeek = async (exerciseId: string, weekNumber: number) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const week = exercise?.weekCompletions.find((item) => item.week_number === weekNumber);
    if (!exercise || !week || !profile?.user_id) return;

    setSaving(`${exerciseId}:${weekNumber}`);
    try {
      const result = await queueWorkoutCompletion({
        id: week.id,
        clientId: profile.user_id,
        workoutPlanExerciseId: exerciseId,
        weekNumber,
        clientNotes: week.client_notes,
        difficultyRating: week.difficulty_rating,
      });

      setExercises((previous) => previous.map((item) =>
        item.id !== exerciseId
          ? item
          : {
              ...item,
              weekCompletions: item.weekCompletions.map((entry) =>
                entry.week_number === weekNumber
                  ? { ...entry, saved: true, pending: !result.synced }
                  : entry,
              ),
            },
      ));

      const nextSnapshot: CachedDay | null = plan
        ? { plan, currentWeek, totalWeeks, exercises: exercises.map((item) =>
            item.id !== exerciseId
              ? item
              : {
                  ...item,
                  weekCompletions: item.weekCompletions.map((entry) =>
                    entry.week_number === weekNumber ? { ...entry, saved: true, pending: !result.synced } : entry,
                  ),
                },
          ) }
        : null;
      if (nextSnapshot) await setOfflineCache(cacheKey, nextSnapshot);

      toast.success(result.synced ? "Valutazione sincronizzata" : "Salvata offline: sarà sincronizzata automaticamente");
    } catch {
      toast.error("Impossibile salvare la valutazione");
    } finally {
      setSaving(null);
    }
  };

  if (loading && !plan) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to={backLink}><Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl tracking-wide">GIORNO {dayNumber}</h1>
          <p className="truncate text-sm text-muted-foreground">{plan?.name} · Settimana {currentWeek} di {totalWeeks}</p>
        </div>
        {loadedFromCache && <Badge variant="outline">Cache offline</Badge>}
      </div>

      <div className="space-y-3">
        {exercises.map((exercise, index) => {
          const isOpen = openExercises.has(exercise.id);
          const completed = exercise.weekCompletions.filter((week) => week.saved).length;
          return (
            <Collapsible key={exercise.id} open={isOpen} onOpenChange={() => setOpenExercises((previous) => {
              const next = new Set(previous);
              if (next.has(exercise.id)) next.delete(exercise.id); else next.add(exercise.id);
              return next;
            })}>
              <Card className="overflow-hidden rounded-2xl">
                <CollapsibleTrigger asChild>
                  <button type="button" data-testid="exercise-toggle" className="flex w-full items-start gap-3 p-4 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-primary">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words font-semibold">{exercise.exercise_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{completed}/{totalWeeks} settimane valutate{exercise.rest_seconds ? ` · Recupero ${exercise.rest_seconds}s` : ""}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {exercise.video && <a href={exercise.video.video_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-xl border"><Play className="h-4 w-4" /></a>}
                      {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {exercise.notes && <div className="border-t bg-muted/40 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" />Nota del coach</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{exercise.notes}</p></div>}
                  {exercise.coachTestNote?.note && <div className="border-t border-orange-500/20 bg-orange-500/5 p-4"><p className="whitespace-pre-wrap break-words text-sm">{exercise.coachTestNote.note}</p></div>}
                  <CardContent className="space-y-3 p-4">
                    {exercise.weekCompletions.filter((week) => week.week_number >= currentWeek).map((week) =>
                      week.week_number > currentWeek ? (
                        <div key={week.week_number} className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Settimana {week.week_number} · Non disponibile</div>
                      ) : (
                        <div key={week.week_number} className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                          <div className="mb-3 flex items-center justify-between"><span className="font-display text-xl">SETTIMANA {week.week_number}</span><div className="flex gap-2">{week.pending && <Badge variant="secondary">Da sincronizzare</Badge>}{week.saved && !week.pending && <CheckCircle2 className="h-5 w-5 text-primary" />}</div></div>
                          <label className="mb-2 block text-sm text-muted-foreground">Valutazione dell’esercizio</label>
                          <LightningRating value={week.difficulty_rating} onChange={(value) => updateWeek(exercise.id, week.week_number, "difficulty_rating", value)} />
                          <Textarea value={week.client_notes} onChange={(event) => updateWeek(exercise.id, week.week_number, "client_notes", event.target.value)} placeholder="Aggiungi una nota per il coach..." className="my-3 min-h-24 resize-y" />
                          <Button className="w-full gap-2" disabled={saving === `${exercise.id}:${week.week_number}`} onClick={() => void saveWeek(exercise.id, week.week_number)}>{saving === `${exercise.id}:${week.week_number}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{week.saved ? "Aggiorna valutazione" : "Salva valutazione"}</Button>
                        </div>
                      ),
                    )}
                  </CardContent>
                </CollapsibleContent>
                <div className="flex justify-end border-t border-border/60 bg-card/80 px-3 py-2">
                  <WorkoutTimerLauncher exerciseName={exercise.exercise_name} exerciseNotes={exercise.notes} />
                </div>
              </Card>
            </Collapsible>
          );
        })}
        {!exercises.length && <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">Nessun esercizio disponibile offline per questo giorno</div>}
      </div>
    </div>
  );
};

export default OfflineWorkoutDayDetail;
