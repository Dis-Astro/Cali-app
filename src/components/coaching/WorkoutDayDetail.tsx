import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Loader2, ArrowLeft, Play, MessageSquare,
  CheckCircle2, Save, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import LightningRating from "./LightningRating";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316",
  azzurro:   "#38bdf8",
  verde:     "#22c55e",
  giallo:    "#eab308",
  rosso:     "#ef4444",
  blu:       "#3b82f6",
  viola:     "#a855f7",
};

function renderColoredText(value: string) {
  const lines = value.split(/(\n)/);
  return lines.map((line, lineIdx) => {
    if (line === "\n") return <br key={`br-${lineIdx}`} />;
    const tokens = line.split(/(\s+)/);
    return tokens.map((token, i) => {
      const color = COLOR_MAP[token.toLowerCase().replace(/[^a-zàèéìòù]/gi, "")];
      if (color) return <span key={`${lineIdx}-${i}`} style={{ color, fontWeight: 700 }}>{token}</span>;
      return <span key={`${lineIdx}-${i}`}>{token}</span>;
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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithWeeks[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(1);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());

  const dayNumber = parseInt(dayId || "1");

  const calculateCurrentWeek = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    // Se la scheda è scaduta, sblocca tutte le settimane (corrente = totale)
    const reference = today > end ? end : today;
    const diffDays = Math.floor((reference.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  };

  const calculateTotalWeeks = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.ceil(diffDays / 7));
  };

  useEffect(() => {
    if (profile?.user_id) fetchDayExercises();
  }, [profile?.user_id, dayId]);

  const fetchDayExercises = async () => {
    setLoading(true);
    const userId = profile?.user_id;
    const today = new Date().toISOString().split('T')[0];

    // Le schede sono SEMPRE accessibili, anche dopo la scadenza.
    // 1) prova con scheda attiva nel range (include sia "workout_plan" sia "test")
    let { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name, start_date, end_date")
      .eq("client_id", userId)
      .is("deleted_at" as any, null)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    // 2) fallback: la scheda più recente (anche scaduta)
    if (!plans || plans.length === 0) {
      const { data: recent } = await supabase
        .from("workout_plans")
        .select("id, name, start_date, end_date")
        .eq("client_id", userId)
        .is("deleted_at" as any, null)
        .order("end_date", { ascending: false })
        .limit(1);
      plans = recent;
    }

    if (!plans || plans.length === 0) {
      setLoading(false);
      return;
    }

    const activePlan = plans[0];
    setPlan(activePlan);
    
    const weeks = calculateTotalWeeks(activePlan.start_date, activePlan.end_date);
    const current = Math.min(calculateCurrentWeek(activePlan.start_date, activePlan.end_date), weeks);
    setTotalWeeks(weeks);
    setCurrentWeek(current);

    const { data: planExercises } = await supabase
      .from("workout_plan_exercises")
      .select(`id, notes, rest_seconds, order_index, exercise_name, video:exercise_videos(id, title, video_url)`)
      .eq("workout_plan_id", activePlan.id)
      .eq("day_of_week", dayNumber)
      .order("order_index");

    if (planExercises) {
      const exerciseIds = planExercises.map(e => e.id);
      const [completionsRes, testNotesRes] = await Promise.all([
        supabase
          .from("workout_completions")
          .select("*")
          .eq("client_id", userId!)
          .in("workout_plan_exercise_id", exerciseIds),
        supabase
          .from("coach_test_notes")
          .select("*")
          .in("workout_plan_exercise_id", exerciseIds)
      ]);

      const completions = completionsRes.data;
      const testNotes = testNotesRes.data as CoachTestNote[] | null;

      const exercisesWithWeeks: ExerciseWithWeeks[] = planExercises.map(ex => {
        const existingCompletions = completions?.filter(c => c.workout_plan_exercise_id === ex.id) || [];
        const weekCompletions: WeekCompletion[] = [];
        for (let w = 1; w <= weeks; w++) {
          const existing = existingCompletions.find(c => c.set_number === w);
          weekCompletions.push({
            id: existing?.id,
            week_number: w,
            client_notes: existing?.client_notes || "",
            difficulty_rating: existing?.difficulty_rating || 0,
            saved: !!existing
          });
        }

        const coachTestNote = testNotes?.find(n => n.workout_plan_exercise_id === ex.id);

        return {
          ...ex,
          exercise_name: (ex as any).exercise_name || "Esercizio",
          video: ex.video as unknown as ExerciseVideo | null,
          weekCompletions,
          coachTestNote
        };
      });

      setExercises(exercisesWithWeeks);
    }

    setLoading(false);
  };

  const toggleExercise = (exerciseId: string) => {
    setOpenExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) newSet.delete(exerciseId);
      else newSet.add(exerciseId);
      return newSet;
    });
  };

  const updateWeekCompletion = (exerciseId: string, weekNumber: number, field: 'client_notes' | 'difficulty_rating', value: string | number) => {
    setExercises(prev => prev.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return { ...ex, weekCompletions: ex.weekCompletions.map(week => week.week_number !== weekNumber ? week : { ...week, [field]: value, saved: false }) };
    }));
  };

  const saveWeekCompletion = async (exerciseId: string, weekNumber: number) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    const weekData = exercise?.weekCompletions.find(w => w.week_number === weekNumber);
    if (!exercise || !weekData || !profile?.user_id) return;

    setSaving(`${exerciseId}-${weekNumber}`);

    try {
      if (weekData.id) {
        await supabase.from("workout_completions").update({ client_notes: weekData.client_notes, difficulty_rating: weekData.difficulty_rating }).eq("id", weekData.id);
      } else {
        const { data } = await supabase.from("workout_completions").insert({
          workout_plan_exercise_id: exerciseId,
          client_id: profile.user_id,
          set_number: weekNumber,
          client_notes: weekData.client_notes,
          difficulty_rating: weekData.difficulty_rating
        }).select().single();

        if (data) {
          setExercises(prev => prev.map(ex => {
            if (ex.id !== exerciseId) return ex;
            return { ...ex, weekCompletions: ex.weekCompletions.map(week => week.week_number !== weekNumber ? week : { ...week, id: data.id, saved: true }) };
          }));
        }
      }

      toast.success("Salvato!");
      setExercises(prev => prev.map(ex => {
        if (ex.id !== exerciseId) return ex;
        return { ...ex, weekCompletions: ex.weekCompletions.map(week => week.week_number !== weekNumber ? week : { ...week, saved: true }) };
      }));

      setOpenExercises(prev => { const newSet = new Set(prev); newSet.delete(exerciseId); return newSet; });
    } catch {
      toast.error("Errore nel salvataggio");
    }

    setSaving(null);
  };

  const getExerciseCompletionStatus = (exercise: ExerciseWithWeeks) => {
    const completed = exercise.weekCompletions.filter(w => w.saved).length;
    const total = exercise.weekCompletions.length;
    return { completed, total, isComplete: completed === total };
  };

  const canRateWeek = (weekNumber: number): boolean => weekNumber <= currentWeek;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <Link to="/coaching/scheda">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="font-display text-3xl tracking-wider">Giorno {dayNumber}</h1>
          <p className="text-sm text-muted-foreground">{plan?.name} • Settimana {currentWeek} di {totalWeeks}</p>
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((exercise, index) => {
          const status = getExerciseCompletionStatus(exercise);
          const isOpen = openExercises.has(exercise.id);

          return (
            <Collapsible key={exercise.id} open={isOpen} onOpenChange={() => toggleExercise(exercise.id)}>
              <Card className="overflow-hidden border-border">
                <CollapsibleTrigger className="w-full">
                  <div className="bg-gradient-to-r from-card to-muted/30 p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4 text-left">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-display text-lg text-primary">{index + 1}</span>
                      </div>
                      <div>
                        {status.isComplete && (
                          <Badge variant="default" className="text-xs gap-1 mb-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Tutte le settimane
                          </Badge>
                        )}
                        <p className="text-lg font-semibold">
                          {exercise.exercise_name ? renderColoredText(exercise.exercise_name) : "Esercizio"}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          ({status.completed}/{status.total} sett. valutate)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {exercise.video && (
                        <a href={(exercise.video as any).video_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="gap-2"><Play className="w-4 h-4" />Video</Button>
                        </a>
                      )}
                      {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {exercise.notes && (
                    <div className="px-4 py-3 bg-muted/50 border-t border-border">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1"><MessageSquare className="w-4 h-4" />Nota del Coach</div>
                      <p className="text-sm text-muted-foreground">{exercise.notes}</p>
                    </div>
                  )}

                  {exercise.coachTestNote && (exercise.coachTestNote.note || exercise.coachTestNote.rating) && (
                    <div className="px-4 py-3 bg-orange-500/5 border-t border-orange-500/20">
                      <div className="flex items-center gap-2 text-sm font-medium mb-1 text-orange-700 dark:text-orange-400">
                        <span>⚡</span>Correzione Test
                        {exercise.coachTestNote.rating && (
                          <span className="text-xs bg-orange-500/20 px-2 py-0.5 rounded-full">
                            {exercise.coachTestNote.rating}/10
                          </span>
                        )}
                      </div>
                      {exercise.coachTestNote.note && (
                        <p className="text-sm text-muted-foreground">{exercise.coachTestNote.note}</p>
                      )}
                    </div>
                  )}

                  <CardContent className="p-4 space-y-3">
                    {/* Storico compatto — TUTTE le settimane valutate (passate + corrente se salvata), in ordine scheda */}
                    {(() => {
                      const ratedWeeks = exercise.weekCompletions
                        .filter((w) => w.saved || w.client_notes || w.difficulty_rating > 0)
                        .filter((w) => !(w.week_number === currentWeek && !w.saved)) // escludi corrente in editing
                        .sort((a, b) => a.week_number - b.week_number);

                      if (ratedWeeks.length === 0) return null;

                      return (
                        <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Storico settimane
                          </div>
                          {ratedWeeks.map((week) => (
                            <div key={week.week_number} className="px-3 py-2 flex items-start gap-3">
                              <span className="text-xs font-display tracking-wider text-primary/80 mt-0.5 min-w-[3rem]">
                                Sett. {week.week_number}
                              </span>
                              <p className="text-sm text-foreground/90 flex-1 whitespace-pre-wrap break-words">
                                {week.client_notes || <span className="italic text-muted-foreground">— nessuna nota —</span>}
                              </p>
                              {week.difficulty_rating > 0 && (
                                <Badge variant="outline" className="gap-1 flex-shrink-0 mt-0.5">
                                  <span>⚡</span>
                                  <span className="font-medium">{week.difficulty_rating}/10</span>
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Editor per la settimana corrente (sempre visibile finché compilabile) + placeholder future */}
                    {exercise.weekCompletions
                      .filter((w) => w.week_number >= currentWeek)
                      .map((week) => {
                        const isCurrentWeek = week.week_number === currentWeek;
                        const isFutureWeek = week.week_number > currentWeek;

                        // Settimane future non valutate: placeholder discreto
                        if (isFutureWeek) {
                          return (
                            <div key={week.week_number} className="p-3 rounded-lg border border-dashed border-border/40 bg-muted/10 flex items-center justify-between opacity-60">
                              <span className="text-sm font-display tracking-wider text-muted-foreground">
                                Sett. {week.week_number}
                              </span>
                              <span className="text-xs text-muted-foreground italic">Non ancora disponibile</span>
                            </div>
                          );
                        }

                        return (
                          <div key={week.week_number} className={`p-4 rounded-lg border transition-all ${week.saved ? 'bg-primary/5 border-primary/30' : 'bg-accent/10 border-accent/50 ring-2 ring-accent/30'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-display text-lg">Settimana {week.week_number}</span>
                                {isCurrentWeek && !week.saved && <Badge variant="secondary" className="text-xs">Corrente</Badge>}
                                {week.saved && <Badge variant="default" className="text-xs">Modifica</Badge>}
                              </div>
                              {week.saved && <CheckCircle2 className="w-5 h-5 text-primary" />}
                            </div>

                            <div className="mb-3">
                              <label className="text-sm text-muted-foreground block mb-2">Come è andato l'esercizio questa settimana? (1-10)</label>
                              <LightningRating value={week.difficulty_rating} onChange={(val) => updateWeekCompletion(exercise.id, week.week_number, 'difficulty_rating', val)} />
                            </div>
                            <div className="mb-3">
                              <Textarea placeholder="Note sulla settimana (opzionale)..." value={week.client_notes} onChange={(e) => updateWeekCompletion(exercise.id, week.week_number, 'client_notes', e.target.value)} className="min-h-[60px] resize-none" />
                            </div>
                            <Button size="sm" onClick={() => saveWeekCompletion(exercise.id, week.week_number)} disabled={saving === `${exercise.id}-${week.week_number}`} className="w-full gap-2">
                              {saving === `${exercise.id}-${week.week_number}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              {week.saved ? "Aggiorna" : "Salva Valutazione"}
                            </Button>
                          </div>
                        );
                      })}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {exercises.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nessun esercizio per questo giorno</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutDayDetail;
