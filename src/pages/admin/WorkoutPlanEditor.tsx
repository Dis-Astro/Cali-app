import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ExerciseNameInput from "@/components/admin/ExerciseNameInput";
import LightningRating from "@/components/coaching/LightningRating";
import { Slider } from "@/components/ui/slider";
import { 
  Loader2, Plus, Trash2, ArrowLeft, Dumbbell, Save,
  ChevronDown, ChevronUp, FileText, ClipboardList, Pause, Play, CheckCircle, Bell
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { syncTestReminderAppointment } from "@/lib/testReminder";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316", azzurro: "#38bdf8", verde: "#22c55e",
  giallo: "#eab308", rosso: "#ef4444", blu: "#3b82f6", viola: "#a855f7",
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

// ─── Types ───
interface DayExercise {
  id?: string;
  exercise_name_free: string;
  order_index: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface DayBlock {
  day_number: number;
  exercises: DayExercise[];
}

interface PreviousPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  coach_notes: string | null;
  description: string | null;
  exercises: { id: string; exercise_name: string | null; day_of_week: number | null; order_index: number }[];
  feedbacks: { exercise_id: string; week_number: number; rating: number; notes: string; completed_at: string }[];
}

interface TestPlan {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  coach_notes: string | null;
  exercises: { id: string; exercise_name: string | null; day_of_week: number | null; order_index: number }[];
  coachTestNotes: Map<string, { note: string; rating: number }>;
}

// ─── Component ───
const WorkoutPlanEditor = () => {
  const { userId, planId } = useParams<{ userId: string; planId?: string }>();
  const [searchParams] = useSearchParams();
  const planType = searchParams.get("type") || "workout_plan";
  const isTest = planType === "test";

  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const isEditing = !!planId;

  // Editor state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_weeks: "4",
    coach_notes: "",
    status: "attiva",
    end_date: "",
    test_reminder_days: 7,
  });
  const [days, setDays] = useState<DayBlock[]>([{ day_number: 1, exercises: [{ exercise_name_free: "", order_index: 0, isNew: true }] }]);

  // Side panels
  const [allPlans, setAllPlans] = useState<PreviousPlan[]>([]);
  const [selectedLeftPlanId, setSelectedLeftPlanId] = useState<string>("");
  const [tests, setTests] = useState<TestPlan[]>([]);
  const [selectedRightTestId, setSelectedRightTestId] = useState<string>("");
  const [openFeedbackExercises, setOpenFeedbackExercises] = useState<Set<string>>(new Set());

  // Mobile tab
  const [activeTab, setActiveTab] = useState("editor");

  useEffect(() => {
    if (userId && profile?.user_id) loadAll();
  }, [userId, planId, profile?.user_id]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadClient(),
      isEditing ? loadPlanForEditing() : Promise.resolve(),
      loadPreviousPlan(),
      loadTests(),
    ]);
    setLoading(false);
  };

  const loadClient = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .single();
    if (data) setClientName(`${data.first_name} ${data.last_name}`);
  };

  const loadPlanForEditing = async () => {
    if (!planId) return;
    const [planRes, exercisesRes] = await Promise.all([
      supabase.from("workout_plans").select("*").eq("id", planId).single(),
      supabase.from("workout_plan_exercises").select("id, exercise_name, day_of_week, order_index")
        .eq("workout_plan_id", planId).order("day_of_week").order("order_index"),
    ]);

    if (planRes.data) {
      const p = planRes.data as any;
      setFormData({
        name: p.name, description: p.description || "", coach_notes: p.coach_notes || "",
        status: p.status || (p.is_active ? "attiva" : "conclusa"), end_date: p.end_date || "",
        duration_weeks: "4",
        test_reminder_days: p.test_reminder_days ?? 7,
      });
    }

    if (exercisesRes.data) {
      const dayMap = new Map<number, DayExercise[]>();
      exercisesRes.data.forEach(ex => {
        const day = ex.day_of_week || 1;
        if (!dayMap.has(day)) dayMap.set(day, []);
        dayMap.get(day)!.push({ id: ex.id, exercise_name_free: ex.exercise_name || "", order_index: ex.order_index });
      });
      const dayBlocks: DayBlock[] = Array.from(dayMap.entries()).sort(([a], [b]) => a - b)
        .map(([day_number, exercises]) => ({ day_number, exercises }));
      setDays(dayBlocks.length > 0 ? dayBlocks : [{ day_number: 1, exercises: [{ exercise_name_free: "", order_index: 0, isNew: true }] }]);
    }
  };

  const loadPreviousPlan = async () => {
    // Load ALL plans for this client (excluding current if editing)
    const { data: plans } = await supabase
      .from("workout_plans")
      .select("id, name, start_date, end_date, status, coach_notes, description")
      .eq("client_id", userId!)
      .is("deleted_at" as any, null)
      .order("created_at", { ascending: false });

    if (!plans || plans.length === 0) { setAllPlans([]); return; }

    // Exclude current plan if editing
    const availablePlans = isEditing ? plans.filter(p => p.id !== planId) : plans;
    if (availablePlans.length === 0) { setAllPlans([]); return; }

    // Load exercises + feedbacks for all available plans
    const allPlanIds = availablePlans.map(p => p.id);
    const [exercisesRes, completionsRes] = await Promise.all([
      supabase.from("workout_plan_exercises")
        .select("id, exercise_name, day_of_week, order_index, workout_plan_id")
        .in("workout_plan_id", allPlanIds)
        .order("day_of_week").order("order_index"),
      supabase.from("workout_completions")
        .select("*")
        .eq("client_id", userId!)
        .or("client_notes.not.is.null,difficulty_rating.gt.0")
        .order("set_number"),
    ]);

    const exercises = exercisesRes.data || [];
    const completions = completionsRes.data || [];

    const loadedPlans: PreviousPlan[] = availablePlans.map(p => {
      const planExercises = exercises.filter(e => e.workout_plan_id === p.id);
      const exIds = planExercises.map(e => e.id);
      const planFeedbacks = completions
        .filter(c => exIds.includes(c.workout_plan_exercise_id))
        .filter(c => c.client_notes || (c.difficulty_rating && c.difficulty_rating > 0))
        .map(c => ({
          exercise_id: c.workout_plan_exercise_id, week_number: c.set_number,
          rating: c.difficulty_rating || 0, notes: c.client_notes || "", completed_at: c.completed_at,
        }));

      return {
        ...p, status: (p as any).status || "attiva",
        exercises: planExercises,
        feedbacks: planFeedbacks,
      };
    });

    setAllPlans(loadedPlans);
    // Auto-select the most recent one
    if (!selectedLeftPlanId || !loadedPlans.find(p => p.id === selectedLeftPlanId)) {
      setSelectedLeftPlanId(loadedPlans[0].id);
    }
  };

  const loadTests = async () => {
    const { data: testPlans } = await (supabase
      .from("workout_plans")
      .select("id, name, start_date, end_date, status, coach_notes")
      .eq("client_id", userId!) as any)
      .eq("plan_type", "test")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }) as any;

    if (!testPlans || testPlans.length === 0) { setTests([]); return; }

    const allIds = testPlans.map((t: any) => t.id);
    const { data: exercises } = await supabase
      .from("workout_plan_exercises")
      .select("id, exercise_name, day_of_week, order_index, workout_plan_id")
      .in("workout_plan_id", allIds)
      .order("day_of_week").order("order_index");

    // Load coach test notes for all exercises
    const allExIds = (exercises || []).map(e => e.id);
    const { data: coachNotes } = allExIds.length > 0
      ? await (supabase.from("coach_test_notes" as any) as any)
          .select("workout_plan_exercise_id, note, rating")
          .in("workout_plan_exercise_id", allExIds)
      : { data: [] };

    const loadedTests = testPlans.map((t: any) => {
      const testExercises = (exercises || []).filter(e => e.workout_plan_id === t.id);
      const testExIds = testExercises.map(e => e.id);
      const notesMap = new Map<string, { note: string; rating: number }>();
      (coachNotes || [])
        .filter((n: any) => testExIds.includes(n.workout_plan_exercise_id))
        .forEach((n: any) => {
          notesMap.set(n.workout_plan_exercise_id, { note: n.note || "", rating: n.rating || 0 });
        });
      return {
        ...t, status: (t as any).status || "attiva",
        exercises: testExercises,
        coachTestNotes: notesMap,
      };
    });

    setTests(loadedTests);
    // Auto-select the most recent test
    if (!selectedRightTestId || !loadedTests.find((t: any) => t.id === selectedRightTestId)) {
      setSelectedRightTestId(loadedTests[0].id);
    }
  };

  // ─── Day/Exercise Management ───
  const addDay = () => {
    const nextDay = days.length > 0 ? Math.max(...days.map(d => d.day_number)) + 1 : 1;
    setDays(prev => [...prev, { day_number: nextDay, exercises: [{ exercise_name_free: "", order_index: 0, isNew: true }] }]);
  };

  const removeDay = (dayIndex: number) => {
    setDays(prev => prev.filter((_, i) => i !== dayIndex));
  };

  const addExerciseToDay = (dayIndex: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const maxOrder = Math.max(0, ...day.exercises.filter(e => !e.isDeleted).map(e => e.order_index));
      return { ...day, exercises: [...day.exercises, { exercise_name_free: "", order_index: maxOrder + 1, isNew: true }] };
    }));
  };

  const removeExerciseFromDay = (dayIndex: number, exIndex: number) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const ex = day.exercises[exIndex];
      if (ex.id) {
        const exercises = [...day.exercises];
        exercises[exIndex] = { ...ex, isDeleted: true };
        return { ...day, exercises };
      }
      return { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) };
    }));
  };

  const updateExerciseName = (dayIndex: number, exIndex: number, value: string) => {
    setDays(prev => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const exercises = [...day.exercises];
      exercises[exIndex] = { ...exercises[exIndex], exercise_name_free: value };
      return { ...day, exercises };
    }));
  };

  // ─── Status Change ───
  const handleStatusChange = async (newStatus: string) => {
    if (!planId) return;
    setSaving(true);
    const updateData: any = { status: newStatus, is_active: newStatus === "attiva" };
    
    if (newStatus === "in_pausa") {
      updateData.paused_at = new Date().toISOString();
    } else if (newStatus === "attiva" && formData.status === "in_pausa") {
      const planRes = await supabase.from("workout_plans").select("paused_at, end_date, total_paused_days").eq("id", planId).single();
      if (planRes.data) {
        const pausedAt = new Date((planRes.data as any).paused_at);
        const now = new Date();
        const pausedDays = Math.floor((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24));
        const newEndDate = new Date((planRes.data as any).end_date);
        newEndDate.setDate(newEndDate.getDate() + pausedDays);
        updateData.end_date = newEndDate.toISOString().split("T")[0];
        updateData.total_paused_days = ((planRes.data as any).total_paused_days || 0) + pausedDays;
        updateData.paused_at = null;
        setFormData(prev => ({ ...prev, end_date: updateData.end_date }));
      }
    }

    const { error } = await supabase.from("workout_plans").update(updateData).eq("id", planId);
    if (error) {
      toast({ title: "Errore", description: "Impossibile aggiornare lo stato", variant: "destructive" });
    } else {
      setFormData(prev => ({ ...prev, status: newStatus }));
      toast({ title: newStatus === "in_pausa" ? "Scheda in pausa" : newStatus === "attiva" ? "Scheda riattivata" : "Scheda conclusa" });
    }
    setSaving(false);
  };

  // ─── Submit ───
  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: "Errore", description: "Inserisci un nome", variant: "destructive" });
      return;
    }
    const allExercises = days.flatMap(d => d.exercises.filter(e => !e.isDeleted));
    if (allExercises.length === 0) {
      toast({ title: "Errore", description: "Aggiungi almeno un esercizio", variant: "destructive" });
      return;
    }
    const invalid = allExercises.filter(e => !e.exercise_name_free.trim());
    if (invalid.length > 0) {
      toast({ title: "Errore", description: "Scrivi il nome per ogni esercizio", variant: "destructive" });
      return;
    }

    setSaving(true);

    if (isEditing) {
      // Update existing plan
      const { error: planError } = await supabase.from("workout_plans").update({
        name: formData.name, description: formData.description || null,
        coach_notes: formData.coach_notes || null, end_date: formData.end_date || undefined,
        test_reminder_days: formData.test_reminder_days,
        updated_at: new Date().toISOString(),
      } as any).eq("id", planId!);

      if (planError) {
        toast({ title: "Errore", description: "Impossibile aggiornare", variant: "destructive" });
        setSaving(false);
        return;
      }

      const allDayExercises = days.flatMap(day => day.exercises.map(ex => ({ ...ex, day_of_week: day.day_number })));
      const toDelete = allDayExercises.filter(e => e.isDeleted && e.id);
      if (toDelete.length > 0) await supabase.from("workout_plan_exercises").delete().in("id", toDelete.map(e => e.id!));

      const toUpdate = allDayExercises.filter(e => !e.isDeleted && !e.isNew && e.id);
      for (const ex of toUpdate) {
        await supabase.from("workout_plan_exercises").update({
          exercise_id: null, exercise_name: ex.exercise_name_free.trim(),
          day_of_week: ex.day_of_week, sets: null, reps: null, notes: null, order_index: ex.order_index,
        }).eq("id", ex.id!);
      }

      const toInsert = allDayExercises.filter(e => !e.isDeleted && e.isNew);
      if (toInsert.length > 0) {
        await supabase.from("workout_plan_exercises").insert(
          toInsert.map(ex => ({
            workout_plan_id: planId!, exercise_id: null, exercise_name: ex.exercise_name_free.trim(),
            day_of_week: ex.day_of_week, sets: null, reps: null, notes: null, order_index: ex.order_index,
          }))
        );
      }

      // Sync test reminder appointment
      if (userId && profile?.user_id && formData.end_date) {
        await syncTestReminderAppointment({
          planId: planId!,
          coachId: profile.user_id,
          clientId: userId,
          endDate: formData.end_date,
          reminderDays: formData.test_reminder_days,
          planType,
        });
      }

      toast({ title: isTest ? "Test aggiornato!" : "Scheda aggiornata!" });
    } else {
      // Create new
      const startDate = new Date();
      const weeks = parseInt(formData.duration_weeks) || 4;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + weeks * 7);

      const { data: plan, error: planError } = await supabase.from("workout_plans").insert({
        client_id: userId!, coach_id: profile?.user_id, name: formData.name,
        description: formData.description || null, coach_notes: formData.coach_notes || null,
        start_date: format(startDate, "yyyy-MM-dd"), end_date: format(endDate, "yyyy-MM-dd"),
        is_active: true, plan_type: planType,
        test_reminder_days: formData.test_reminder_days,
      } as any).select().single();

      if (planError) {
        toast({ title: "Errore", description: "Impossibile creare", variant: "destructive" });
        setSaving(false);
        return;
      }

      let orderIndex = 0;
      const exercisesToInsert = days.flatMap(day =>
        day.exercises.filter(e => !e.isDeleted).map(ex => ({
          workout_plan_id: plan.id, exercise_id: null, exercise_name: ex.exercise_name_free.trim(),
          day_of_week: day.day_number, sets: null, reps: null, notes: null, order_index: orderIndex++,
        }))
      );

      const { error: exercisesError } = await supabase.from("workout_plan_exercises").insert(exercisesToInsert);
      if (exercisesError) {
        toast({ title: "Attenzione", description: "Creata ma alcuni esercizi non salvati", variant: "destructive" });
      } else {
        // Sync test reminder appointment per scheda nuova
        if (profile?.user_id && userId) {
          await syncTestReminderAppointment({
            planId: plan.id,
            coachId: profile.user_id,
            clientId: userId,
            endDate: format(endDate, "yyyy-MM-dd"),
            reminderDays: formData.test_reminder_days,
            planType,
          });
        }
        toast({ title: isTest ? "Test creato!" : "Scheda creata!" });
      }
    }

    setSaving(false);
    navigate(`/admin/utenti/${userId}`);
  };

  // ─── Toggle feedback ───
  const toggleFeedbackExercise = (id: string) => {
    setOpenFeedbackExercises(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // ─── Render Left Panel: Previous Plan + Feedback ───
  const previousPlan = allPlans.find(p => p.id === selectedLeftPlanId) || null;

  const renderPreviousPlan = () => {
    if (allPlans.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Prima scheda per questo cliente</p>
          <p className="text-sm mt-1">Nessuna scheda precedente disponibile</p>
        </div>
      );
    }

    if (!previousPlan) return null;

    const exercisesByDay = previousPlan.exercises.reduce((acc, ex) => {
      const day = ex.day_of_week || 1;
      if (!acc[day]) acc[day] = [];
      acc[day].push(ex);
      return acc;
    }, {} as Record<number, typeof previousPlan.exercises>);

    return (
      <div className="space-y-3">
        {previousPlan.description && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">{previousPlan.description}</p>
          </div>
        )}

        {previousPlan.coach_notes && (
          <div className="p-3 bg-primary/10 border-l-4 border-primary rounded-lg">
            <p className="text-xs font-medium mb-1">Note del Coach</p>
            <p className="text-xs text-muted-foreground">{previousPlan.coach_notes}</p>
          </div>
        )}

        {Object.entries(exercisesByDay).sort(([a], [b]) => Number(a) - Number(b)).map(([day, exs]) => (
          <div key={day} className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium">Giorno {day}</div>
            <div className="divide-y">
              {exs.map((ex, idx) => {
                const feedbacks = previousPlan.feedbacks.filter(f => f.exercise_id === ex.id);
                const hasFeedback = feedbacks.length > 0;
                const isOpen = openFeedbackExercises.has(ex.id);

                return (
                  <Collapsible key={ex.id} open={isOpen} onOpenChange={() => hasFeedback && toggleFeedbackExercise(ex.id)}>
                    <CollapsibleTrigger className="w-full" disabled={!hasFeedback}>
                      <div className={`px-3 py-2 flex items-center justify-between text-left ${hasFeedback ? 'hover:bg-muted/30 cursor-pointer' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-medium flex-shrink-0">{idx + 1}</span>
                          <p className="text-xs whitespace-pre-wrap">{ex.exercise_name ? renderColoredText(ex.exercise_name) : "Esercizio"}</p>
                        </div>
                        {hasFeedback && (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-[10px] h-5">{feedbacks.length}fb</Badge>
                            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    {hasFeedback && (
                      <CollapsibleContent>
                        <div className="px-3 pb-2 divide-y divide-border/40 border border-border/40 rounded bg-muted/10">
                          {feedbacks.sort((a, b) => a.week_number - b.week_number).map(fb => (
                            <div key={`${fb.exercise_id}-${fb.week_number}`} className="px-2 py-1.5 flex items-start gap-2 text-xs">
                              <span className="font-medium text-primary/80 mt-0.5 min-w-[2.5rem]">S{fb.week_number}</span>
                              <p className="flex-1 whitespace-pre-wrap break-words text-foreground/90">
                                {fb.notes || <span className="italic text-muted-foreground">—</span>}
                              </p>
                              {fb.rating > 0 && (
                                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  ⚡{fb.rating}/10
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Render Right Panel: Selected Test ───
  const selectedTest = tests.find(t => t.id === selectedRightTestId) || null;

  const renderTests = () => {
    if (tests.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Nessun test disponibile</p>
          <p className="text-sm mt-1">Crea il primo test per questo cliente</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-2"
            onClick={() => navigate(`/admin/utenti/${userId}/scheda/nuova?type=test`)}
          >
            <Plus className="w-3 h-3" /> Crea Test
          </Button>
        </div>
      );
    }

    if (!selectedTest) return null;

    const test = selectedTest;
    const exercisesByDay = test.exercises.reduce((acc, ex) => {
      const day = ex.day_of_week || 1;
      if (!acc[day]) acc[day] = [];
      acc[day].push(ex);
      return acc;
    }, {} as Record<number, typeof test.exercises>);

    const filledCount = Array.from(test.coachTestNotes.values()).filter(n => n.note || n.rating).length;

    return (
      <div className="space-y-3">
        {filledCount > 0 && (
          <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
            {filledCount}/{test.exercises.length} note
          </Badge>
        )}

        {test.coach_notes && (
          <div className="p-2 bg-primary/10 border-l-2 border-primary rounded text-xs">
            <p className="font-medium mb-0.5">Note Coach</p>
            <p className="text-muted-foreground">{test.coach_notes}</p>
          </div>
        )}

        {Object.entries(exercisesByDay).sort(([a], [b]) => Number(a) - Number(b)).map(([day, exs]) => (
          <div key={day} className="mb-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Giorno {day}</p>
            {exs.map((ex, idx) => {
              const coachNote = test.coachTestNotes.get(ex.id);
              const hasNote = !!(coachNote?.note || coachNote?.rating);
              const isOpen = openFeedbackExercises.has(`test-${ex.id}`);

              return (
                <Collapsible key={ex.id} open={isOpen} onOpenChange={() => toggleFeedbackExercise(`test-${ex.id}`)}>
                  <CollapsibleTrigger className="w-full">
                    <div className={`px-2 py-1.5 rounded flex items-center justify-between text-left hover:bg-muted/30 transition-colors ${hasNote ? 'bg-accent/50' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground text-xs">{idx + 1}.</span>
                        <p className="text-xs truncate whitespace-pre-wrap">
                          {ex.exercise_name ? renderColoredText(ex.exercise_name) : "Esercizio"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasNote && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-2 pb-2 ml-5">
                      {coachNote?.rating ? (
                        <div className="mb-1">
                          <LightningRating value={coachNote.rating} readonly size="sm" />
                        </div>
                      ) : null}
                      {coachNote?.note ? (
                        <p className="text-xs text-muted-foreground">{coachNote.note}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nessuna nota</p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // ─── Render Center Panel: Editor ───
  const renderEditor = () => (
    <div className="space-y-4">
      {/* Status controls (edit mode only) */}
      {isEditing && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
          <Label className="text-sm text-muted-foreground w-full mb-1">Stato:</Label>
          {formData.status === "attiva" && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("in_pausa")} disabled={saving} className="gap-1"><Pause className="w-3 h-3" />Pausa</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("conclusa")} disabled={saving} className="gap-1"><CheckCircle className="w-3 h-3" />Concludi</Button>
            </>
          )}
          {formData.status === "in_pausa" && (
            <>
              <Button type="button" variant="default" size="sm" onClick={() => handleStatusChange("attiva")} disabled={saving} className="gap-1"><Play className="w-3 h-3" />Riattiva</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("conclusa")} disabled={saving} className="gap-1"><CheckCircle className="w-3 h-3" />Concludi</Button>
            </>
          )}
          {formData.status === "conclusa" && (
            <Button type="button" variant="default" size="sm" onClick={() => handleStatusChange("attiva")} disabled={saving} className="gap-1"><Play className="w-3 h-3" />Riattiva</Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome {isTest ? "Test" : "Scheda"} *</Label>
          <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder={isTest ? "Es. Test Forza Marzo" : "Es. Scheda Forza - Febbraio"} />
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Label>Data Fine</Label>
            <Input type="date" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Durata (settimane)</Label>
            <Select value={formData.duration_weeks} onValueChange={v => setFormData({ ...formData, duration_weeks: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(isTest ? [1, 2] : [2, 4, 5, 6, 7, 8]).map(w => (
                  <SelectItem key={w} value={w.toString()}>{w} settimane</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Descrizione</Label>
        <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Obiettivi..." rows={2} />
      </div>

      <div className="space-y-2">
        <Label>{isTest ? "Note Coach (solo admin)" : "Note per il Cliente"}</Label>
        <Textarea value={formData.coach_notes} onChange={e => setFormData({ ...formData, coach_notes: e.target.value })}
          placeholder={isTest ? "Note tecniche interne..." : "Note che il cliente vedrà..."} rows={2} />
      </div>

      {/* Promemoria "Prepara Test" sul calendario */}
      {!isTest && (
        <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Promemoria "Prepara test" sul calendario
            </Label>
            <span className="text-sm font-display tracking-wider">
              {formData.test_reminder_days === 0 ? "Off" : `${formData.test_reminder_days} gg`}
            </span>
          </div>
          <Slider
            min={0}
            max={14}
            step={1}
            value={[formData.test_reminder_days]}
            onValueChange={([v]) => setFormData({ ...formData, test_reminder_days: v })}
          />
          <p className="text-xs text-muted-foreground">
            {formData.test_reminder_days === 0
              ? "Nessun promemoria automatico verrà creato sul calendario."
              : `Verrà creato un appuntamento "Prepara test" sul tuo calendario ${formData.test_reminder_days} giorni prima della scadenza.`}
          </p>
        </div>
      )}

      {/* Days + Exercises */}
      <div className="space-y-4">
        <div>
          <Label className="text-base">Giorni ed Esercizi</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Scrivi liberamente su più righe — includi serie, rep e colore elastico nel nome
          </p>
        </div>

        {days.map((day, dayIndex) => {
          const visibleExercises = day.exercises.filter(e => !e.isDeleted);
          if (visibleExercises.length === 0 && day.exercises.every(e => e.isDeleted)) return null;

          return (
            <div key={dayIndex} className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 flex items-center justify-between">
                <h4 className="font-medium text-sm">Giorno {day.day_number}</h4>
                {days.filter(d => d.exercises.some(e => !e.isDeleted)).length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(dayIndex)} className="h-7 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" />Rimuovi
                  </Button>
                )}
              </div>
              <div className="p-3 space-y-2">
                {day.exercises.map((ex, exIndex) => {
                  if (ex.isDeleted) return null;
                  const visibleIdx = visibleExercises.indexOf(ex);
                  return (
                    <div key={ex.id || `new-${exIndex}`} className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5 mt-2">#{visibleIdx + 1}</span>
                      <ExerciseNameInput
                        value={ex.exercise_name_free}
                        onChange={val => updateExerciseName(dayIndex, exIndex, val)}
                      />
                      {visibleExercises.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 mt-1" onClick={() => removeExerciseFromDay(dayIndex, exIndex)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button type="button" variant="ghost" size="sm" onClick={() => addExerciseToDay(dayIndex)} className="gap-1 text-primary w-full justify-center mt-1">
                  <Plus className="w-3.5 h-3.5" />Nuovo esercizio
                </Button>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" onClick={addDay} className="w-full gap-2 sticky bottom-0 bg-background z-10">
          <Plus className="w-4 h-4" />Aggiungi Giorno
        </Button>
      </div>

      {/* Save Button */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={() => navigate(`/admin/utenti/${userId}`)}>Annulla</Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? "Salva Modifiche" : (isTest ? "Crea Test" : "Crea Scheda")}
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout title={isTest ? "EDITOR TEST" : "EDITOR SCHEDA"} icon={<Dumbbell className="w-6 h-6" />} showBackLink hideSidebar>
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  const pageTitle = isEditing
    ? (isTest ? `Modifica Test — ${clientName}` : `Modifica Scheda — ${clientName}`)
    : (isTest ? `Nuovo Test — ${clientName}` : `Nuova Scheda — ${clientName}`);

  return (
    <AdminLayout title={pageTitle} icon={<Dumbbell className="w-6 h-6" />} showBackLink hideSidebar>
      <Button variant="ghost" onClick={() => navigate(`/admin/utenti/${userId}`)} className="mb-4 gap-2">
        <ArrowLeft className="w-4 h-4" />Torna al profilo
      </Button>

      {isMobile ? (
        /* ─── Mobile: Tabbed Layout ─── */
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="previous">Precedente</TabsTrigger>
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="tests">Test</TabsTrigger>
          </TabsList>
          <TabsContent value="previous">
            <Card><CardContent className="p-4">{renderPreviousPlan()}</CardContent></Card>
          </TabsContent>
          <TabsContent value="editor">
            {renderEditor()}
          </TabsContent>
          <TabsContent value="tests">
            <Card><CardContent className="p-4">{renderTests()}</CardContent></Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* ─── Desktop: Three-Column Layout ─── */
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Previous Plan + Feedback */}
          <div className="col-span-3">
            <Card>
              <div className="bg-muted px-4 py-2 border-b space-y-1.5">
                <h3 className="font-display text-sm tracking-wider flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Scheda Laterale
                </h3>
                {allPlans.length > 0 && (
                  <Select value={selectedLeftPlanId} onValueChange={setSelectedLeftPlanId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Seleziona scheda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allPlans.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} — {format(new Date(p.start_date), "d MMM yy", { locale: it })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <CardContent className="p-3 max-h-[calc(100vh-260px)] overflow-y-auto">
                {renderPreviousPlan()}
              </CardContent>
            </Card>
          </div>

          {/* Center: Editor */}
          <div className="col-span-6">
            <Card>
              <div className="bg-muted px-4 py-2 border-b">
                <h3 className="font-display text-sm tracking-wider flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-primary" />
                  {isEditing ? (isTest ? "Modifica Test" : "Modifica Scheda") : (isTest ? "Nuovo Test" : "Nuova Scheda")}
                </h3>
              </div>
              <CardContent className="p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
                {renderEditor()}
              </CardContent>
            </Card>
          </div>

          {/* Right: Tests / Notes */}
          <div className="col-span-3">
            <Card>
              <div className="bg-muted px-4 py-2 border-b space-y-1.5">
                <h3 className="font-display text-sm tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Test & Note
                </h3>
                {tests.length > 0 && (
                  <Select value={selectedRightTestId} onValueChange={setSelectedRightTestId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Seleziona test..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tests.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name} — {format(new Date(t.start_date), "d MMM yy", { locale: it })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <CardContent className="p-3 max-h-[calc(100vh-260px)] overflow-y-auto">
                {renderTests()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default WorkoutPlanEditor;
