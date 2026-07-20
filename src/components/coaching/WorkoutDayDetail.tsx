import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageSquare, Play, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import WorkoutTimerLauncher from "@/features/workout-timer/WorkoutTimerLauncher";
import LightningRating from "./LightningRating";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316",
  azzurro: "#38bdf8",
  verde: "#22c55e",
  giallo: "#eab308",
  rosso: "#ef4444",
  blu: "#3b82f6",
  viola: "#a855f7",
};

function renderColoredText(value: string) {
  const lines = value.split(/(\n)/);
  return lines.map((line, lineIndex) => {
    if (line === "\n") return <br key={`br-${lineIndex}`} />;
    return line.split(/(\s+)/).map((token, tokenIndex) => {
      const color = COLOR_MAP[token.toLowerCase().replace(/[^a-zàèéìòù]/gi, "")];
      if (color) {
        return (
          <span key={`${lineIndex}-${tokenIndex}`} style={{ color, fontWeight: 700 }}>
            {token}
          </span>
        );
      }
      return <span key={`${lineIndex}-${tokenIndex}`}>{token}</span>;
    });
  });
}

interface ExerciseVideo {
  id: string;
  title: string;
  video_url: string;
}

interface CoachTestNote {
  id: string;
  note: string | null;
  rating: number | null;
  workout_plan_exercise_id: string;
}

interface WorkoutPlanExercise {
  id: string;
  notes: string | null;
  rest_seconds: number | null;
  order_index: number;
  exercise_name: string | null;
  video: ExerciseVideo | null;
}

interface WeekCompletion {
  id?: string;
  week_number: number;
  client_notes: string;
  difficulty_rating: number;
  saved: boolean;
}

interface ExerciseWithWeeks extends WorkoutPlanExercise {
  weekCompletions: WeekCompletion[];
  coachTestNote?: CoachTestNote;
}

interface WorkoutPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

