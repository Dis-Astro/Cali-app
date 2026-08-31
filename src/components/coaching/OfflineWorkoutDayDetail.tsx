import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageSquare, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getOfflineCache,
  getPendingWorkoutCompletions,
  queueWorkoutCompletion,
  setOfflineCache,
} from "@/lib/offlineSync";
import {
  calculateCurrentWeek,
  calculateTotalWeeks,
  downloadWorkoutPlanForOffline,
  workoutDayCacheKey,
  type OfflineWorkoutDaySnapshot as CachedDay,
  type OfflineWorkoutExercise as Exercise,
} from "@/lib/offlineWorkout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import LightningRating from "./LightningRating";
import WorkoutTimerLauncher from "@/features/workout-timer/WorkoutTimerLauncher";
import ExerciseVideoRecorder from "./ExerciseVideoRecorder";

const OfflineWorkoutDayDetail = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get("planId");
  const { profile } = useAuth();
  const dayNumber = Number.parseInt(dayId || "1", 10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [plan, setPlan] = useState<CachedDay["plan"] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  const cacheKey = useMemo(
    () => workoutDayCacheKey(profile?.user_id || "anon", dayNumber, requestedPlanId),
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
    const weeks = calculateTotalWeeks(snapshot.plan.start_date, snapshot.plan.end_date);
    const current = Math.min(calculateCurrentWeek(snapshot.plan.start_date, snapshot.plan.end_date), weeks);
    setPlan(snapshot.plan);
    setCurrentWeek(current);
    setTotalWeeks(weeks);
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
      const downloaded = await downloadWorkoutPlanForOffline(userId, requestedPlanId);
      if (!downloaded) throw new Error("Nessuna scheda disponibile");
      const fresh = await getOfflineCache<CachedDay>(cacheKey);
      if (!fresh) throw new Error("Impossibile salvare la scheda sul dispositivo");
      await applySnapshot(fresh.value, false);
    } catch (error) {
      if (!cached) toast.error(error instanceof Error ? error.message : "Impossibile caricare la scheda");
    } finally {
      setLoading(false);
    }
  };

  const updateWeek = (exerciseId: string, weekNumber: number, field: "client_notes" | "difficulty_rating", value: string | number) => {
    setExercises((previous) => {
      const next = previous.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              weekCompletions: exercise.weekCompletions.map((week) =>
                week.week_number === weekNumber ? { ...week, [field]: value, saved: false, pending: false } : week,
              ),
            },
      );
      if (plan) void setOfflineCache(cacheKey, { plan, exercises: next, currentWeek, totalWeeks });
      return next;
    });
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

  const openEvaluationAfterTimer = (exercise: Exercise) => {
    const availableWeeks = exercise.weekCompletions.filter((week) => week.week_number <= currentWeek);
    const targetWeek = availableWeeks.find((week) => week.week_number === currentWeek && !week.saved)
      || [...availableWeeks].reverse().find((week) => !week.saved)
      || availableWeeks.find((week) => week.week_number === currentWeek)
      || availableWeeks[availableWeeks.length - 1];

    setOpenExercises((previous) => new Set(previous).add(exercise.id));
    if (!targetWeek) return;
    window.setTimeout(() => {
      document.getElementById(`evaluation-${exercise.id}-${targetWeek.week_number}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 180);
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
          const availableWeeks = exercise.weekCompletions
            .filter((week) => week.week_number <= currentWeek)
            .sort((first, second) => second.week_number - first.week_number);
          const missingPastWeeks = exercise.weekCompletions.filter(
            (week) => week.week_number < currentWeek && !week.saved,
          ).length;
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
                      {missingPastWeeks > 0 && <p className="mt-1 text-xs font-medium text-amber-500">{missingPastWeeks} {missingPastWeeks === 1 ? "settimana passata da compilare" : "settimane passate da compilare"}</p>}
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
                    {availableWeeks.map((week) =>
                        <div id={`evaluation-${exercise.id}-${week.week_number}`} key={week.week_number} className="scroll-mt-24 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="font-display text-xl">SETTIMANA {week.week_number}</span>
                            <div className="flex flex-wrap justify-end gap-2">
                              {week.week_number < currentWeek && !week.saved && <Badge variant="secondary">Da compilare</Badge>}
                              {week.week_number === currentWeek && !week.saved && <Badge variant="secondary">Corrente</Badge>}
                              {week.pending && <Badge variant="secondary">Da sincronizzare</Badge>}
                              {week.saved && !week.pending && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            </div>
                          </div>
                          <label className="mb-2 block text-sm text-muted-foreground">Valutazione dell’esercizio</label>
                          <LightningRating value={week.difficulty_rating} onChange={(value) => updateWeek(exercise.id, week.week_number, "difficulty_rating", value)} />
                          <Textarea value={week.client_notes} onChange={(event) => updateWeek(exercise.id, week.week_number, "client_notes", event.target.value)} placeholder="Aggiungi una nota per il coach..." className="my-3 min-h-24 resize-y" />
                          <Button className="w-full gap-2" disabled={saving === `${exercise.id}:${week.week_number}`} onClick={() => void saveWeek(exercise.id, week.week_number)}>{saving === `${exercise.id}:${week.week_number}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{week.saved ? "Aggiorna valutazione" : "Salva valutazione"}</Button>
                        </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
                <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 bg-card/80 px-3 py-2">
                  <ExerciseVideoRecorder exerciseName={exercise.exercise_name} />
                  <WorkoutTimerLauncher exerciseName={exercise.exercise_name} exerciseNotes={exercise.notes} onComplete={() => openEvaluationAfterTimer(exercise)} />
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