const WorkoutDayDetail = () => {
  const { dayId } = useParams<{ dayId: string }>();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get("planId");
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithWeeks[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());

  const dayNumber = Number.parseInt(dayId || "1", 10);
  const backLink = requestedPlanId ? `/coaching/scheda?planId=${requestedPlanId}` : "/coaching/scheda";

  const calculateCurrentWeek = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    const reference = today > end ? end : today;
    const diffDays = Math.floor((reference.getTime() - start.getTime()) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  };

  const calculateTotalWeeks = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, Math.ceil(diffDays / 7));
  };

  useEffect(() => {
    if (profile?.user_id) fetchDayExercises();
  }, [profile?.user_id, dayId, requestedPlanId]);

  const fetchDayExercises = async () => {
    setLoading(true);
    setOpenExercises(new Set());
    const userId = profile?.user_id;
    const today = new Date().toISOString().split("T")[0];
    let plans: WorkoutPlan[] | null = null;

    if (requestedPlanId) {
      const { data } = await supabase
        .from("workout_plans")
        .select("id, name, start_date, end_date")
        .eq("client_id", userId)
        .eq("id", requestedPlanId)
        .is("deleted_at" as any, null)
        .limit(1);
      plans = data as WorkoutPlan[] | null;
    } else {
      const { data } = await supabase
        .from("workout_plans")
        .select("id, name, start_date, end_date")
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
          .select("id, name, start_date, end_date")
          .eq("client_id", userId)
          .is("deleted_at" as any, null)
          .order("end_date", { ascending: false })
          .limit(1);
        plans = recent as WorkoutPlan[] | null;
      }
    }

    if (!plans?.length) {
      setPlan(null);
      setExercises([]);
      setLoading(false);
      return;
    }

    const selectedPlan = plans[0];
    setPlan(selectedPlan);

    const weeks = calculateTotalWeeks(selectedPlan.start_date, selectedPlan.end_date);
    const current = Math.min(calculateCurrentWeek(selectedPlan.start_date, selectedPlan.end_date), weeks);
    setTotalWeeks(weeks);
    setCurrentWeek(current);

    const { data: planExercises } = await supabase
      .from("workout_plan_exercises")
      .select("id, notes, rest_seconds, order_index, exercise_name, video:exercise_videos(id, title, video_url)")
      .eq("workout_plan_id", selectedPlan.id)
      .eq("day_of_week", dayNumber)
      .order("order_index");

    if (!planExercises?.length) {
      setExercises([]);
      setLoading(false);
      return;
    }

    const exerciseIds = planExercises.map((exercise) => exercise.id);
    const [completionsRes, testNotesRes] = await Promise.all([
      supabase
        .from("workout_completions")
        .select("*")
        .eq("client_id", userId!)
        .in("workout_plan_exercise_id", exerciseIds),
      supabase
        .from("coach_test_notes")
        .select("*")
        .in("workout_plan_exercise_id", exerciseIds),
    ]);

    const completions = completionsRes.data || [];
    const testNotes = (testNotesRes.data || []) as CoachTestNote[];

    setExercises(
      planExercises.map((exercise) => {
        const existingCompletions = completions.filter(
          (completion) => completion.workout_plan_exercise_id === exercise.id,
        );
        const weekCompletions: WeekCompletion[] = [];

        for (let weekNumber = 1; weekNumber <= weeks; weekNumber += 1) {
          const existing = existingCompletions.find((completion) => completion.set_number === weekNumber);
          weekCompletions.push({
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
          video: exercise.video as unknown as ExerciseVideo | null,
          weekCompletions,
          coachTestNote: testNotes.find((note) => note.workout_plan_exercise_id === exercise.id),
        };
      }),
    );

    setLoading(false);
  };

  const toggleExercise = (exerciseId: string) => {
    setOpenExercises((previous) => {
      const next = new Set(previous);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const updateWeekCompletion = (
    exerciseId: string,
    weekNumber: number,
    field: "client_notes" | "difficulty_rating",
    value: string | number,
  ) => {
    setExercises((previous) =>
      previous.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              weekCompletions: exercise.weekCompletions.map((week) =>
                week.week_number !== weekNumber ? week : { ...week, [field]: value, saved: false },
              ),
            },
      ),
    );
  };

  const saveWeekCompletion = async (exerciseId: string, weekNumber: number) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const weekData = exercise?.weekCompletions.find((week) => week.week_number === weekNumber);
    if (!exercise || !weekData || !profile?.user_id) return;

    setSaving(`${exerciseId}-${weekNumber}`);

    try {
      if (weekData.id) {
        const { error } = await supabase
          .from("workout_completions")
          .update({
            client_notes: weekData.client_notes,
            difficulty_rating: weekData.difficulty_rating,
          })
          .eq("id", weekData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("workout_completions")
          .insert({
            workout_plan_exercise_id: exerciseId,
            client_id: profile.user_id,
            set_number: weekNumber,
            client_notes: weekData.client_notes,
            difficulty_rating: weekData.difficulty_rating,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) weekData.id = data.id;
      }

      setExercises((previous) =>
        previous.map((item) =>
          item.id !== exerciseId
            ? item
            : {
                ...item,
                weekCompletions: item.weekCompletions.map((week) =>
                  week.week_number !== weekNumber ? week : { ...week, id: weekData.id, saved: true },
                ),
              },
        ),
      );
      toast.success("Valutazione salvata");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(null);
    }
  };

  const getExerciseCompletionStatus = (exercise: ExerciseWithWeeks) => {
    const completed = exercise.weekCompletions.filter((week) => week.saved).length;
    const total = exercise.weekCompletions.length;
    return { completed, total, isComplete: completed === total };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link to={backLink}>
          <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Torna alla scheda">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-3xl tracking-wide">GIORNO {dayNumber}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {plan?.name} · Settimana {currentWeek} di {totalWeeks}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((exercise, index) => {
          const status = getExerciseCompletionStatus(exercise);
          const isOpen = openExercises.has(exercise.id);

          return (
            <Collapsible key={exercise.id} open={isOpen} onOpenChange={() => toggleExercise(exercise.id)}>
              <Card className="overflow-hidden rounded-2xl border-border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    data-testid="exercise-toggle"
                    className="flex w-full items-start gap-3 bg-gradient-to-r from-card to-muted/30 p-4 text-left transition active:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="font-display text-lg text-primary">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      {status.isComplete && (
                        <Badge className="mb-1 gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Completato
                        </Badge>
                      )}
                      <p className="whitespace-pre-wrap break-words text-base font-semibold leading-snug">
                        {exercise.exercise_name ? renderColoredText(exercise.exercise_name) : "Esercizio"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {status.completed}/{status.total} settimane valutate
                        {exercise.rest_seconds ? ` · Recupero ${exercise.rest_seconds}s` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-1">
                      {exercise.video && (
                        <a
                          href={exercise.video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-primary"
                          aria-label="Apri video esercizio"
                        >
                          <Play className="h-4 w-4 fill-current" />
                        </a>
                      )}
                      {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {exercise.notes && (
                    <div className="border-t border-border bg-muted/40 px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <MessageSquare className="h-4 w-4 text-primary" /> Nota del coach
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                        {renderColoredText(exercise.notes)}
                      </p>
                    </div>
                  )}

                  {exercise.coachTestNote && (exercise.coachTestNote.note || exercise.coachTestNote.rating) && (
                    <div className="border-t border-orange-500/20 bg-orange-500/5 px-4 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-orange-500">
                        <span>⚡</span> Correzione test
                        {exercise.coachTestNote.rating && (
                          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs">
                            {exercise.coachTestNote.rating}/10
                          </span>
                        )}
                      </div>
                      {exercise.coachTestNote.note && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                          {exercise.coachTestNote.note}
                        </p>
                      )}
                    </div>
                  )}

                  <CardContent className="space-y-3 p-4">
                    {(() => {
                      const ratedWeeks = exercise.weekCompletions
                        .filter((week) => week.saved || week.client_notes || week.difficulty_rating > 0)
                        .filter((week) => !(week.week_number === currentWeek && !week.saved))
                        .sort((a, b) => a.week_number - b.week_number);

                      if (!ratedWeeks.length) return null;

                      return (
                        <div className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-muted/20">
                          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Storico settimane
                          </div>
                          {ratedWeeks.map((week) => (
                            <div key={week.week_number} className="flex items-start gap-3 px-3 py-3">
                              <span className="min-w-[3rem] text-xs font-semibold text-primary">Sett. {week.week_number}</span>
                              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                                {week.client_notes || <span className="italic text-muted-foreground">Nessuna nota</span>}
                              </p>
                              {week.difficulty_rating > 0 && (
                                <Badge variant="outline" className="shrink-0">⚡ {week.difficulty_rating}/10</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {exercise.weekCompletions
                      .filter((week) => week.week_number >= currentWeek)
                      .map((week) => {
                        const isCurrentWeek = week.week_number === currentWeek;
                        const isFutureWeek = week.week_number > currentWeek;

                        if (isFutureWeek) {
                          return (
                            <div key={week.week_number} className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-muted/10 p-3 opacity-60">
                              <span className="text-sm font-semibold text-muted-foreground">Settimana {week.week_number}</span>
                              <span className="text-xs italic text-muted-foreground">Non disponibile</span>
                            </div>
                          );
                        }

                        return (
                          <div key={week.week_number} className={`rounded-2xl border p-4 ${week.saved ? "border-primary/30 bg-primary/5" : "border-primary/30 bg-primary/5"}`}>
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-xl">SETTIMANA {week.week_number}</span>
                                {isCurrentWeek && !week.saved && <Badge variant="secondary">Corrente</Badge>}
                                {week.saved && <Badge>Salvata</Badge>}
                              </div>
                              {week.saved && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                            </div>

                            <div className="mb-4">
                              <label className="mb-2 block text-sm text-muted-foreground">Valutazione dell’esercizio</label>
                              <LightningRating
                                value={week.difficulty_rating}
                                onChange={(value) => updateWeekCompletion(exercise.id, week.week_number, "difficulty_rating", value)}
                              />
                            </div>

                            <Textarea
                              placeholder="Aggiungi una nota per il coach..."
                              value={week.client_notes}
                              onChange={(event) => updateWeekCompletion(exercise.id, week.week_number, "client_notes", event.target.value)}
                              className="mb-3 min-h-24 resize-y rounded-xl"
                            />

                            <Button
                              onClick={() => saveWeekCompletion(exercise.id, week.week_number)}
                              disabled={saving === `${exercise.id}-${week.week_number}`}
                              className="h-11 w-full gap-2 rounded-xl"
                            >
                              {saving === `${exercise.id}-${week.week_number}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              {week.saved ? "Aggiorna valutazione" : "Salva valutazione"}
                            </Button>
                          </div>
                        );
                      })}
                  </CardContent>
                </CollapsibleContent>
                <div className="flex justify-end border-t border-border/60 bg-card/80 px-3 py-2">
                  <WorkoutTimerLauncher exerciseName={exercise.exercise_name} />
                </div>
              </Card>
            </Collapsible>
          );
        })}

        {!exercises.length && (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            Nessun esercizio per questo giorno
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutDayDetail;
